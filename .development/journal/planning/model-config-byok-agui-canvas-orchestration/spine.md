# Spine — model-config-byok-agui-canvas-orchestration

Running log for **decisions**, **artifact paths**, **open questions**, and **bundle merge notes**. Maintained by context-manager across phases per `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md`.

**Journal root:** `.development/journal/planning/model-config-byok-agui-canvas-orchestration`  
**Plan:** `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md`  
**State file:** `.cursor/state/model-config-byok-agui-canvas-orchestration.state.md`  
**Canonical research bundle:** `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md`

---

## Decision log

| Date (UTC) | Decision | Rationale |
|------------|----------|-----------|
| 2026-04-04 | Phase 0 intent captured in `p0-intent-and-scope/intent-analysis.md` | Plan requires explicit alignment with fixed scope before Phase 1 parallel tracks. |
| 2026-04-04 | Codegen DO verified as `CodeGeneratorAgent` in `worker/agents/core/codingAgent.ts` | Plan text still says `SimpleCodeGeneratorAgent`; Phase 1 traces should cite `codingAgent.ts` and `worker/agents/index.ts` for stubs. |

---

## Artifacts index

| Phase / task_id | Artifact | Status |
|-----------------|----------|--------|
| p0-intent-and-scope | `p0-intent-and-scope/intent-analysis.md` | Complete |
| p1a-codebase-model-config-byok | `p1a-codebase-model-config-byok/outputs/*.md`, `citation.yaml` if used | **Complete** (merged into bundle **§I.1**, **§I.4**) |
| p1b-codebase-chat-ask-agent-ws | `p1b-codebase-chat-ask-agent-ws/outputs/*.md` | **Complete** (merged into bundle **§I.2**, **§F** cross-ref) |
| p1c-research-byok-tenancy-ssrf | `p1c-research-byok-tenancy-ssrf/outputs/p1c-byok-tenancy-ssrf-synthesis.md`, `outputs/self-review.md`, `citation.yaml` | **Complete** (2026-04-04) — merged into bundle **§B**, **§C**, **§I.0**, **§I.5** |
| p1d-open-canvas-agui-a2ui | `p1d-open-canvas-agui-a2ui/p1d-synthesis.md` | **Complete** (merged into bundle **§I.3**, **§E** cross-ref) |
| Merge gate | Updates to canonical research bundle + this spine map | **Complete** — Phase 1 **1A–1D** including **p1c** merged into canonical bundle |
| p2-architect-paths | `p2-architect-paths/outputs/architecture-paths.md`, `p2-architect-paths/outputs/path-comparison-table.md` | **Complete** (2026-04-04) — preferred composite **Path 2 + Path 5** if viability holds; Phase 3 consumes for feasibility |
| p3-feasibility-crosscheck | `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md`, `spike-backlog.md` | **Complete** (2026-04-04) |
| p4a / p4b | `agent-review.md` under review task folders | Pending |
| p5-objective-review | `objective-review.md` | Pending |
| p6-final-report | Canonical bundle `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md` — **`## Final report`** (Phase 6) | **Complete** (2026-04-04) |

---

## Open questions

1. **Codegen DO (resolved 2026-04-04):** `worker/agents/core/codingAgent.ts` (`CodeGeneratorAgent`). Re-check if renamed; plan wording may lag.
2. **State file:** Ensure `.cursor/state/model-config-byok-agui-canvas-orchestration.state.md` lists one canonical research path once the coordinator starts execution.
3. **Superseded bundles:** If the canonical bundle filename changes, record the old path as **superseded** in state (per orchestration issues index rule).
4. **Phase 1C (resolved 2026-04-04):** `p1c-research-byok-tenancy-ssrf` on disk; canonical bundle **§B** / **§C** / **§I.5** refreshed. Re-open only if security review demands deeper Portkey/vendor advisories or new code paths.

---

## Research bundle merge index (canonical file section map)

**Canonical bundle:** `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md`

The bundle opens with a **Bundle section map** table; below mirrors journal → bundle anchors for Phase 1 handoff.

