# Spike backlog — Phase 3 (`p3-feasibility-crosscheck`)

**Purpose:** Ordered inputs for **Phase 6** final report and engineering epics.  
**Sources:** Phase 2 paths (`architecture-paths.md`, `path-comparison-table.md`), Phase 1 bundle **§I**, **§H**, `gaps-vs-goals-1-4.md`, `p1d-synthesis` digest **§I.3**.  
**Fields:** **Title**, **Owner suggestion** (role/discipline), **Depends on path** (1–6 from `architecture-paths.md`), **Blocks / unlocks** (short).

Order is **dependency-first**: research and security gates before large schema work; inference parity before marketing mixed-provider behavior; protocol spikes before heavy UI investment.

**Orchestration selection (2026-04-04):** Rows **18–21** are **path-selection gates** for LangGraph-class vs native DO vs CopilotKit depth. Run early enough to inform Phase 6 / epics but **after** SSRF alignment (**#2–3**) where hybrid options touch outbound policy.

---

| # | Title | Owner suggestion | Depends on path | Blocks / unlocks |
|---|--------|------------------|-----------------|------------------|
| 1 | **Phase 1C — BYOK, tenancy, SSRF research pack** (`p1c-research-byok-tenancy-ssrf` on disk + merge to bundle) | research-analyst + security-engineer | **2**, **4** (custom URL surface) | **Done (2026-04-04):** journal + bundle **§B** / **§C** / **§I.5** — **spike #2** still gates production “signed off” SSRF |
| 2 | **Worker SSRF policy design** for user/tenant `fetch` to OpenAI-compatible bases (allowlist, DNS→IP, redirects, timeouts, logging redaction) | security-engineer + platform-engineer (Workers) | **2**, **3** (if Worker still probes URLs) | Unblocks re-enabling or restricting **`testProvider`** alongside CRUD |
| 3 | **503 / config-modal / API alignment** — single story for “custom providers,” BYOK vault, and disabled CRUD | frontend engineer + product | **1**, **2**, **3**, **4** | Reduces user confusion; defines copy for gateway path |
| 4 | **D1 schema sketch + migration plan** for catalog rows, versioned bundles, assignments (platform / agency / user precedence) | platform-engineer + architect-reviewer | **2**, **4** | Core of Path 2; snapshot source for Path 4 |
| 5 | **Resolution service PoC** — merge precedence, seed from `PLATFORM_AGENT_CONFIG` / `DEFAULT_AGENT_CONFIG`, parity tests | platform-engineer | **2** | Proves D1 read pattern + cache strategy for DO |
| 6 | **DO session config snapshot + invalidation** — when admin/user changes bundle, reconnect vs push update | engineer familiar with `CodeGeneratorAgent` / websocket | **2**, **4** | Prevents mid-turn drift (Phase 2 requirement) |
| 7 | **Inference path audit + unify bypasses** — `realtimeCodeFixer`, `PhaseGeneration` vs `executeInference` + merged `userModelConfigs` / `runtimeOverrides` | ai-engineer | **2**, **6** (ask enforcement) | Closes **§I.1** policy gaps for goal **3** |
| 8 | **Agency / super-admin RBAC model** — D1 identity, roles, who may define providers vs bundles | architect-reviewer + product | **2**, **4**, **6** | Goal **2**; no grep hits today |
| 9 | **External gateway shortlist + integration PoC** (one env, virtual key or route token, latency + streaming check) | devops-engineer + platform-engineer | **3** | Informs build-vs-buy; pairs with **2+3** composite |
| 10 | **Control plane vs monolithic Path 2 decision** — when snapshot/KV invalidation beats second service | architect-reviewer | **4** | Avoids building Path 4 prematurely |
| 11 | **AG-UI event envelope on PartySocket** — smallest bridge message; no full rewrite | ai-engineer + frontend engineer | **5** | First **§I.3** spike; de-risks dual protocol |
| 12 | **`CodeGenState` ↔ AG-UI snapshot mapping + reconnect** | ai-engineer | **5** | State restoration parity |
| 13 | **Static A2UI spec from Worker + split-pane render** (read-only artifact) | frontend engineer | **5** | Canvas UX proof without full streaming |
| 14 | **Streaming patch / deltas for artifacts** (JSON Patch or AG-UI delta style) | ai-engineer | **5** | WebSocket bloat mitigation |
| 15 | **A2UI renderer sandbox strategy** (iframe / strict allowlist / CSP) | frontend engineer + security-engineer | **5** | XSS governance for generative UI |
| 16 | **CopilotKit vs hand-rolled client** — React 19 + Vite matrix, bundle size sample | frontend engineer | **5** | Accelerate vs own tradeoff |
| 17 | **Ask mode — server-enforced** mode flag, tool allowlist (`buildTools` / `buildAskTools`), `user_suggestion` / `websocketTypes` extension | ai-engineer | **2**, **6** | Goal **6**; native DO-first implementation remains valid; external graph **optional** after **18–21** |
| 18 | **Hybrid / external orchestration mandate + integration spike** — TCO, shared graph requirement, history sync, dual config, single policy story (LangGraph-class or other); go/no-go | product + architect-reviewer + ai-engineer | **6** | Informs whether Path 6-class shapes ship; **not** a ban on graph runtimes—evidence gate |
| 19 | **LangGraph (or subgraph) ↔ DO boundary spike** — where state lives, checkpoints, single writer, streaming across boundary, Worker CPU/time | ai-engineer + platform-engineer | **5**, **6** | Decides in-DO subgraph vs external service vs client-only orchestration |
| 20 | **CopilotKit full-stack vs adapter-only** — runtime ownership, bundle cost, React 19 + Vite, AG-UI mapping effort vs hand-rolled (extends **#16**) | frontend engineer + ai-engineer | **5**, **6** | Picks depth of CopilotKit adoption; pairs with **#11–16** |
| 21 | **Dual-page / dual-mode orchestration feasibility** — one thread spanning codegen + ask + canvas: UX, WebSocket multiplexing, reconnect, and conflict rules | product + frontend engineer + ai-engineer | **5**, **6**, **17** | De-risks split-pane + mode switches whether or not a graph runtime is introduced |

---

## Optional bundles (after row 5–7)

- **OpenRouter in BYOK loop** — align `loadByokKeysFromUserVault` / templates with product list (**§I.1**): owner **ai-engineer**, paths **1**, **2**.
- **`SESSION_INIT` / `setRuntimeOverrides`** — commented path in `websocket.ts`: owner **ai-engineer**, paths **1**, **2**, **7** (vault freshness on DO restart).

---

## Definition of Done — self-review

| Criterion | Met? | Notes |
|-----------|------|-------|
| Ordered list with **title**, **owner suggestion**, **dependency on path** | **Yes** | Table columns; path numbers match `architecture-paths.md`. |
| Derived from **Phase 2–3** | **Yes** | Maps Path 2 spikes, Path 5 **§I.3** list, Path 3/4/6 gates, cross-cutting 503/modal, orchestration rows **18–21**. |
| Feeds **Phase 6** | **Yes** | Numbered for epic breakdown; explicit **Blocks / unlocks** column. |
| On-disk under `journal_root/p3-feasibility-crosscheck/outputs/` | **Yes** | |

**Quality gate:** Spikes are **not** effort estimates; Phase 4B / engineering may re-estimate after PoCs.

---

*End of spike backlog.*
