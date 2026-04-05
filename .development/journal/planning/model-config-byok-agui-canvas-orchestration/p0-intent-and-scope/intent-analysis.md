# Intent and scope — model-config-byok-agui-canvas-orchestration

**Phase:** `p0-intent-and-scope`  
**Agent:** context-manager  
**Canonical plan:** `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md`  
**Research bundle (canonical):** `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md`  
**Workflow state file:** `.cursor/state/model-config-byok-agui-canvas-orchestration.state.md`

---

## Refresh 2026-04-04

An earlier pass of this workflow already produced on-disk artifacts: Phase **1A–1D** traces and synthesis under `journal_root/p1*/`, Phase **2–3** planning (`p2-architect-paths/outputs/`, `p3-feasibility-crosscheck/outputs/`), merge into the canonical research bundle (including **`## Final report`**), `spine.md` section map, and `p6-planning-revision-gap-analysis-2026-04-04.md`. **This refresh of `intent-analysis.md` does not replace those deliverables**; it **deepens** Phase 0 framing for a workflow rerun or audit by:

- Separating **explicit / implicit / non-goals** and adding **success criteria** tied to the plan’s workflow checks.
- Locking **mandatory Phase 1 verification paths** (plan table + coordinator-required files) with **symbol-level reconciliation** where plan text lags the repo.
- Calling out **citation and gap expectations** so new Phase 1 work or re-review can align claims to `path:line` or labeled hypotheses per plan §“Workflow success checks”.

---

## 1. Workflow intent

This workflow produces **research, multi-path planning, and a coordinator-reviewed final report** for how Landi Build could evolve **dynamic model configuration**, **BYOK and admin-scoped OpenAI-compatible providers**, **preset bundles**, **canvas-style UX**, and **AG-UI / A2UI viability** (with CopilotKit as a reference accelerator), plus **ask mode in any chat**—**without removing** existing agent/codegen flows.

**Primary audience:** multi-agent-coordinator and downstream phase owners (research, architecture, feasibility, review).

**Primary output shape:** inspectable markdown under `journal_root`, merged Phase 1 material in the **single** canonical research bundle, Phase 2–3 on-disk planning artifacts, reviews, objective checklist, and a **written final report** (not chat-only)—per plan “How to use” and orchestration issues index (one canonical bundle path; supersede old filenames in state if renamed).

---

## 2. Explicit goals (plan “Outcomes we want” 1–6)

| # | Goal | Notes |
|---|------|--------|
| 1 | **Dynamic provider/model configuration** | More dynamic than the current build-time split between `AGENT_CONFIG` (`worker/agents/inferutils/config.ts`) and platform provider exposure (`PLATFORM_MODEL_PROVIDERS` in `worker/api/controllers/modelConfig/byokHelper.ts`). |
| 2 | **Admin-scoped OpenAI-compatible endpoints** | Super-admins and agency admins register base URLs, attach models, set options; **outbound call** and **secrets** security are first-class. |
| 3 | **Cross-provider mixing** | Confirm how far templates/agent actions already mix models across providers; document **D1/policy** gaps if any. |
| 4 | **Named preset bundles** | e.g. gemini- vs claude-centric bundles at **platform, agency, or user** level with explicit **precedence**. |
| 5 | **Canvas UX + AG-UI / A2UI design** | Viability and design for a canvas-style right pane and AG-UI/A2UI **alongside** the codegen Durable Object and current WebSocket protocol. **open-canvas** = UX patterns only; **CopilotKit** = secondary cross-check; **AG-UI / A2UI protocols** = architectural north star. |
| 6 | **Ask mode** | General chat (optional platform capabilities) in any thread **without** breaking the existing codegen agent path. |

---

## 3. Implicit goals and expectations

These are not always spelled out line-by-line in the plan table but follow from **Scope (fixed)** and **Stance on AG-UI / A2UI**:

- **Pathfinding over cataloging:** Each major risk should pair with a **mitigation or spike**; reserve “not viable” for **evidence-backed** blockers.
- **Smallest shippable bridge:** Prefer the **minimal integration step** that preserves the codegen agent and PartySocket where the plan demands it.
- **Traceable repo claims:** Later phases tie statements to **path:line** or mark **hypothesis** (plan workflow success check 5).
- **Merge discipline:** Parallel research lands in **one** canonical bundle; stray “final” markdown must point to it or be marked superseded (plan preamble + issues index).
- **Planning is on disk:** Phases 2–3 each produce at least one markdown file under `journal_root/<task_id>/`; chat-only summaries do not satisfy the plan.
- **Independent review:** Phase 4 reviewers differ from primary authors per `.cursor/agents/orchestration/features/agent-review-cycle.md`.

---

## 4. Non-goals

| Category | Non-goal |
|----------|----------|
| **This workflow** | Implementing production features (plan **Out of scope**). |
| **Architecture** | Treating CopilotKit or open-canvas as the **sole** anchor; vendor shells are references, not replacements for protocol-first design. |
| **Platform** | Removing or silently regressing shipped behavior without product sign-off (`NEVER_REMOVE_FEATURES`). |
| **AG-UI / A2UI** | Premature “walk away” framing without decisive evidence; default posture is **how to proceed** within Worker/DO/PartySocket constraints. |
| **Documentation drift** | Using legacy doc names for the codegen DO in **new** citations when the live export is `CodeGeneratorAgent` (see §8). |

---

## 5. Success criteria

### 5.1 Workflow (plan §“Workflow success checks”)

1. State file lists **one** canonical research path; any extra finals reference it or are **superseded**.
2. Phases 1–3 leave **inspectable files** under `journal_root` (research **and** `p2` / `p3` outputs before Phase 4B).
3. Phase 4 meets quality threshold or stops with **fail_safe** and a clear blocked reason in state.
4. Final report exists at the agreed path; includes citations, path-forward summary, and a **planning** subsection grounded in Phase 2–3 files.
5. Repo claims are tied to **paths/lines** or labeled **hypothesis**.

### 5.2 Phase 1 verification (per track)

- **1A:** Table of gaps vs goals **1–4** with **file:line** pointers; trace `AGENT_CONFIG` through inference and overrides.
- **1B:** Trace `handle-websocket-message` (client), server/agent WS boundary, and a concrete **plug-in point** for per-thread ask vs agent mode **without** replacing the codegen DO.
- **1C:** BYOK, tenancy, SSRF patterns with **citation.yaml** and project citation format; tie industry guidance to **actual** enforcement paths in code.
- **1D:** Merged synthesis: ranked integration options, **recommended first spike**, mitigations per risk, explicit non-goals, ordered spike list; **protocol-first** narrative with CopilotKit cross-check.

---

## 6. Constraints (plan §“Constraints”)

- **Stack:** Workers, D1, Durable Objects, PartySocket as they exist today.
- **Features:** Do not remove shipped behavior without explicit product sign-off.
- **Secrets:** Encryption at rest, auditable admin changes, no raw keys in logs.

---

## 7. Out of scope (plan §“Out of scope”)

- **Implementing** the researched features inside this workflow; outputs are **research, options, and spikes** (plus planning artifacts in Phases 2–3).

---

## 8. CodeGeneratorAgent vs `SimpleCodeGeneratorAgent` (reconciliation)

The **plan** and some **internal docs** refer to **`SimpleCodeGeneratorAgent`** (e.g. `.cursorrules`, `CLAUDE.md`, `docs/llm.md`, objective-review drafts). The **running Worker codebase** exports and implements the codegen session Durable Object as **`CodeGeneratorAgent`**.

**Live symbols (verify on branch):**

```42:42:worker/agents/core/codingAgent.ts
export class CodeGeneratorAgent extends Agent<Env, AgentState> implements AgentInfrastructure<AgentState> {
```

```16:16:worker/index.ts
export { CodeGeneratorAgent } from './agents/core/codingAgent';
```

**Resolution for Phase 1 and all new citations:**

- Use **`CodeGeneratorAgent`** and **`worker/agents/core/codingAgent.ts`** for codegen DO behavior, state machine, and WebSocket handling.
- Treat **`SimpleCodeGeneratorAgent`** as a **legacy/documentation alias** unless grep shows a live class with that name (as of 2026-04-04 it does not appear in `worker/**/*.ts`).
- When quoting the **plan verbatim**, add a bracket note if needed: “plan: SimpleCodeGeneratorAgent; implementation: `CodeGeneratorAgent`.”

