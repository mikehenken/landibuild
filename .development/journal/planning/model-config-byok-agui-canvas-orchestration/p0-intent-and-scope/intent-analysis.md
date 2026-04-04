# Intent and scope — model-config-byok-agui-canvas-orchestration

**Phase:** `p0-intent-and-scope`  
**Agent:** context-manager  
**Canonical plan:** `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md`  
**Research bundle (canonical):** `.cursor/state/research-bundles/model-config-byok-canvas-2026-04-04.md`  
**Workflow state file:** `.cursor/state/model-config-byok-agui-canvas-orchestration.state.md`

---

## 1. Workflow intent

This workflow produces **research, multi-path planning, and a coordinator-reviewed final report** for how Landi Build could evolve **dynamic model configuration**, **BYOK and admin-scoped OpenAI-compatible providers**, **preset bundles**, **canvas-style UX**, and **AG-UI / A2UI viability** (with CopilotKit as a reference accelerator), plus **ask mode in any chat**—**without removing** existing agent/codegen flows.

**Primary audience:** multi-agent-coordinator and downstream phase owners (research, architecture, feasibility, review).

**Primary output shape:** inspectable markdown under `journal_root` (this tree), merged Phase 1 material in the canonical research bundle, then Phase 2–3 on-disk planning artifacts, reviews, objective checklist, and a **written final report** (not chat-only).

---

## 2. Explicit goals (aligned with plan scope)

These map to the plan’s **Outcomes we want** (items 1–6):

| # | Goal | Notes |
|---|------|--------|
| 1 | **Dynamic provider/model configuration** | Move beyond the current build-time split between `AGENT_CONFIG` and `PLATFORM_MODEL_PROVIDERS` toward configurable providers, models, and per-model settings. |
| 2 | **Admin-scoped OpenAI-compatible endpoints** | Super-admins and agency admins can register base URLs, attach models, and set options, with strong security for outbound calls and secrets. |
| 3 | **Cross-provider mixing** | Confirm current support for mixing models from different providers across templates/agent actions; document D1/policy gaps if any. |
| 4 | **Named preset bundles** | e.g. gemini- vs claude-centric bundles applicable at platform, agency, or user level, with an explicit **precedence** story. |
| 5 | **Canvas UX + AG-UI / A2UI design** | Viability and design for a canvas-style right pane and AG-UI/A2UI alongside the codegen Durable Object (`CodeGeneratorAgent` in `worker/agents/core/codingAgent.ts`; plan text may still say `SimpleCodeGeneratorAgent`) and the existing WebSocket protocol. **open-canvas** = UX patterns only; **CopilotKit** = secondary cross-check; **protocols** = architectural north star. |
| 6 | **Ask mode** | General chat (optional platform capabilities) in any thread without breaking the existing codegen agent path. |

---

## 3. Implicit constraints and posture

- **Platform stack:** Workers, D1, Durable Objects, PartySocket as implemented today—no assumed rewrites.
- **Product posture on AG-UI/A2UI:** **Test viability** with a **strong bias toward “how to get to yes.”** Research should prioritize pathfinding (integration shapes, spikes, mitigations). Blockers must be stated honestly; **“not viable”** only with decisive evidence.
- **Feature preservation:** No removal of shipped behavior without explicit product sign-off (`NEVER_REMOVE_FEATURES`).
- **Secrets:** Encryption at rest, auditable admin changes, no raw keys in logs.
- **Workflow boundary:** This workflow **does not implement** product features; it delivers research, options, spikes, and planning artifacts.

---

## 4. Out of scope (for this workflow)

- Shipping production code for the above capabilities.
- Treating CopilotKit or open-canvas as the sole architectural anchor (they are references, not replacements for protocol-first design).

---

## 5. Phase 1 verification — repo paths (short list)

Phase 1 tracks should **re-verify** these paths in the current tree (line-accurate notes belong in Phase 1 outputs). Grouping follows plan tasks **1A–1D**.