| Bundle anchor | Topic | Journal / source |
|---------------|--------|------------------|
| **Section map** (top of bundle) | All sections A–I navigation | coordinator + context-manager (1C merge fix) |
| **1** | Intent | `p0-intent-and-scope/intent-analysis.md`, plan scope |
| **A** | Dynamic model config | **§I.1**, **§I.4** + `p1a-codebase-model-config-byok/outputs/p1a-codebase-trace.md`, `gaps-vs-goals-1-4.md` |
| **B** | BYOK | **§I.5** digest + body refresh; `p1c-research-byok-tenancy-ssrf/outputs/p1c-byok-tenancy-ssrf-synthesis.md`, `citation.yaml` |
| **C** | Custom providers / SSRF | **§I.5** + **§I.1** (`testProvider`, 503 CRUD); same **p1c** journal path |
| **D** | Preset bundles | **§I.1**, **§I.4** + p1a gaps table |
| **E** | AG-UI / open-canvas | **§I.3** + `p1d-open-canvas-agui-a2ui/p1d-synthesis.md`; prior search-specialist URLs in **E** body |
| **F** | Ask mode | **§I.2** + `p1b-codebase-chat-ask-agent-ws/outputs/code-trace-chat-ws-ask-agent.md` |
| **G** | Data model sketch | coordinator synthesis (no p1 journal file) |
| **H** | Unknowns | open items **§H** (no longer “p1c missing on disk”) |
| **I** | Phase 1 merged digest | **§I.0–I.5** — p1a, p1b, **p1c**, p1d |
| **Planning** | Architectural paths | `p2-architect-paths/outputs/architecture-paths.md` + `path-comparison-table.md` (Phase 2); bundle **Planning** table |
| **Coordinator review** | DoD table | Phase 1 merge gate **Yes** (post–p1c merge) |
| **Recommendations** | Next steps | coordinator |
| **Intent trace** | DoD matrix | coordinator + merge gate row (1A–1D complete) |

*Before Phase 6 final report: keep this index aligned if bundle sections are renamed; mark superseded bundle filenames in `.cursor/state/model-config-byok-agui-canvas-orchestration.state.md` per issues index.*

---

## Changelog

- **2026-04-04 (planning revision):** Product discussion **revised strategic framing** for orchestration and canvas planning: **non-goals** language in **p1d** and **p2** was softened to **scope boundaries / working assumptions** and **hypothesis evaluation** (LangGraph, fuller CopilotKit stack, Path 6). Updated files: `p1d-open-canvas-agui-a2ui/p1d-synthesis.md`, `p2-architect-paths/outputs/architecture-paths.md`, `p2-architect-paths/outputs/path-comparison-table.md`. **Gap analysis** consolidating deltas vs prior assumptions: **`p6-planning-revision-gap-analysis-2026-04-04.md`** (journal root).
- **2026-04-04:** Phase 6 — **`## Final report`** appended to canonical research bundle (`model-config-byok-canvas-2026-04-04.md`): executive summary, research + citation table (AMA style per `citation-tracking.md`), **p2**/**p3** planning summary and feasibility matrix, linked spike backlog, non-decisions, engineering handoff; bundle section map row **Final report** added.
- **2026-04-04:** Phase 3 — `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` (Paths 1–6 verdicts + Worker/D1/DO + 503/config-modal tensions + DoD self-review) and `spike-backlog.md` (18 ordered spikes for Phase 6).
- **2026-04-04:** Phase 2 — `p2-architect-paths/outputs/architecture-paths.md` (six paths, preferred **2+5**, DoD self-review) and `path-comparison-table.md` (goals + NFR matrix) written for Phase 3 / 4B.
- **2026-04-04:** Phase 1 merge gate — folded **p1a**, **p1b**, **p1d** into canonical bundle **§I**; updated bundle section map and cross-refs (**A**, **B**, **C**, **E**, **F**); **p1c** absent on disk — documented in bundle **§I.0**, **§H.6**, coordinator table; replaced spine merge placeholder with section map above.
- **2026-04-04 (later):** **Phase 1C fix** — added `p1c-research-byok-tenancy-ssrf/` (`p1c-byok-tenancy-ssrf-synthesis.md`, `self-review.md`, `citation.yaml`); merged into bundle **§B**, **§C**, **§I.0**, **§I.5**; spine artifacts index + merge index updated; **§H** p1c blocker replaced with engineering follow-ups.
- **2026-04-04:** Initialized spine; registered Phase 0 deliverable and Phase 1–6 artifact expectations from plan.
