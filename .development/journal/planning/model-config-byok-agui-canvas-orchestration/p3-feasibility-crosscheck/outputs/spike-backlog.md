# Spike backlog — Phase 3 (`p3-feasibility-crosscheck`)

**Purpose:** Ordered inputs for **Phase 6** final report and engineering epics.  
**Sources:** Phase 2 paths (`architecture-paths.md`, `path-comparison-table.md`), canonical bundle **§I**, **§H**, `gaps-vs-goals-1-4.md`, p1d digest **§I.4**.  
**Fields:** **Title**, **Owner suggestion** (role/discipline), **Depends on path** (1–7 from `architecture-paths.md`), **Blocks / unlocks** (short).

Order is **dependency-first**: research and security gates before large schema work; inference parity (including recursive `runtimeOverrides`) before marketing mixed-provider behavior; protocol spikes before heavy UI investment.

**Spike count:** **26** numbered rows (≥18 required).

**Orchestration selection:** Rows **23–26** are **path-selection gates** for LangGraph-class vs native DO vs CopilotKit depth. Run early enough to inform Phase 6 / epics but **after** SSRF alignment (**#2–3**) where hybrid options touch outbound policy.

---

| # | Title | Owner suggestion | Depends on path | Blocks / unlocks |
|---|--------|------------------|-----------------|------------------|
| 1 | **Phase 1C — BYOK, tenancy, SSRF research pack** (merged to bundle) | research-analyst + security-engineer | **2**, **4**, **7** | **Done (2026-04-04):** journal + bundle **§B** / **§C** / **§I.5** — **#2** still gates production SSRF sign-off |
| 2 | **Worker SSRF policy design** for user/tenant `fetch` to OpenAI-compatible bases (allowlist, DNS→IP, redirects, timeouts, logging redaction) | security-engineer + platform-engineer (Workers) | **2**, **3**, **4** (if Worker probes URLs) | Unblocks re-enabling or restricting **`testProvider`** alongside CRUD |
| 3 | **503 / config-modal / API alignment** — single story for “custom providers,” BYOK vault, disabled CRUD, and live `testProvider` behavior | frontend engineer + product | **1**, **2**, **3**, **4**, **6** | Reduces user confusion; defines copy for gateway path |
| 4 | **D1 schema sketch + migration plan** for catalog rows, versioned bundles, assignments (platform / agency / user precedence) | platform-engineer + architect-reviewer | **2**, **4**, **7** | Core of Path 2; pointer metadata for Path 7; snapshot source for Path 4 |
| 5 | **Resolution service PoC** — merge precedence, seed from `PLATFORM_AGENT_CONFIG` / `DEFAULT_AGENT_CONFIG`, parity tests | platform-engineer | **2**, **7** | Proves D1 read pattern + cache strategy for DO |
| 6 | **DO session config snapshot + invalidation** — when admin/user changes bundle, reconnect vs push update | engineer familiar with `CodeGeneratorAgent` / websocket | **2**, **4**, **7** | Prevents mid-turn drift; Path 7 artifact version bumps |
| 7 | **Recursive `infer` forwards `runtimeOverrides`** — tool-follow-up hops preserve BYOK / merged keys (`core.ts:946-987` contract) | ai-engineer | **1**, **2**, **3**, **4**, **6** | **Hard gate** for G3 credibility; pairs with **#8** |
| 8 | **Inference path audit + unify bypasses** — `realtimeCodeFixer`, `PhaseGeneration`, `getInferenceContext`, `SESSION_INIT`, DO `onStart` vault replay | ai-engineer | **1**, **2**, **6** | Closes **§I.1** gaps; complements **#7** |
| 9 | **`SESSION_INIT` / WS credential refresh vs DO `onStart`** — vault → `runtimeOverrides` on reconnect and after DO restart | ai-engineer | **1**, **2** | Aligns HTTP session start with long-lived WS sessions |
| 10 | **BYOK template ↔ inference alignment** (e.g. OpenRouter in `getBYOKTemplates()` loop) | ai-engineer | **1**, **2** | New providers do not silently skip vault load |
| 11 | **Agency / super-admin RBAC model** — D1 identity, roles, who may define providers vs bundles | architect-reviewer + product | **2**, **4**, **6**, **7** | **G2**; no grep hits today |
| 12 | **External gateway shortlist + integration PoC** (virtual key or route token, latency + streaming) | devops-engineer + platform-engineer | **3** | Build-vs-buy; pairs with **2+3** composite |
| 13 | **Control plane vs monolithic Path 2 decision** — when snapshot/KV invalidation beats second service | architect-reviewer | **4** | Avoids building Path 4 prematurely |
| 14 | **R2/KV immutable bundle pipeline** — publish, hash, promotion, Worker fetch + DO warm cache | platform-engineer + devops-engineer | **7** | **G4** rollback/SKU story; pairs with **4–6** |
| 15 | **Bundle artifact integrity** — signing, tamper detection, version skew handling on reconnect | security-engineer + platform-engineer | **7** | Trust model for Path 7 + Path 4 snapshots |
| 16 | **AG-UI event envelope on PartySocket** (S1 — `RUN_*` / `TEXT_MESSAGE_*`) | ai-engineer + frontend engineer | **5** | First **§I.4** spike; de-risks dual protocol |
| 17 | **`CodeGenState` ↔ AG-UI snapshot mapping + reconnect** (S2–S3) | ai-engineer | **5** | State restoration parity |
| 18 | **Static A2UI spec from Worker + split-pane render** (S5 read-only) | frontend engineer | **5** | Canvas UX proof without full streaming |
| 19 | **Streaming patch / deltas** (S6 — JSON Patch or AG-UI delta style) | ai-engineer | **5** | WebSocket bloat mitigation |
| 20 | **A2UI renderer sandbox** (iframe / strict allowlist / CSP) (S5–S7) | frontend engineer + security-engineer | **5** | XSS governance for generative UI |
| 21 | **CopilotKit vs hand-rolled client** — React 19 + Vite matrix, bundle size sample | frontend engineer | **5** | Accelerate vs own tradeoff |
| 22 | **Ask mode — server-enforced** mode flag, tool allowlist, `user_suggestion` / `websocketTypes`, choke `handleUserInput` | ai-engineer | **1**, **2**, **6** | **G6**; Path 5 does not replace server gate |
| 23 | **Hybrid / external orchestration mandate + integration spike** — TCO, history sync, dual config, single policy (LangGraph-class or other) | product + architect-reviewer + ai-engineer | **6** | Path 6 go/no-go |
| 24 | **LangGraph (or subgraph) ↔ DO boundary** — checkpoints, single writer, streaming, Worker limits | ai-engineer + platform-engineer | **5**, **6** | In-DO vs external vs client-only orchestration |
| 25 | **CopilotKit full-stack vs adapter-only** — runtime ownership, extends **#21** | frontend engineer + ai-engineer | **5**, **6** | Depth of CopilotKit adoption |
| 26 | **Dual-page / dual-mode orchestration** — one thread: codegen + ask + canvas; WS multiplexing; conflict rules | product + frontend engineer + ai-engineer | **5**, **6**, **22** | Split-pane + mode switches |

---

## Path coverage quick map

| Path | Primary spike rows |
|------|-------------------|
| **1** | 3, 7–10, 22 |
| **2** | 2–11, 7–10, 22 |
| **3** | 2, 3, 12 |
| **4** | 2, 4–6, 8, 11, 13, 15 |
| **5** | 16–21, 24–26 |
| **6** | 3, 8, 11, 23–26 |
| **7** | 4–6, 14–15 |

---

## Definition of Done — self-review

| Criterion | Met? | Notes |
|-----------|------|-------|
| Ordered list with **title**, **owner suggestion**, **dependency on path** | **Yes** | Table columns; paths **1–7**. |
| **≥18 spikes** when justified | **Yes** | **26** numbered rows (includes Path 7 pipeline, recursive `infer`, `SESSION_INIT`, template alignment). |
| Derived from **Phase 2 (7 paths)** + bundle | **Yes** | Maps Path 2/7 resolution, Path 5 **§I.4**, Path 3/4/6 gates, 503/modal, orchestration rows. |
| Feeds **Phase 6** | **Yes** | Numbered for epic breakdown; **Blocks / unlocks** column. |
| On-disk under `journal_root/p3-feasibility-crosscheck/outputs/` | **Yes** | |

**Quality gate:** Spikes are **not** effort estimates; Phase 4B / engineering may re-estimate after PoCs.

---

*End of spike backlog (refreshed for seven paths; 26 spikes).*
