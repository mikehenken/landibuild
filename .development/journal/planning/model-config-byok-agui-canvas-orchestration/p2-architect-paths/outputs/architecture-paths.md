# Phase 2 — Architecture paths (model config, BYOK, AG-UI / A2UI, canvas, ask mode)

**Task:** `p2-architect-paths`  
**Agent:** architect-reviewer  
**Date:** 2026-04-04 (refreshed 2026-04-05 — Path 7 + Phase 3 handoff aligned with `path-comparison-table.md`)  
**Depends on:** Phase 1 merged into `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md` (optional deeper read: `model-config-byok-canvas-FINAL-2026-04-04.md`)  
**Upstream scope:** `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md`  
**Companion matrix:** `path-comparison-table.md`

This document enumerates **credible architectural directions** for goals 1–6 in that plan. It is **planning only** (no implementation). Repo-grounded observations (e.g. `AGENT_CONFIG` / `PLATFORM_MODEL_PROVIDERS` semantics, `ModelProvidersController` 503, absence of agency tables) are summarized in the canonical research bundle **§I.1**; this file focuses on **options and tradeoffs**.

---

## Scope recap (for alignment)

| # | Outcome |
|---|--------|
| 1 | Dynamic provider/model configuration beyond today’s `AGENT_CONFIG` + `PLATFORM_MODEL_PROVIDERS` split |
| 2 | Super-admin / agency-admin OpenAI-compatible endpoints with strong secret and outbound-call hygiene |
| 3 | Clarify / close gaps for mixing models across actions (D1 / policy / non-unified inference paths) |
| 4 | Named preset bundles with platform / agency / user precedence |
| 5 | Canvas-style right pane + **AG-UI / A2UI** viability alongside `CodeGeneratorAgent` and current WebSocket protocol |
| 6 | **Ask mode** in any thread without breaking codegen; server-enforced where safety matters |

**Constraints:** Cloudflare Workers, D1, Durable Objects, PartySocket; additive posture (`NEVER_REMOVE_FEATURES`); auditable admin changes; no raw keys in logs.

**Stance on AG-UI / A2UI:** Strong product desire to **make it work** if constraints allow; paths below include an explicit **preferred composite** when viability holds, without hiding **harder** or **split-brain** alternatives.

**Revision note (2026-04-04):** Planning language was softened after product discussion: **no path implies “never” LangGraph, CopilotKit orchestration, or a fuller CopilotKit stack.** Path 6 and ecosystem tools remain **credible options** where **session hierarchy**, **dual-stack feasibility**, and **orchestration maturity** justify them (see `path-comparison-table.md` for added criteria). Preferred composite **2 + 5** remains the **default starting point**, not a permanent ban on Path 6 or graph runtimes.

---

## Path 1 — Worker-only policy (env + code), minimal D1 change

**Idea:** Keep authoritative defaults in Worker code and deployment env (`AGENT_CONFIG`, `PLATFORM_MODEL_PROVIDERS`, secrets bindings). Extend only what is unavoidable (e.g. small flags), defer D1 catalog tables. BYOK stays user-vault centric; custom base URLs remain disabled or narrowly scoped.

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Lowest moving parts; no new consistency model between D1 and inference; fast to ship small toggles; aligns with today’s mental model. |
| **Cons** | Does **not** meet goals 2, 4, or rich 1 without frequent deploys; agency/super-admin configuration story weak; bundles are still “two static configs” unless encoded in env. |
| **Fit on Workers** | Excellent: no extra read latency on hot path; policy is local to isolate. |
| **Rough migration cost** | **S** (small): env/docs and small code paths only. |
| **Tradeoffs** | Operational velocity vs product requirement for **tenant-level** and **named** configuration; risk of env sprawl if used as a substitute for data model. |

**Best when:** You need a **bridge** release or must pause schema work; **not** a terminal architecture for admin catalogs or AG-UI-heavy UX.

---

## Path 2 — D1-backed catalog, bundles, and resolution in Worker

