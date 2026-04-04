# Phase 3 — Feasibility crosscheck (`p3-feasibility-crosscheck`)

**Task:** `p3-feasibility-crosscheck`  
**Agent:** ai-engineer  
**Date:** 2026-04-04  
**Depends on:** `p2-architect-paths/outputs/architecture-paths.md`, `path-comparison-table.md`, canonical bundle `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md`  
**Verdict scale:** **Feasible** = can proceed under current Cloudflare stack without retiring a platform unknown; **Needs spike** = commitment requires a time-boxed proof or design gate first; **Blocked** = not recommended to start implementation until a named dependency clears (does not mean “forever impossible”).

Path numbering matches **`architecture-paths.md`** (Paths 1–6).

---

## Cross-cutting: `ModelProvidersController` 503 and config-modal UX

**503 behavior (repo-grounded):** `createProvider`, `updateProvider`, and `deleteProvider` return **503** with copy directing users to BYOK vault; `testProvider` returns **503** when testing by `providerId`, but still allows **direct `baseUrl` + `apiKey`** probes via `GET {baseUrl}/models` (`worker/api/controllers/modelProviders/controller.ts`). That split means “custom providers disabled” is **not** the same as “no outbound calls to arbitrary URLs.”

**Tension for Paths 1–4 (config / BYOK):** Any UI or API client that still surfaces “add custom OpenAI-compatible provider” flows will hit **503** on CRUD while the bundle notes **config-modal** inconsistency: primary BYOK / “Manage Keys” may be disabled or “Coming Soon” while other strings point users at vault or provider setup (**§B** bundle). Until CRUD is re-enabled with SSRF discipline, **product copy and modal states must align** with actual capabilities to avoid trust and support load issues.

**Tension for Path 3 (gateway):** If the Worker becomes a thin client to one gateway URL, **503 routes may be deleted or repurposed**; migration must not leave dead UI calling removed endpoints.

**Tension for Path 5–6:** Mostly orthogonal; canvas/ask work should still **respect** the same BYOK messaging so users are not pushed into broken provider flows from the right pane.

---

## Orchestration stack evaluation (open decision)

**Scope:** How **ask mode**, **canvas / AG-UI**, and **codegen** are coordinated—**native Durable Object + existing state machine** vs **LangGraph-class** graphs vs **CopilotKit** (full-stack or adapter-only)—is **not** decided in this document. Commitment is **pending time-boxed spikes** (see `spike-backlog.md`, orchestration rows).

**Evaluation criteria (for comparing options):**

| Criterion | What to prove or disprove |
|-----------|---------------------------|
| **Security** | Single story for keys, provider policy, and SSRF across modes; no channel where user-facing settings silently do not apply. |
| **Reliability** | Reconnect, compaction, and version skew under WebSocket + DO alarms; no orphan subgraphs or duplicated writers. |
| **Operability** | Deploy model, observability, failure modes, and on-call surface (one vs multiple runtimes). |
| **Worker / DO fit** | CPU/time limits, single-threaded DO semantics, `fetch` and streaming patterns; whether a graph runs **inside** the DO, **adjacent** to it, or **only on the client** with a thin Worker bridge. |

**State machine note:** The current `CodeGeneratorAgent` state machine is **large and legacy-shaped**; that is **motivation to compare** orchestration options and incremental extraction—not a requirement to **freeze** the present design as the only acceptable end state. Spikes should assume **evidence over default**.

---

## Path 1 — Worker-only policy (env + code), minimal D1 change

| Verdict | **Feasible** |
|--------|--------------|
| **Worker** | **Strong fit.** Policy stays in isolate; no extra D1 reads on inference hot path. Matches today’s `AGENT_CONFIG` / `PLATFORM_MODEL_PROVIDERS` split (`config.ts` truthy-env branch vs comma-list semantics in `byokHelper.ts` — already a known doc/testing burden, not a feasibility stopper). |
| **D1** | **Minimal change.** Existing `user_model_configs` and vault-backed BYOK continue to apply; no new catalog tables required. |
| **Durable Object** | **Strong fit.** No new snapshot/versioning model; `CodeGeneratorAgent` keeps current config load patterns. |
| **503 / config-modal** | **High tension** if the product goal is goal **2** (admin OpenAI-compatible endpoints): Path 1 **does not** resolve 503; it **preserves** it. UX must clearly state that custom provider **registration** is unavailable and funnel to supported BYOK paths only where implemented. |
| **Notes** | Correct as a **bridge** release; not a terminal architecture for goals 2 and 4. |

