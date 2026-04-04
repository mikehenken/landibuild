# Planning revision gap analysis (2026-04-04)

**Purpose:** Reconcile current on-disk planning artifacts against Phase 0 intent (`p0-intent-and-scope/intent-analysis.md`, `spine.md`) after architect-reviewer / ai-engineer updates to Phase 1D, 2, 3, 1A gaps, and Phase 5 objective review.

**Compared sources:** `p1d-open-canvas-agui-a2ui/p1d-synthesis.md`, `p2-architect-paths/outputs/architecture-paths.md`, `p2-architect-paths/outputs/path-comparison-table.md`, `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md`, `p3-feasibility-crosscheck/outputs/spike-backlog.md`, `p1a-codebase-model-config-byok/outputs/gaps-vs-goals-1-4.md`, `p5-objective-review/objective-review.md`.

**Author:** coordinator (synthesis only; no Phase 1–5 rewrites in this pass).

---

## 1. Summary of updates (by theme)

### 1.1 Non-goals softening (orchestration / stack choices)

- **`p1d-synthesis.md` (Revision note 2026-04-04):** Prior **“Explicit Non-Goals”** framing is reframed as **time-boxed assumptions** and **spike inputs**. LangGraph / graph-style orchestration is a **hypothesis to evaluate**, not forbidden. Full CopilotKit stack is a **velocity vs integration surface** tradeoff; **thin** or **hybrid** adoption is preferred until spikes justify cost.
- **Parallel orchestrators:** Allowed only with an **explicit session hierarchy** (single user-visible thread contract, authoritative mode per operation, defined handoff and config resolution). Undocumented dual brains remain out of scope for production.
- **`architecture-paths.md`:** Path 6 (hybrid external graph) is documented as **high-cost** and **fallback / spike-only** unless a cross-product mandate exists; preferred composite remains **2 + 5** (DO-centric codegen + AG-UI projection).

### 1.2 Orchestration openness vs guardrails

- **Phase 3** (`feasibility-crosscheck.md`): Path 6 verdict is **Blocked** for a **committed roadmap without explicit cross-product mandate**, with an explicit **unblock condition** (mandate + TCO / identity / history sync spike). This aligns with intent’s “not viable only with decisive evidence” while still **defaulting away** from split-brain production.
- **Spike backlog #18** encodes Path 6 as **go/no-go**, default **no**—consistent with guarded openness in p1d.

### 1.3 A2UI scope

- **`p1d-synthesis.md`:** A2UI scoped to **risk-bounded** generative UI in the canvas (sandboxing, validation). **Allowlists**, **hybrid renderers**, and tighter catalogs are explicitly **in play** after security review—not a permanent “never touch shell UI” rule; **default** stays conservative until policy catches up.
- **`architecture-paths.md` Path 5:** Phased generative UI, JSON Patch–style deltas, sandboxing (iframe / allowlist)—matches the tightened security posture.

### 1.4 Spikes and feasibility layering

- **`spike-backlog.md`:** **18** ordered spikes; row **1** (Phase 1C research pack) marked **Done (2026-04-04)** with note that **spike #2** still gates production SSRF sign-off.
- **`feasibility-crosscheck.md`:** Per-path **Feasible / Needs spike / Blocked** with Worker / D1 / DO columns; cross-cutting **503 / config-modal** tensions called out (including `testProvider` vs CRUD split).

---

## 2. Gap analysis table (intent goals vs current stance)