**Idea:** Introduce D1 entities for model catalog entries, **versioned preset bundles**, assignments (platform → agency → user), optional custom OpenAI-compatible providers (scoped rows). A **resolution service** in the Worker merges precedence at session start / on change; the Durable Object stores a **snapshot** of resolved config to avoid mid-turn drift. Outbound calls to custom URLs go through **Worker-enforced** SSRF controls (allowlists, DNS/IP validation, redirect limits—details belong to security design / Phase 1C).

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Single deployable; full alignment with goals **1, 2, 4**; auditable changes in D1; natural place for bundle pins and rollback; keeps secrets and routing logic inside your trust boundary. |
| **Cons** | Schema migrations, backfill from current `AGENT_CONFIG` objects; must unify inference entry points so bypasses (`realtimeCodeFixer`, parts of `PhaseGeneration`) do not violate policy; Worker complexity grows. |
| **Fit on Workers** | Strong: D1 fits catalog + assignments; DO fits session snapshot; `fetch` to provider URLs is native (with SSRF discipline). Watch **D1 read patterns** on hot path—cache in DO memory after resolve. |
| **Rough migration cost** | **L** (large): schema, migration, `ModelConfigService` evolution, admin APIs, UI, parity across all LLM call sites, SSRF review for any `testProvider`-class behavior. |
| **Tradeoffs** | You own **all** gateway semantics and multi-tenant correctness vs buying a hosted gateway’s battle-tested policy engine. |

**Best when:** You want **landibuild** to remain the system of record for **who may call which model from where**, with Cloudflare-native scaling.

---

## Path 3 — External gateway-style abstraction (e.g. OpenAI-compatible proxy / LiteLLM-class)

**Idea:** Move routing, keys, virtual keys, and optional “bundles” to an **external** OpenAI-compatible gateway. The Worker holds **only** tenant identity and a **short-lived credential** or route token; actual model IDs and provider mapping live in the gateway. Landi Worker becomes a thin client calling one base URL per environment or per tenant partition.

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Mature patterns for multi-tenant keys, spend limits, and provider fan-out; can accelerate goal **2** if team accepts ops of that service; reduces custom SSRF surface **on Worker** if all external URLs are gateway-owned. |
| **Cons** | New **trust boundary** and **latency** hop; HA, upgrades, and data residency for prompts; dual configuration (gateway + landi) unless gateway is sole SoT; debugging distributed failures. |
| **Fit on Workers** | Good **technically** (`fetch` to gateway); **organizational** fit depends on ops capacity. Cold-start + extra RTT usually acceptable for LLM workloads if not chatty per token (streaming still works). |
| **Rough migration cost** | **L–XL**: deploy/operate gateway, network auth, migrate key material, change inference client to unified base URL, retire or bypass `PLATFORM_MODEL_PROVIDERS` assumptions. |
| **Tradeoffs** | Buy operational and security patterns vs **vendor/self-hosted complexity** and split observability. |

**Best when:** You already run or want a **central AI platform** shared across multiple products (e.g. broader Landi platform), and landibuild is one consumer.

---

## Path 4 — Control plane service + Worker data plane (cached snapshots)

**Idea:** Split **admin/configuration API** (could be another Worker, a small Node service, or platform “Bifrost”-class API) from the **session data plane** (current coding DO + PartySocket). Control plane owns CRUD for catalogs, bundles, providers; publishes **versioned snapshots** or **ETag’d configs** to D1/R2/KV. Session DO loads snapshot at connect and on invalidation; inference uses snapshot only.

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Clear **separation of concerns**; admin throughput and validation logic need not compete with DO CPU; supports richer audit UI and batch jobs without touching hot path. |
| **Cons** | **Two systems** to secure and deploy; **consistency** story (stale snapshots, invalidation storms); more moving parts than Path 2 alone. |
| **Fit on Workers** | Good if control plane is also Worker + D1; cross-cloud control plane adds egress/identity complexity. |
| **Rough migration cost** | **L–XL** depending on whether control plane is greenfield or reuse of an existing Landi service (see research bundle note on **cross-repo alignment**). |
| **Tradeoffs** | Modularity vs **operational load**; only worth it if admin scale or org boundaries demand it. |

**Best when:** Multiple clients (not only landibuild) consume the same catalog, or compliance demands a **dedicated** admin API surface.

---

## Path 5 — AG-UI / A2UI adapter on PartySocket + phased generative UI (canvas pane)