Related stubs and WS typing: `worker/agents/index.ts` (`getAgentStub` / `CodeGeneratorAgent`), `worker/agents/core/websocket.ts` (`CodeGeneratorAgent` in handlers).

---

## 9. Phase 1 verification — repo paths

Phase 1 must **re-verify** these paths in the current tree (line-accurate notes belong in **1A–1D outputs**). The following **mandatory** set matches the plan’s “Code to ground the work” table plus coordinator-critical chat/agent surfaces.

### 9.1 Mandatory paths (plan table + agent/chat core)

| Path | Verify |
|------|--------|
| `worker/agents/inferutils/config.ts` | `COMMON_AGENT_CONFIGS`, `PLATFORM_AGENT_CONFIG`, `DEFAULT_AGENT_CONFIG`, exported `AGENT_CONFIG`; relationship to `PLATFORM_MODEL_PROVIDERS`. |
| `worker/agents/inferutils/infer.ts` | Runtime inference entry, overrides, provider/model resolution. |
| `worker/agents/inferutils/core.ts` | Merge of defaults with `userApiKeys` / runtime paths. |
| `worker/api/controllers/modelConfig/byokHelper.ts` | `PLATFORM_MODEL_PROVIDERS`, validation/access patterns for BYOK surfaces. |
| `worker/api/controllers/modelProviders/controller.ts` | Custom provider HTTP API; **503** on some CRUD (capture **as-is** for feasibility). |
| `src/routes/chat/utils/handle-websocket-message.ts` | Client WS handling, dedupe, routing; where **ask mode** UX would observe agent messages. |
| `worker/agents/core/codingAgent.ts` | **`CodeGeneratorAgent`** — state, behaviors, ticket/WS integration; per-thread mode hooks. |

### 9.2 Strongly recommended (1B / 1D / bundle cross-refs)

| Path | Verify |
|------|--------|
| `worker/api/websocketTypes.ts` | Shared WS message shapes for any AG-UI adapter mapping. |
| `worker/agents/core/websocket.ts` | Server-side WS bridge to `CodeGeneratorAgent`; PartySocket boundary. |
| `worker/agents/index.ts` | DO stub resolution for `CodeGeneratorAgent`. |
| `worker/types/secretsTemplates.ts` | BYOK / vault template surface if still authoritative. |
| `src/routes/chat/` (layout/shell) | Attachment point for split-pane / canvas right pane. |
| `vite.config.ts` (and chat chunking) | Client bundle impact of AG-UI-aware dependencies. |
| `worker/services/secrets/` + D1 services on model policy | Ground 1C claims in real enforcement. |

**If paths move:** Record replacements in the canonical bundle and `journal_root/spine.md` (merge index).

---

## 10. Quality gates relevant to Phase 0

- **Alignment:** This document mirrors the plan’s fixed scope, constraints, out-of-scope boundary, and AG-UI/A2UI posture.
- **Traceability:** Downstream work uses **path:line** or explicit **hypothesis** labels.
- **Artifacts:** Phase 0 **frames** Phase 1; it does not substitute the canonical research bundle or Phase 2–3 files.

---

## 11. Definition of Done — Phase 0 self-check

| Criterion | Status |
|-----------|--------|
| `intent-analysis.md` under `journal_root/p0-intent-and-scope/` | Done (this refresh) |
| Aligns with plan outcomes **1–6**, constraints, out of scope, AG-UI/A2UI stance | Done |
| Explicit / implicit / non-goals and **success criteria** documented | Done |
| **Mandatory** Phase 1 paths listed; **`CodeGeneratorAgent` vs plan naming** reconciled with citations | Done |
| `spine.md` at `journal_root/` logs artifact and routing metadata | See `../spine.md` |
| No implementation work claimed for this phase | Done |

**Residual risks for downstream:** Review artifacts (`p5-objective-review/objective-review.md`, etc.) may still say `SimpleCodeGeneratorAgent`; align them to **`CodeGeneratorAgent`** when edited. Keep a single active canonical bundle path in `.cursor/state/model-config-byok-agui-canvas-orchestration.state.md`.
