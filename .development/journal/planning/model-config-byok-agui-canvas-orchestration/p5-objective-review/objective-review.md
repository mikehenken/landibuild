# Phase 5 — Objective review (`p5-objective-review`)

**Task:** `p5-objective-review`  
**Agent:** qa-expert  
**Date:** 2026-04-05  
**Plan:** `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md`  
**Intent source:** `p0-intent-and-scope/intent-analysis.md` (goals 1–6, constraints §6)

**Canonical research bundle:** `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md`

---

## Phase 4 review scores (evidence quality for this mapping)

| Phase | Artifact | Score | Threshold |
|-------|----------|-------|-----------|
| **4A** | `p4a-review-research/agent-review.md` | **95 / 100** | 90% — **PASS** |
| **4B** | `p4b-review-planning/agent-review.md` | **92 / 100** | 90% — **PASS** |

Use 4A for **research/bundle** traceability (goals 1–6 proof table in `p4a-review-research/agent-review.md`). Use 4B for **planning/spike** coherence (goals 1–6 proof table and gap list in `p4b-review-planning/agent-review.md`).

---

## Plan scope (locked)

- **Outcomes:** Dynamic model config (G1); admin-scoped OpenAI-compatible endpoints and outbound/secrets discipline (G2); cross-provider mixing with documented policy gaps (G3); named preset bundles and precedence (G4); canvas + AG-UI / A2UI alongside codegen DO and WebSocket (G5); ask mode in any thread without removing codegen (G6).
- **Out of scope for this workflow:** Implementing production features (research, options, spikes, and on-disk planning only).
- **Naming:** Product/codegen session authority is **`CodeGeneratorAgent`** (`worker/agents/core/codingAgent.ts`); plan legacy text may say `SimpleCodeGeneratorAgent` — see `intent-analysis.md` §8.

---

## Intent-to-evidence matrix (goals 1–6)

Each row ties the **plan outcome** (from `intent-analysis.md` §2) to **bundle sections**, **on-disk journal paths**, and **Phase 4** goal-level proof.

| Goal | Intent (summary) | Canonical bundle | Journal / planning files | Phase 4 scores (goal-level) |
|------|------------------|------------------|---------------------------|-----------------------------|
| **G1** | Dynamic provider/model configuration beyond build-time `AGENT_CONFIG` vs `PLATFORM_MODEL_PROVIDERS` | **§A**, **§D**, **§I.1**, **§I.5** (Goal 1 table) | `p1a-codebase-model-config-byok/outputs/p1a-codebase-trace.md`, `outputs/gaps-vs-goals-1-4.md`; `p2-architect-paths/outputs/architecture-paths.md` (Paths 1–2, 3); `p2-architect-paths/outputs/path-comparison-table.md` (G1 column); `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` (Path 1–2); `p3-feasibility-crosscheck/outputs/spike-backlog.md` **#4–5** | **4A:** proof row G1 (bundle §A / §I.5 + repo cites in `agent-review.md`). **4B:** proof row G1 — Path 2 primary, Path 1 bridge. |
| **G2** | Super-admins / agency admins; OpenAI-compatible endpoints; outbound + secrets first-class | **§B**, **§C**, **§I.3**, **§I.5** (Goal 2 table) | `p1c-research-byok-tenancy-ssrf/outputs/p1c-byok-tenancy-ssrf-synthesis.md`, `p1c-research-byok-tenancy-ssrf/citation.yaml`; `feasibility-crosscheck.md` (503 vs `testProvider`, Path 1–4); `spike-backlog.md` **#2–3**, **#11** | **4A:** proof row G2 + OWASP / `LandiBuild-WORKER-ModelProvidersController` cites. **4B:** proof row G2 — spikes **2, 3, 11** gate production widen. |
| **G3** | Mix models across providers/actions; document D1/policy gaps | **§I.1**, **§I.5** (Goal 3 + cross-cutting table), exec summary | `p1a/outputs/gaps-vs-goals-1-4.md`; `feasibility-crosscheck.md` (recursive `runtimeOverrides` cross-cutting); `spike-backlog.md` **#7–10** | **4A:** proof row G3 (`core.ts` recursion, `realtimeCodeFixer`, `PhaseGeneration`, constraints). **4B:** proof row G3 — **#7** hard gate + **#8** paired. |
| **G4** | Named preset bundles; platform / agency / user precedence | **§D**, **§G**, **§I.5** (Goal 4 table) | `p1a/outputs/gaps-vs-goals-1-4.md`; `architecture-paths.md` Paths **2**, **7**; `path-comparison-table.md`; `feasibility-crosscheck.md` Path 2/7; `spike-backlog.md` **#4–6**, **#14–15** | **4A:** proof row G4. **4B:** proof row G4 — Path 7 optional strengthener. |
| **G5** | Canvas UX + AG-UI / A2UI with `CodeGeneratorAgent` + PartySocket; CopilotKit cross-check | **§E**, **§I.2** (AG-UI mapping), **§I.4** (spikes S1–S10) | `p1d-open-canvas-agui-a2ui/p1d-synthesis.md`, `p1d-open-canvas-agui-a2ui/citation.yaml`; `p1b/outputs/code-trace-chat-ws-ask-agent.md` (WS seams); `architecture-paths.md` Path **5**; `feasibility-crosscheck.md` Path 5; `spike-backlog.md` **#16–21**, **#23–26** (orchestration) | **4A:** proof row G5 (`websocket.ts`, `handle-websocket-message.ts`). **4B:** proof row G5 — Path 5 + spikes **16–21**; G6 **not** from Path 5 alone. |
| **G6** | Ask mode in any thread without breaking codegen | **§F**, **§I.2** | `p1b/outputs/code-trace-chat-ws-ask-agent.md`; `architecture-paths.md` G6 / Path 1–2 / Path 6 notes; `path-comparison-table.md` “Ask mode (G6) enforcement”; `feasibility-crosscheck.md` (Path 5–6); `spike-backlog.md` **#22**, **#26** | **4A:** proof row G6 (`chat.tsx`, `websocket.ts`, `codingAgent.ts`). **4B:** proof row G6 — **#22** + **#26**. |