**Idea:** Treat **PartySocket + DO** as the transport and **source of truth** for codegen state. Add an **adapter layer** that maps internal messages/events to **AG-UI**-shaped event streams (and optionally **A2UI** payloads for the right pane). Phase rollout: (a) envelope/wrapper + read-only artifact mirror, (b) streaming **JSON Patch**-style or AG-UI delta updates for artifact/canvas, (c) optional A2UI renderer with **sandboxing** (e.g. iframe / strict component allowlist) for XSS control — with room to **tighten allowlists** or **hybrid** known-component + generative islands as the trust model matures. **open-canvas** informs **UX** (split pane, artifact versions); it does not by itself decide whether secondary orchestrators (e.g. graph runtimes) may exist elsewhere if session rules are explicit.

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Aligns with plan’s **protocol-first** stance; preserves existing DO lifecycle; enables **interop** and future client swaps; supports goal **5** without **requiring** LangGraph on the server for the PartySocket adapter itself (Path 6 remains a separate **hypothesis**). |
| **Cons** | **Dual protocol** maintenance during transition; must define **authoritative merge** between legacy `websocketTypes` and AG-UI (dedup, reconnect, compaction per AG-UI serialization docs); client bundle size / React 19 + Vite + optional CopilotKit needs **spike** verification. |
| **Fit on Workers** | Strong: WebSocket already; DO single-threaded state suits snapshot + delta; no requirement for Node-only AG-UI server if client speaks protocol. |
| **Rough migration cost** | **M–L** phased: **M** for wrapper + static artifact mirror spike; **L** for full event parity, A2UI catalog trust model, and canvas versioning UX. |
| **Tradeoffs** | Incremental safety vs time-to-full-protocol compliance; **CopilotKit** as accelerator for **client** only vs owning protocol mapping end-to-end. |

**Best when:** Goal **5** is a priority and you want **evolutionary** integration (plan: smallest shippable bridge, not big-bang replacement).

---

## Path 6 — Hybrid orchestration (external graph for ask/canvas; DO for codegen)

**Idea:** Run **ask mode** and/or **canvas** through an external runtime (e.g. LangGraph-style service) while **codegen** stays on `CodeGeneratorAgent`. UI might multiplex two channels or use a meta-orchestrator. **LangGraph / CopilotKit-class orchestration** is a **valid hypothesis** here: evaluate on **orchestration maturity**, **migration cost**, and **dual-stack** (legacy Worker/DO + new runtime) feasibility — not dismissed as a non-goal.

| Dimension | Assessment |
|-----------|------------|
| **Pros** | Reuse **ecosystem** patterns (graphs, AG-UI samples tied to graph runtimes); can prototype canvas quickly off-platform; may align with **cross-product** AI platforms elsewhere in Landi. |
| **Cons** | **Split brain** risk: duplicated config, two histories unless carefully synchronized; **high** integration risk for goal **6** (mode and tools) and goal **5** (single UX) **unless** **parallel orchestrators** are allowed only under an **explicit session hierarchy** (authoritative mode, handoff, unified config resolution). |
| **Fit on Workers** | DO/chat path unchanged for codegen; external service is separate deploy and identity. |
| **Rough migration cost** | **XL**: synchronization, auth, cost attribution, and user-visible failure modes multiply; **dual-stack** period likely **long** without a strangler or snapshot bridge. |
| **Tradeoffs** | Speed of demo and **pattern reuse** vs **operational load**; justified when evidence (spike or mandate) shows graph runtime wins outweigh merge and observability cost — not only when “hard requirement” is declared in advance. |

**Best when:** Cross-product **shared graph runtime**, or spikes show **clear** win on velocity/features **and** a committed **session hierarchy** design. Otherwise default remains **2 + 5**; Path 6 stays in the set for **Phase 3** feasibility and **time-boxed** prototypes.

---

## Path 7 — Immutable bundle artifacts (R2/KV) + resolver pairing

**Idea:** Store **versioned preset bundle payloads** (JSON or signed blobs) in **R2** or **KV** as **immutable artifacts**; D1 holds **pointers** (hash, URI, effective window) and assignment precedence (platform → agency → user) consumed by the same **resolution service** as Path 2 (or snapshots fed from Path 4). New bundle “editions” are **append-only**; roll forward / rollback toggles the pointer, not the blob.

