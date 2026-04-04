# Gaps vs plan goals 1–4 (with file:line pointers)

Plan source: `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md` (outcomes 1–4).

| Goal | Intent (short) | What exists today (evidence) | Gap / missing |
|------|----------------|------------------------------|---------------|
| **1** | Dynamic providers, models, per-model settings beyond build-time `AGENT_CONFIG` vs `PLATFORM_MODEL_PROVIDERS` | Two static configs selected by truthy `env.PLATFORM_MODEL_PROVIDERS` (`worker/agents/inferutils/config.ts:197-199`). Comma-list used for **enabled providers** in `getPlatformEnabledProviders` (`worker/api/controllers/modelConfig/byokHelper.ts:133-136`). Per-user D1 overrides + HTTP API (`ModelConfigService`, `ModelConfigController`). | No D1 or runtime **catalog** of providers/models; `AGENT_CONFIG` branch does not parse comma list; no admin UI to change defaults without redeploy. |
| **2** | Super-admins and agency admins register OpenAI-compatible base URLs, models, options; secure outbound calls and secrets | Per-user `user_model_providers` schema + `ModelProvidersService` (`worker/database/schema.ts` ~478+, `ModelProvidersService.ts`). `testProvider` can hit user-supplied `baseUrl` (`worker/api/controllers/modelProviders/controller.ts:216-228`). BYOK vault templates (`worker/types/secretsTemplates.ts:258-261`, `byokHelper.ts:29-57`). | **No** agency/super-admin roles or routes (grep: no `agency` / `superAdmin` in `worker`). **create/update/delete** provider return **503** (`controller.ts:117-120`, `156-159`, `179-181`). No SSRF hardening beyond “disabled CRUD.” |
| **3** | Mix models from different providers across templates/agent actions; document D1/policy gaps | Per-action `user_model_configs` allows different models per `AgentActionKey` (`ModelConfigService.ts:117-135`). `resolveModelConfig` merges user + default per action (`infer.ts:34-95`). `validateModelAccessForEnvironment` allows platform **or** user key (`byokHelper.ts:184-202`). Some actions have `AGENT_CONSTRAINTS` (`config.ts:226-257`); others unconstrained (`constraintHelper.ts:26-28`). | **Policy gaps:** no org-level allow/deny lists; `realtimeCodeFixer` diff path ignores user config and `runtimeOverrides` (`realtimeCodeFixer.ts:489-498`). `PhaseGeneration` can override `reasoning_effort` from `AGENT_CONFIG` not user merge (`PhaseGeneration.ts:312`). |
| **4** | Named preset bundles (e.g. gemini- vs claude-centric) at platform, agency, user with explicit precedence | Implicit **two** bundles: `PLATFORM_AGENT_CONFIG` vs `DEFAULT_AGENT_CONFIG` via env (`config.ts:56-199`). User overrides overlay per action in D1. | **No** named bundles, **no** agency/user precedence chain, **no** versioned bundle entities; merge order is only user row + `AGENT_CONFIG` + constraints. |

---

## Cross-cutting gaps (support multiple goals)

| Issue | File:line (representative) |
|-------|----------------------------|
| `SESSION_INIT` credentials / `setRuntimeOverrides` disabled | `worker/agents/core/websocket.ts:21-25` |
| `runtimeOverrides` not rebuilt from vault on DO `onStart` | `worker/agents/core/codingAgent.ts:205-209` (reloads D1 configs only) |
| `AGENT_CONFIG` vs `PLATFORM_MODEL_PROVIDERS` semantics split | `config.ts:197-199` vs `byokHelper.ts:133-170` |
| Custom provider CRUD disabled | `modelProviders/controller.ts:117-120` |

---

## Orchestration note (planning alignment)

Goals **1–4** above are **mostly orthogonal** to whether **ask / canvas / codegen** coordination uses a **native DO** evolution, **LangGraph-class** orchestration, or **CopilotKit** (full-stack vs adapter). Gap rows stay valid for catalog, BYOK, policy, and bundles. **How** those capabilities are enforced across modes is an **open architectural decision** tracked in `p3-feasibility-crosscheck/outputs/` (orchestration section + spike backlog **18–21**), not something this gap table must rewrite wholesale.

---

*Supplements `p1a-codebase-trace.md`.*