| Goal | Prior / baseline doc claim | Revised stance (current artifacts) | Residual risk | Recommended next spike or decision |
|------|----------------------------|--------------------------------------|---------------|----------------------------------|
| **1** Dynamic provider/model config | Build-time split `AGENT_CONFIG` / `PLATFORM_MODEL_PROVIDERS`; no runtime catalog (`gaps-vs-goals-1-4.md`) | **Path 2** is the platform-shaped answer; Path 1 only as bridge | Catalog and resolution remain unbuilt; env split persists until migration | **Spike #4** (D1 schema sketch), **#5** (resolution PoC) |
| **2** Admin-scoped OpenAI-compatible endpoints | User-level providers; CRUD **503**; `testProvider` can probe `baseUrl`; no agency/super-admin in worker grep | Path **2** (and optionally **3** gateway) with **SSRF discipline** before widening URL surface | User trust hit if UI promises flows that 503; `testProvider` policy may lag CRUD | **Spike #2** (SSRF policy), **#3** (503/modal/API alignment), **#8** (RBAC model) |
| **3** Cross-provider mixing | Per-action user configs exist; **bypasses** in `realtimeCodeFixer`, `PhaseGeneration` (`gaps-vs-goals-1-4.md`) | Feasibility: **inference unification** is a sub-spike inside Path 2, not a Worker limit | Marketing “mixed models” ahead of enforced policy | **Spike #7** (inference path audit + unify) |
| **4** Named preset bundles | Only implicit two-bundle env behavior; no versioned entities | Path 2: versioned bundles + precedence; DO snapshot to avoid drift | Schema and invalidation complexity | **Spike #4**, **#5**, **#6** (DO snapshot + invalidation) |
| **5** Canvas + AG-UI / A2UI | Intent: viability with **protocol-first** posture; open-canvas = UX; CopilotKit = reference | **Path 5** + p1d: native adapter first; CopilotKit optional accelerator; A2UI **risk-bounded** with evolution path | Dual protocol maintenance; reconnect/compaction; XSS; client bundle (R19 + Vite) | **Spikes #11–#16** (envelope, snapshot mapping, static A2UI, deltas, sandbox, CopilotKit matrix) |
| **6** Ask mode in any thread | Intent: additive; server-enforced where safety matters | Path **6** blocked **without mandate**; prefer **2 + 5** + server-side ask tooling | Mode flag, tool surfaces, and WS types not yet specified in code | **Spike #17** (server-enforced ask mode); **#18** only if product mandates Path 6 |

---

## 3. Remaining inconsistencies between documents

| # | Issue | Where | Suggested owner |
|---|--------|--------|-----------------|
| 1 | **Stale quality gate:** “Phase 1C missing on disk at last bundle merge” conflicts with merged p1c outputs, bundle **§B/C/I.5**, `feasibility-crosscheck` caveat, and `p4a` review text. | `architecture-paths.md` (Definition of Done / Quality gates) | **architect-reviewer** — delete or rewrite caveat to “p1c on disk; implementation SSRF still spike-gated.” |
| 2 | **Codegen DO naming:** Intent and `p4a` use `CodeGeneratorAgent` / `codingAgent.ts`; objective review Goal 5 still says `SimpleCodeGeneratorAgent`. | `p5-objective-review/objective-review.md` | **qa-expert** (or **ai-engineer** if qa not rerun) |
| 3 | **Path 6 framing:** Objective review Goal 6 states Path 6 is “explicitly blocked in favor of” DO-only ask; Phase 3 frames **conditional** block (unblock with mandate + spike). Wording should match **blocked by default, spike-unblocked** nuance. | `p5-objective-review/objective-review.md` vs `feasibility-crosscheck.md` | **qa-expert** + **architect-reviewer** (one sentence fix) |
| 4 | **Spine artifacts index:** Rows show **p4a** / **p4b** and **p5** as **Pending** while `p4a-review-research/agent-review.md` and `p5-objective-review/objective-review.md` exist and read complete. | `spine.md` — Artifacts index | **context-manager** |
| 5 | **Missing Phase 4B artifact:** Spine expects `p4b-review-planning/agent-review.md`; path not present on disk (glob: no `p4b` folder). | `spine.md` vs filesystem | **architect-reviewer** or **qa-expert** to produce **p4b** review **or** spine/plan updated to defer 4B |

**Optional note (informational, not a conflict):** `feasibility-crosscheck.md` states bundle **Planning** table path numbering may differ from `architecture-paths.md`; readers should follow **architecture-paths** numbering for Paths 1–6.

---

## 4. Counts (for coordinator handoff)

| Metric | Value |
|--------|--------|
| **Residual outcome gaps** (one per plan goal 1–6 with remaining spike/engineering debt) | **6** |
| **Inter-document inconsistencies** (§3 table rows) | **5** |

---

*End of P6 planning revision gap analysis.*