| Dimension | Assessment |
|-----------|------------|
| **Pros** | **G4** gets **audit-grade** history and **SKU-like** releases without standing up full Path 4; reduces accidental drift (“what was bundle v3?”); pairs cleanly with Path **2** (policy in D1, blobs immutable). |
| **Cons** | **Publish pipeline** (validate, upload, GC old refs); **consistency** between pointer and blob if partial writes fail; debugging requires **artifact browser** discipline. |
| **Fit on Workers** | Strong: R2/KV are first-class; Worker reads bundle once per resolve / caches in DO; no extra hop on every token—similar to snapshot caching in Path 2. |
| **Rough migration cost** | **M–L** additive: storage bindings, upload path, schema for pointers, integration with bundle resolver; **not** a substitute for Path 2’s catalog if **G1–G3** need row-level policy. |
| **Tradeoffs** | Operational clarity for **G4** vs another moving part; **does not** by itself deliver **G5** or **G6**—always **pair** with **2** (or 4). |

**Best when:** **G4** needs **immutable rollback**, compliance-friendly bundle history, or a **clean split** between “published bundle bytes” and “who is assigned which pointer”—without adopting the full **control plane / data plane** split of Path 4.

---

## Composable strategies (how paths combine)

| Combination | Rationale |
|-------------|-----------|
| **2 + 5** | **Recommended default composite** when viability holds: D1 resolves **policy and bundles**; PartySocket+DO exposes **AG-UI-shaped** streams for canvas without externalizing codegen. |
| **2 + 5 + 7** | **G4** emphasis: Path **7** adds **immutable** bundle blobs + pointers while **2** remains SoT for assignments and **5** for canvas / AG-UI—avoids full Path 4 if admin scale does not require a separate control plane. |
| **2 + 3** | D1 stores **tenant → gateway endpoint + credential ref**; gateway owns provider map; landi avoids per-customer base URL `fetch` (SSRF shifts to gateway hardening). |
| **4 + 2** | Control plane owns admin CRUD; data plane Worker reads only snapshots—good for large orgs / multi-app catalogs. |
| **1 + 5** | Short-term: minimal policy change while spiking **AG-UI envelope** (risk: policy debt accumulates if 2 is deferred too long). |

---

## Preferred path if viability holds

**Primary recommendation:** **Path 2 (D1-backed catalog + resolution in Worker)** for configuration, bundles, BYOK/admin provider story, and ask-mode **server enforcement** hooks, combined with **Path 5 (AG-UI / A2UI adapter on PartySocket + phased generative UI)** for the canvas / protocol alignment.

- **Path 7** is **additive** when **G4** needs immutable bundle artifacts and rollback discipline; it **strengthens audit** and release hygiene paired with **2** (and **5** for UX)—it is **not** a stand-in for **G5** or **G6** alone.

**Rationale (aligned with scope stance):**

- Preserves **Durable Object** and PartySocket as the **orchestration core** for **codegen**, matching Phase 1D’s “DO remains source of truth” posture for that lane — without ruling out **evaluating** Path 6 where session hierarchy and dual-stack plans are explicit.
- Delivers goals **1–4** and **6** in one platform-shaped design **without requiring** an external graph runtime on day one.
- Makes **AG-UI / A2UI** a **projection** of existing state plus incremental events, which is the **smallest shippable bridge** called for in the plan, while leaving room to adopt CopilotKit **selectively** (client-first or deeper) as spikes prove value.
- **Path 6** is **not** “never”: it is the **high-cost, high-reuse** branch — appropriate when **orchestration maturity** needs (or cross-product graph sharing) clear the bar set in Phase 3 and the comparison table’s **dual-stack** row.

**Harder alternatives to keep visible:**

- **Path 3 alone** as SoT: faster if you already operate a gateway fleet; weaker if landibuild must own fine-grained D1 audit without another team’s roadmap.
- **Path 4**: justified when admin scale or multi-consumer catalogs dominate; otherwise YAGNI against Path 2 until pain is proven.
- **Path 6**: strong **LangGraph / ecosystem** pattern reuse and optional CopilotKit orchestration alignment; **operational, sync, and UX** tax unless session hierarchy and migration are deliberately designed.