**Preferred planning composite (4B-aligned):** **Path 2 + Path 5**, optional **+7** for immutable G4 artifacts — see `architecture-paths.md` and `p4b-review-planning/agent-review.md`.

---

## Constraints (plan §“Constraints”) — evidence map

| Constraint | Intent text (`intent-analysis.md` §6) | Evidence |
|------------|----------------------------------------|----------|
| **Stack** | Workers, D1, Durable Objects, PartySocket as today | Bundle exec summary; **§I.2** PartySocket; `architecture-paths.md` scope recap; `feasibility-crosscheck.md` Worker / D1 / DO columns; **4B** path fit checks. |
| **Features** | Do not remove shipped behavior without explicit product sign-off | `intent-analysis.md` §4 (non-goals, `NEVER_REMOVE_FEATURES`); bundle recommendations (additive posture); `architecture-paths.md` constraints row. |
| **Secrets** | Encryption at rest, auditable admin changes, no raw keys in logs | Bundle **§B** (vault, templates); `p1c` synthesis + `citation.yaml`; `feasibility-crosscheck.md` (SSRF / outbound); spike **#2** (SSRF design, logging redaction); **4A** external citations factor 23/25. |

---

## Backlog — open items (rows)

Sources: bundle **§H**; `spike-backlog.md` **#1–26**; Phase 4A gaps **G-1–G-6**; Phase 4B gaps **G-A–G-C**.

| ID | Category | Item | Owner / pointer |
|----|----------|------|-----------------|
| B-1 | Spike | **#2** — Worker SSRF policy (allowlist, DNS/IP, redirects, timeouts) before widening `testProvider` / CRUD | `spike-backlog.md`; bundle **§C**, **§H.2** |
| B-2 | Spike | **#3** — 503 / config-modal / API copy alignment (custom providers vs BYOK vs live `testProvider`) | `feasibility-crosscheck.md` cross-cutting; **4B** G2 |
| B-3 | Spike | **#4–6** — D1 schema, resolution PoC, DO snapshot + invalidation | G1, G4; `architecture-paths.md` Path 2 |
| B-4 | Spike | **#7–10** — Recursive `infer` `runtimeOverrides`; inference audit; `SESSION_INIT` / vault replay; BYOK template alignment | G3; bundle **§I.1**; **4A** hallucination check |
| B-5 | Spike | **#11** — Agency / super-admin RBAC (no worker grep hits today) | G2, G4; bundle **§I.1** |
| B-6 | Spike | **#12–15** — Gateway PoC; Path 4 vs 2; R2/KV bundle pipeline; artifact integrity | Paths 3–4, 7 |
| B-7 | Spike | **#16–21** — AG-UI envelope S1; snapshot/reconnect S2–S3; A2UI static + sandbox; streaming deltas; CopilotKit vs hand-rolled | G5; bundle **§I.4**, **§H.1**, **§H.3** |
| B-8 | Spike | **#22** — Server-enforced ask mode (`AgentState`, choke `handleUserInput`, tool allowlist) | G6; bundle **§F** |
| B-9 | Spike | **#23–26** — Orchestration mandate; LangGraph/DO boundary; CopilotKit depth; dual-mode multiplexing | **4B** G-A; `feasibility-crosscheck.md` orchestration stack |
| B-10 | Research / hygiene | **§H** unknowns — AG-UI schema vs `websocketTypes.ts`; agency identity if mandated; Bifrost cross-repo (**§H.7**) | Bundle **§H** |
| B-11 | 4A follow-up | **G-1** — Refresh bundle line anchors on next edit | `agent-review.md` |
| B-12 | 4A follow-up | **G-4** — Re-grep tenancy symbols on future branches before compliance use | `agent-review.md` |
| B-13 | 4B follow-up | **G-B** — Clarify boundary between spike **#8** (audit bypasses) and **#10** (template loop) in epic planning | `p4b-review-planning/agent-review.md` |
| B-14 | 4B follow-up | **G-C** — Bundle **§Planning** table path numbering vs `architecture-paths.md` — cross-index in state/bundle when editing | `p4b-review-planning/agent-review.md`; `feasibility-crosscheck.md` DoD |

---

## Definition of Done — Phase 5

| Criterion | Met? |
|-----------|------|
| Each plan goal **1–6** mapped to bundle sections + journal/planning paths + Phase 4 scores | **Yes** |
| Plan **constraints** mapped to evidence | **Yes** |
| Phase 4 scores stated (**4A 95/100**, **4B 92/100**) | **Yes** |
| Backlog rows for open items | **Yes** (table above) |
| Output path | `.development/journal/planning/model-config-byok-agui-canvas-orchestration/p5-objective-review/objective-review.md` |

---

*End of Phase 5 objective review.*