---

## Path 2 — D1-backed catalog, bundles, and resolution in Worker

| Verdict | **Needs spike** (multiple gates; not platform-blocked) |
|--------|---------------------------------------------------------|
| **Worker** | **Feasible.** D1 for catalog + assignments; `fetch` to providers is native. **Caveat:** any user- or tenant-supplied base URL reintroduction must follow **implemented** SSRF controls and **engineering sign-off**; research framing now in bundle **§C** / **§I.5** and journal **`p1c-research-byok-tenancy-ssrf`** (does not replace implementation review). |
| **D1** | **Feasible** for bundles, assignments, audit columns, migrations. Cost is **engineering + migration**, not SQLite/D1 capability. Watch read patterns: resolve once per session or on change, cache in DO memory per Phase 2. |
| **Durable Object** | **Feasible.** Session **snapshot** of resolved config avoids mid-turn drift; aligns with bundle **§G**. Requires explicit invalidation rules when admin or user changes bundles. |
| **503 / config-modal** | **Central tension:** Path 2 is the main path to **replace** “disabled CRUD” with **auditable** admin/provider flows. Until implementation lands, **503 + modal mismatch remain**; roadmap should sequence: (1) UX honesty pass, (2) security design, (3) re-enable CRUD behind policy. **`testProvider`** behavior must be folded into the same policy as CRUD to avoid a **false sense** of safety. |
| **Notes** | **Inference unification** (`realtimeCodeFixer`, `PhaseGeneration` vs merged user config — **§I.1**) is a **feasibility sub-spike** inside Path 2, not a Worker limit. |

---

## Path 3 — External gateway-style abstraction (OpenAI-compatible proxy / LiteLLM-class)

| Verdict | **Needs spike** |
|--------|-----------------|
| **Worker** | **Technically feasible** as a `fetch` client to a stable gateway base URL per tenant/env. Extra RTT is usually acceptable for LLM workloads; streaming still viable. |
| **D1** | **Feasible** to store tenant → gateway endpoint reference + credential handle; gateway may own model catalog, reducing D1 surface **if** product accepts gateway as SoT. |
| **Durable Object** | **Feasible** if resolved config snapshot includes **virtual model IDs** or gateway routing keys; DO lifecycle unchanged. |
| **503 / config-modal** | **Medium tension:** Today’s 503 text tells users to use **BYOK vault**, not “use corporate gateway.” If Path 3 wins, UX and API should describe **tenant gateway** vs **user vault** explicitly so modal and errors match routing reality. |
| **Notes** | **Organizational spike** (SRE, HA, data residency, observability) dominates; no Cloudflare hard blocker. |

---

## Path 4 — Control plane service + Worker data plane (cached snapshots)

| Verdict | **Needs spike** |
|--------|-----------------|
| **Worker** | **Feasible** if control plane is also Workers + D1; **more complex** if control plane is another cloud (egress, identity, mTLS). Data-plane Worker stays thin: read snapshot, serve DO. |
| **D1** | **Feasible** as snapshot store (or R2/KV per Phase 2); **consistency spike** required: stale snapshots, invalidation storms, ETag/version semantics. |
| **Durable Object** | **Feasible** — same snapshot-at-connect pattern as Path 2, but **source of truth** for writes moves to control plane; DO must handle **version skew** on reconnect. |
| **503 / config-modal** | **Indirect tension:** Admin CRUD might move entirely off `ModelProvidersController`; then **503** could disappear from user-facing API while **config-modal** must call **new** control-plane surfaces — risk of **two** half-migrated UIs without a deliberate cutover plan. |
| **Notes** | Justified when **multi-consumer** catalogs or compliance-segregated admin APIs are real; otherwise Path 2 may suffice (**YAGNI** until pain is proven). |

---

## Path 5 — AG-UI / A2UI adapter on PartySocket + phased generative UI (canvas pane)