### 5.1 Config, BYOK, providers (1A; goals 1–4)

| Path | Why verify |
|------|------------|
| `worker/agents/inferutils/config.ts` | `COMMON_AGENT_CONFIGS`, `PLATFORM_AGENT_CONFIG`, `DEFAULT_AGENT_CONFIG`, exported `AGENT_CONFIG`; relationship to `PLATFORM_MODEL_PROVIDERS`. |
| `worker/agents/inferutils/infer.ts` | Runtime inference entry, user overrides. |
| `worker/agents/inferutils/core.ts` | Merge of defaults with `userApiKeys` / runtime overrides. |
| `worker/api/controllers/modelConfig/byokHelper.ts` | `PLATFORM_MODEL_PROVIDERS`, access validation patterns. |
| `worker/api/controllers/modelProviders/controller.ts` | Custom provider HTTP API; **503** behavior on some CRUD (capture as-is). |
| `worker/types/secretsTemplates.ts` | BYOK / vault template surface (if still authoritative for provider keys). |

### 5.2 Chat, WebSocket, ask vs agent (1B; goal 6)

| Path | Why verify |
|------|------------|
| `src/routes/chat/utils/handle-websocket-message.ts` | Client-side WS handling, dedupe, message routing. |
| `worker/api/websocketTypes.ts` | Shared WS message shapes. |
| `worker/agents/core/websocket.ts` | Server/agent WS integration. |
| `worker/agents/core/codingAgent.ts` (`CodeGeneratorAgent`) | Codegen Durable Object / state machine; where per-thread **ask mode** vs agent mode would plug in. |
| `worker/agents/index.ts` | Stub resolution for `CodeGeneratorAgent` DO instances. |

### 5.3 BYOK, tenancy, SSRF (1C)

| Path | Why verify |
|------|------------|
| Same as **5.1** plus any `worker/services/secrets/` or D1 services touched by model access policy | Ground **industry** citations in **actual** enforcement points. |

### 5.4 AG-UI / A2UI + canvas patterns (1D; goal 5)

| Path | Why verify |
|------|------------|
| `worker/agents/core/websocket.ts` | PartySocket/worker boundary for a possible AG-UI adapter or parallel channel. |
| `src/routes/chat/` (relevant layout/shell components) | Where a split-pane / canvas-style right pane would attach. |
| Vite/client bundle config (e.g. `vite.config.ts`, large chat route chunks) | Bundle impact of an AG-UI-aware client. |

**Note:** If any path moved, Phase 1 should record the replacement path in the research bundle and update this list via the journal **spine** (see `../spine.md`).

---

## 6. Quality gates relevant to Phase 0

- **Alignment:** This document mirrors the plan’s fixed scope, constraints, and out-of-scope boundary.
- **Traceability:** Later phases must tie repo claims to **path:line** or mark hypotheses explicitly (per plan success checks).
- **Artifacts on disk:** Phase 0 does not replace the canonical research bundle; it **frames** Phase 1 and links to plan-defined locations.

---

## 7. Definition of Done — Phase 0 self-check

| Criterion | Status |
|-----------|--------|
| `intent-analysis.md` exists under `journal_root/p0-intent-and-scope/` | Done |
| Content aligns with plan **Scope (fixed)**: outcomes 1–6, constraints, out of scope, AG-UI/A2UI posture | Done |
| Short list of **Phase 1** repo paths to verify included | Done (§5) |
| `spine.md` at `journal_root/` logs this artifact and routing metadata | See `../spine.md` |
| No implementation work claimed for this phase | Done |

**Residual risks for downstream phases:** Plan and older docs may use `SimpleCodeGeneratorAgent`; repo uses `CodeGeneratorAgent` in `codingAgent.ts`—Phase 1 citations should use the live symbols. Merge discipline: only **one** canonical research bundle path active per coordinator rules.