**Explicit dependencies on spikes (from Phase 1D / bundle §I.3):** AG-UI message wrapper on PartySocket; static A2UI spec from Worker + split-pane render; `CodeGenState` ↔ AG-UI snapshot mapping + reconnect; streaming patch deltas for artifacts. **Phase 1C** should still land to harden BYOK/SSRF narrative before committing to Path 2’s custom URL surface.

---

## Phase 3 — Feasibility handoff (what to resolve next)

For each path **1–7**, Phase 3 (`p3-feasibility-crosscheck`) should return **feasible / needs spike / blocked** with **Worker / D1 / DO** reasoning (see `path-comparison-table.md` § Phase 3 prompt hook).

| Tension | Why it matters |
|---------|----------------|
| **`ModelProvidersController` 503** vs **`testProvider`** | CRUD may be disabled while probes still `fetch` user `baseUrl`; security and UX story must stay consistent (SSRF row in comparison table). |
| **`runtimeOverrides`** | Override semantics must not bypass the resolved catalog unless **one** choke point defines precedence. |
| **`SESSION_INIT`** / bootstrap | Session start assumptions affect how a **resolved config snapshot** is applied on connect. |
| **`realtimeCodeFixer`** (and similar) | Inference paths outside unified resolution undermine **G3** and Path 2’s single-policy claim. |
| Idle **`handleUserInput`** / **G6** | Ask mode needs a **server** gate for repo/codegen side effects, not UI-only mode. |

**Code anchors (re-verify in Phase 3):** `worker/agents/inferutils/config.ts`, `worker/agents/inferutils/infer.ts`, `worker/agents/inferutils/core.ts`, `worker/api/controllers/modelConfig/byokHelper.ts`, `worker/api/controllers/modelProviders/controller.ts`.

---

## Quick matrix (full table also in `path-comparison-table.md`)

| Path | Goals 1–4 | Goal 5 AG-UI | Goal 6 ask | Worker fit | Migration |
|------|-----------|--------------|------------|------------|-----------|
| 1 Env/Worker-only | Partial | Neutral | Partial | High | S |
| 2 D1 catalog + resolve | Strong | Neutral (pairs with 5) | Strong | High | L |
| 3 External gateway | Strong (via gateway) | Neutral | Strong (if unified) | High | L–XL |
| 4 Control + data plane | Strong | Neutral | Strong | Medium–High | L–XL |
| 5 AG-UI on PartySocket | Neutral | Strong | Neutral (pairs with 2) | High | M–L |
| 6 Hybrid external graph | Varies | Medium (demo) | Risky | Split | XL |
| 7 R2/KV bundle artifacts | Neutral alone; strong G4 with 2 | Neutral | Neutral (pairs with 2) | High (storage + resolve) | M–L |

---

## Definition of Done — self-review

| Criterion | Met? | Notes |
|-----------|------|-------|
| At least **four** credible directions | **Yes** | Six paths (1–6), covering the plan’s examples: Worker-only policy, D1-backed catalog, external gateway, AG-UI adapter; plus control/data plane split and hybrid orchestration as explicit alternates. |
| Each path: **pros, cons, Workers fit, rough migration cost, tradeoffs** | **Yes** | Tabular per path; migration uses S/M/L/XL bands, not false precision. |
| **Preferred path if viability holds** aligned with strong AG-UI/A2UI intent | **Yes** | **2 + 5** composite default; Path 6 and 3 remain **credible** (not “never”) — harder / boundary shifts, per 2026-04-04 revision note. |
| Harder alternatives not hidden | **Yes** | Path 3, 4, 6 documented with costs and when they win. |
| On-disk under `journal_root/p2-architect-paths/` | **Yes** | This file path matches plan convention. |
| Phase 3 can consume for feasibility | **Yes** | Paths are discrete enough to mark feasible / needs spike / blocked per Worker/D1/DO. |

**Quality gates / caveats:**

- **Phase 1C missing on disk** at last bundle merge: SSRF and tenancy claims for Path 2 remain **design-dependent** until `p1c-research-byok-tenancy-ssrf` lands.
- **Agency / super-admin** entities are not present in worker grep today (**§I.1**): Path 2 and 4 assume **new** RBAC + schema work—called out as product/engineering prerequisite, not as existing code.
- Numeric migration estimates are **ordinal** (S/M/L/XL); Phase 3 should attach **spike-backed** estimates after feasibility pass.

---

*End of Phase 2 architecture paths.*
