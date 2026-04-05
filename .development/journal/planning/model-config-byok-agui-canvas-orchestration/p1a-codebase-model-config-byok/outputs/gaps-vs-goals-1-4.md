# Gaps vs plan goals 1–4 (expanded, file:line)

Plan source: `.cursor/plans/model-config-byok-agui-canvas-orchestration.plan.md` (outcomes 1–4).

---

## Goal 1 — Dynamic providers, models, per-model settings (beyond static `AGENT_CONFIG`)

| Subtopic | What exists today | Gap / risk | File:line |
|----------|-------------------|------------|-----------|
| Static default bundles | Two objects; export picks one at load | Cannot switch bundle without redeploy or changing env truthiness | `worker/agents/inferutils/config.ts:56-199` |
| `PLATFORM_MODEL_PROVIDERS` meaning A | Non-empty string → `PLATFORM_AGENT_CONFIG` | Ignores comma-separated provider list for **which** bundle | `config.ts:197-199` |
| `PLATFORM_MODEL_PROVIDERS` meaning B | Comma list merged with auto keys for enabled providers | Used for validation/UI “platform models”, not `AGENT_CONFIG` | `worker/api/controllers/modelConfig/byokHelper.ts:133-170` |
| Per-user settings | D1 + merge + HTTP API | No catalog table; registry is code (`AI_MODEL_CONFIG`) | `worker/database/services/ModelConfigService.ts:54-136` |
| Per-action settings | `user_model_configs` keyed by `AgentActionKey` | Same | `ModelConfigService.ts:117-135` |
| Model test path | `infer` + `runtimeOverrides.userApiKeys` | Not the same as live agent path for vault | `worker/database/services/ModelTestService.ts:45-57` |

---

## Goal 2 — Super-admins / agency admins: OpenAI-compatible bases, secure outbound, secrets

| Subtopic | What exists today | Gap / risk | File:line |
|----------|-------------------|------------|-----------|
| Worker roles | — | **No** `agency`, `superAdmin`, `super_admin`, `tenant` in `worker/**/*.ts` (grep) | *(search evidence)* |
| Custom provider CRUD | Schema/service exist | **create** returns 503 | `worker/api/controllers/modelProviders/controller.ts:117-120` |
| Custom provider CRUD | — | **update** returns 503 | `controller.ts:156-159` |
| Custom provider CRUD | — | **delete** returns 503 | `controller.ts:179-181` |
| Ad-hoc connectivity test | `fetch(baseUrl/models)` | SSRF / abuse if URL not restricted | `controller.ts:216-228` |
| BYOK vault | `loadByokKeysFromUserVault`, templates | Scoped to template list; not agency-admin configurable | `worker/api/controllers/modelConfig/byokHelper.ts:29-57` |
| User model policy API | `ModelConfigController` | **Authenticated user only** (`context.user!`) | `worker/api/controllers/modelConfig/controller.ts:63-67` |

---

## Goal 3 — Mix models across providers / actions; document policy gaps

| Subtopic | What exists today | Gap / risk | File:line |
|----------|-------------------|------------|-----------|
| Per-action models | `resolveModelConfig` user > default | OK for `executeInference` callers | `worker/agents/inferutils/infer.ts:34-95` |
| Access check on save | Platform key **or** user BYOK | OK for settings UX | `byokHelper.ts:184-202` |
| Constraint subset | Seven actions constrained; six unconstrained | Unconstrained actions accept any registered id that passes access check | `config.ts:226-257`, `constraintHelper.ts:25-28` |
| Phase gen reasoning | Uses `AGENT_CONFIG.phaseGeneration` for bump | User’s saved `reasoning_effort` not used when branch triggers | `worker/agents/operations/PhaseGeneration.ts:312` |
| Realtime diff fixer | `infer` + hardcoded `AGENT_CONFIG` name | Ignores `userModelConfigs` and `runtimeOverrides` | `worker/agents/assistants/realtimeCodeFixer.ts:489-498` |
| Tool recursion | First `infer` gets `runtimeOverrides` | **Recursive** `infer` omits `runtimeOverrides` | `worker/agents/inferutils/core.ts:946-987` |
| HTTP vs DO context | `startCodeGeneration` builds `inferenceContext` | DO `getInferenceContext` resets feature flags to false | `worker/api/controllers/agent/controller.ts:127-136`, `worker/agents/core/behaviors/base.ts:342-352` |
| WS credential refresh | `SESSION_INIT` | **Disabled** (commented) | `worker/agents/core/websocket.ts:21-25` |
| DO restart | `onStart` loads D1 configs | Does **not** reload `runtimeOverrides` from vault | `worker/agents/core/codingAgent.ts:205-209` |

---

## Goal 4 — Named preset bundles (platform, agency, user) with explicit precedence

| Subtopic | What exists today | Gap / risk | File:line |
|----------|-------------------|------------|-----------|
| Implicit bundles | `PLATFORM_AGENT_CONFIG` vs `DEFAULT_AGENT_CONFIG` | Only two names; not user-selectable | `config.ts:56-199` |
| Precedence | User D1 row fields override `AGENT_CONFIG` per field | No agency layer between platform default and user | `ModelConfigService.ts:67-77`, `infer.ts:40-46` |
| Versioning | — | No bundle id / version in schema | — |

---

## Cross-cutting gaps (multi-goal)

| Issue | Evidence | Goals touched |
|-------|----------|---------------|
| `SESSION_INIT` / `setRuntimeOverrides` disabled | `websocket.ts:21-25` | 1, 2, 3 |
| Vault BYOK not injected into agent `runtimeOverrides` by default | `codingAgent.ts:205-209`; contrast `modelConfig/controller.ts:300-306` | 2, 3 |
| `AGENT_CONFIG` selection vs `getPlatformEnabledProviders` semantics | `config.ts:197-199` vs `byokHelper.ts:133-170` | 1, 3 |
| Custom provider mutations disabled | `modelProviders/controller.ts:117-120`, `156-159`, `179-181` | 2 |
| Recursive `infer` drops BYOK/runtime overrides | `core.ts:946-987` | 3 |
| `realtimeCodeFixer` diff path bypasses merged config + BYOK | `realtimeCodeFixer.ts:489-498` | 3 |
| No agency/super-admin symbols in worker tree | grep `worker/**/*.ts` | 2, 4 |

---

## Orchestration note (planning alignment)

Goals **1–4** are **mostly orthogonal** to ask / canvas / codegen orchestration technology choices. Gap rows stay valid for catalog, BYOK, policy, and bundles. Enforcement across modes remains an architectural follow-up (e.g. `p3-feasibility-crosscheck`), not a rewrite of this table.

---

*Supplements `p1a-codebase-trace.md`.*