| Verdict | **Needs spike** |
|--------|-----------------|
| **Worker** | **Feasible.** WebSocket + DO already exist; adapter is **protocol mapping**, not a new runtime. |
| **D1** | **Neutral / optional** for canvas unless artifact versions are persisted in D1; Phase 1D favors **DO as SoT** with optional persistence spike later. |
| **Durable Object** | **Strong fit** for authoritative state, snapshots, and incremental deltas; single-threaded model matches AG-UI lifecycle reasoning. |
| **503 / config-modal** | **Low direct tension**; ensure canvas actions do not deep-link users into broken custom-provider setup without guards. |
| **Notes** | **Dual protocol** maintenance, **reconnect + compaction** per AG-UI serialization, **XSS** surface for A2UI — all **spike-sized** unknowns (**§I.3**). CopilotKit + **React 19 + Vite** compatibility is a **client spike**, not a Worker blocker. |

---

## Path 6 — Hybrid orchestration (external graph for ask/canvas; DO for codegen)

| Verdict | **Needs spike** (orchestration stack **open**; LangGraph-class and CopilotKit full-stack remain **in evaluation**, not excluded by policy) |
|--------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| **Worker** | Codegen DO path unchanged — **feasible** in isolation. |
| **D1** | **Risk of split brain:** two systems may each hold model policy unless **one** SoT is chosen; duplicates goal **2–4** complexity. |
| **Durable Object** | **Feasible** for codegen; **hard** to keep **one** conversation history and **one** enforcement story for ask mode (**goal 6**) across two runtimes without heavy sync—spikes must show an acceptable boundary. |
| **503 / config-modal** | **High tension:** An external or parallel graph runtime may use **different** key and provider rules; users could see **modal** settings that do not apply to that channel, or vice versa—must be designed explicitly if hybrid wins. |
| **Notes** | Phase 2 **XL** cost estimate stands. **Previous “Blocked” framing** meant **default deferral** without mandate and without spike evidence—not a permanent “will not use LangGraph” (or similar) rule. **Promotion to roadmap** requires: explicit product mandate where needed, plus outcomes from **orchestration spikes** (boundary, CopilotKit depth, dual-mode UX). Until then, **do not** commit parallel production hybrid **without** those gates; demo-only paths remain valid for learning. |

---

## Summary matrix

| Path | Verdict | Worker | D1 | DO |
|------|---------|--------|----|----|
| 1 Worker/env only | Feasible | Excellent | Minimal | Excellent |
| 2 D1 catalog + resolve | Needs spike | Strong (post-SSRF design) | Strong | Strong (snapshots) |
| 3 External gateway | Needs spike | Strong client | Medium (refs) | Strong (snapshot of route) |
| 4 Control + data plane | Needs spike | Medium–strong | Strong (snapshots) | Strong (version skew) |
| 5 AG-UI on PartySocket | Needs spike | Strong adapter | Optional | Strong |
| 6 Hybrid external graph | Needs spike | Split | Split-brain risk | Split (boundary TBD) |

**Preferred composite (Phase 2):** **Path 2 + Path 5** remains a **strong default composite** if **Path 2** spikes (SSRF, RBAC, inference parity) and **Path 5** spikes (protocol mapping, A2UI sandbox) clear. **Path 6** and LangGraph / CopilotKit **full-stack** options are **not** bundled as default until orchestration spikes close; they are **not** removed from consideration—spike outcomes may revise the composite.

---

## Definition of Done — self-review

| Criterion | Met? | Notes |
|-----------|------|-------|
| Each path from `architecture-paths.md` (1–6) has **feasible / needs spike / blocked** | **Yes** | Path 6 uses **Needs spike**; orchestration stack open pending spikes + mandate where hybrid ships. |
| **Worker / D1 / DO** reasoning per path | **Yes** | Tabular sub-bullets under each path. |
| **503** provider endpoints and **config-modal** tension called out | **Yes** | Cross-cutting section + per-path where relevant. |
| On-disk under `journal_root/p3-feasibility-crosscheck/outputs/` | **Yes** | Matches plan convention. |
| Phase 6 can consume | **Yes** | Summary matrix + tie to `spike-backlog.md`. |

**Quality gates / caveats:**

- **Phase 1C on disk:** `p1c-research-byok-tenancy-ssrf` merged into canonical bundle (**§B**, **§C**, **§I.5**). Path 2 verdict remains **Needs spike** until **production SSRF controls** ship and security signs off—not because the research pack is missing.
- **Agency / super-admin** entities are absent in worker grep (**§I.1**): Paths 2 and 4 assume **new** RBAC + schema — captured as spike dependencies, not as “already feasible in code.”
- Bundle **Planning** table path numbering differs from **`architecture-paths.md`**; this file follows **architecture-paths.md** per task spec.

---

*End of Phase 3 feasibility crosscheck.*
