# Phase 1A — Config, BYOK, admin surfaces (code trace)

**Task:** `p1a-codebase-model-config-byok`  
**Agent:** ai-engineer  
**Repo:** `landibuild`  
**Date:** 2026-04-04

This document traces `AGENT_CONFIG` through inference, user overrides, secrets/BYOK templates, and provider controllers. It separates **what exists today** from **what is missing** relative to plan goals 1–4 (goals 5–6 are out of scope for this task).

---

## 1. Build-time defaults: `AGENT_CONFIG` and `PLATFORM_MODEL_PROVIDERS`

### What it does today

- **`COMMON_AGENT_CONFIGS`** holds shared defaults for several actions (`screenshotAnalysis`, `realtimeCodeFixer`, `fastCodeFixer`, `templateSelection`).  
- **`PLATFORM_AGENT_CONFIG`** and **`DEFAULT_AGENT_CONFIG`** are two full `AgentConfig` objects (multi-provider “platform” vs Kimi-heavy default).  
- **`AGENT_CONFIG`** is chosen at **Worker module load** from `env.PLATFORM_MODEL_PROVIDERS` truthiness only: if the binding is any non-empty string, `PLATFORM_AGENT_CONFIG` is used; otherwise `DEFAULT_AGENT_CONFIG`. The **comma-separated list inside** `PLATFORM_MODEL_PROVIDERS` is **not** parsed here.

```197:199:worker/agents/inferutils/config.ts
export const AGENT_CONFIG: AgentConfig = env.PLATFORM_MODEL_PROVIDERS 
    ? PLATFORM_AGENT_CONFIG 
    : DEFAULT_AGENT_CONFIG;
```

- **`AGENT_CONSTRAINTS`** restricts which `AIModels` values are allowed for a **subset** of `AgentActionKey` entries (`fastCodeFixer`, `realtimeCodeFixer`, `fileRegeneration`, `phaseGeneration`, `projectSetup`, `conversationalResponse`, `templateSelection`). Actions **without** a map entry (e.g. `blueprint`, `phaseImplementation`, `deepDebugger`, `agenticProjectBuilder`) have **no** constraint row and are treated as unconstrained in `validateAgentConstraints`.

```226:257:worker/agents/inferutils/config.ts
export const AGENT_CONSTRAINTS: Map<AgentActionKey, AgentConstraintConfig> = new Map([
	['fastCodeFixer', { ... }],
	['realtimeCodeFixer', { ... }],
	// ... other keys — not exhaustive over AgentConfig
]);
```

### What is missing

- No runtime or D1-driven **switch** between config “bundles”; only two static objects + env boolean-style gate.  
- **`AGENT_CONFIG` selection** does not reflect the **same semantics** as `getPlatformEnabledProviders` (which **does** split `PLATFORM_MODEL_PROVIDERS` by comma).

---

## 2. Per-user overrides: D1, API, merge precedence

### What it does today

- Table **`user_model_configs`** (Drizzle `userModelConfigs` in `worker/database/schema.ts`) stores per-user, per-`agentActionName` overrides.  
- **`ModelConfigService`** merges DB rows with `AGENT_CONFIG` defaults; user non-null fields win; constraints can force fallback to defaults (`mergeWithDefaults`, `applyConstraintsWithFallback`).

```54:77:worker/database/services/ModelConfigService.ts
	private mergeWithDefaults(
		userConfig: UserModelConfig | null,
		agentActionName: AgentActionKey
	): UserModelConfigWithMetadata {
		const defaultConfig = AGENT_CONFIG[agentActionName];
		// ...
		return {
			name: toAIModel(userConfig.modelName) ?? defaultConfig.name,
			// ...
			isUserOverride: true/false,
		};
	}
```

- **`ModelConfigController`** (`worker/api/controllers/modelConfig/controller.ts`) exposes CRUD-style HTTP for the authenticated **user** only (`context.user!`). Updates validate `validateModelAccessForEnvironment` against platform keys + user BYOK status.  
- **`resolveModelConfig`** in `infer.ts`: precedence **user `ModelConfig` > `AGENT_CONFIG`**, then constraint checks on primary and fallback candidates.

```28:46:worker/agents/inferutils/infer.ts
 * Precedence: userConfig > AGENT_CONFIG defaults
 */
function resolveModelConfig(
    agentActionName: AgentActionKey,
    userConfig?: ModelConfig,
): ModelConfig {
    const defaultConfig = AGENT_CONFIG[agentActionName];
    const merged: ModelConfig = {
        name: userConfig?.name ?? defaultConfig.name,
        // ...
    };
```

- **Session start (HTTP):** `CodingAgentController.startCodeGeneration` loads merged configs and passes **only rows with `isUserOverride`** into `inferenceContext.userModelConfigs`, plus `runtimeOverrides` from optional `body.credentials` via `credentialsToRuntimeOverrides`.

```114:134:worker/api/controllers/agent/controller.ts
            const userConfigsRecord = await modelConfigService.getUserModelConfigs(user.id);
            const userModelConfigs: Record<string, ModelConfig> = {};
            for (const [actionKey, mergedConfig] of Object.entries(userConfigsRecord)) {
                if (mergedConfig.isUserOverride) {
                    const { isUserOverride, userConfigId, ...modelConfig } = mergedConfig;
                    userModelConfigs[actionKey] = modelConfig;
                }
            }
            const runtimeOverrides = credentialsToRuntimeOverrides(body.credentials);
            const inferenceContext = {
                metadata: { agentId: agentId, userId: user.id },
                userModelConfigs,
                runtimeOverrides,
                // ...
            };
```

- **DO restart / `onStart`:** `CodeGeneratorAgent.onStart` reloads **`getUserModelConfigs`** from D1 and calls `behavior.setUserModelConfigs(userConfigsRecord)` with the **full** merged record (including entries with `isUserOverride: false`). Effective inference still resolves per field; defaults align with `AGENT_CONFIG` when not overridden.

```205:209:worker/agents/core/codingAgent.ts
        const modelConfigService = new ModelConfigService(this.env);
        const userConfigsRecord = await modelConfigService.getUserModelConfigs(this.state.metadata.userId);
        this.behavior.setUserModelConfigs(userConfigsRecord);
```

### What is missing

- **No agency- or tenant-scoped** config table or merge layer; only **user** + **build-time** defaults.  
- **`runtimeOverrides` / BYOK keys** are **not** reloaded from the vault on `onStart`; they only exist if supplied at HTTP start. WebSocket path to set them is **commented out** (see §5).

---

## 3. Inference stack: `executeInference` → `infer` → keys and gateway

### What it does today

- **`executeInference`** resolves model/fallback/temperature from `resolveModelConfig`, then calls **`infer`** in `core.ts` with `runtimeOverrides: context.runtimeOverrides`.  
- **`getApiKey`** prefers `runtimeOverrides.userApiKeys[provider]`, else env `PROVIDER_API_KEY`, else gateway token behavior when using custom gateway URL.

```277:305:worker/agents/inferutils/core.ts
async function getApiKey(
	provider: string,
	env: Env,
	_userId: string,
	runtimeOverrides?: InferenceRuntimeOverrides,
): Promise<string> {
    const runtimeKey = runtimeOverrides?.userApiKeys?.[provider];
    if (runtimeKey && isValidApiKey(runtimeKey)) {
        return runtimeKey;
    }
    // ... env keys, then gateway token / CLOUDFLARE_AI_GATEWAY_TOKEN
}
```

- **`InferenceRuntimeOverrides`** and **`credentialsToRuntimeOverrides`** are defined in `config.types.ts` (SDK payload → runtime-only overrides, not persisted in DO state).

```513:556:worker/agents/inferutils/config.types.ts
export type InferenceRuntimeOverrides = {
	userApiKeys?: Record<string, string>;
	aiGatewayOverride?: { baseUrl: string; token: string };
};
// ...
export function credentialsToRuntimeOverrides(
	credentials: CredentialsPayload | undefined,
): InferenceRuntimeOverrides | undefined {
```

- **`getConfigurationForModel`** builds `baseURL` (AI Gateway vs direct override) and sets `cf-aig-authorization` when gateway token differs from provider key (BYOK + platform gateway pattern).

### What is missing

- **Inconsistent paths:** some code uses raw **`AGENT_CONFIG`** + **`infer`** without `runtimeOverrides` or `executeInference` (see §6).  
- **No** per-request merge of vault-decrypted keys into `runtimeOverrides` inside the DO unless the client sent credentials on start or a future WS hook is enabled.

---

## 4. BYOK: templates, vault, platform model list

### What it does today

- **`getBYOKTemplates()`** filters `getTemplatesData()` to `category === 'byok'` (`worker/types/secretsTemplates.ts`): OpenAI, Anthropic, Google AI Studio, Cerebras, Workers AI BYOK entries with `provider` ids aligned to gateway/env naming.  
- **`loadByokKeysFromUserVault`** iterates BYOK templates and reads `UserSecretsStore` stub per user; used by **`ModelConfigController.testModelConfig`** when `useUserKeys` is true.  
- **`getUserProviderStatus`**, **`getByokModels`**, **`getPlatformAvailableModels`**, **`validateModelAccessForEnvironment`** in `byokHelper.ts`: platform keys from env (and optional comma list in `PLATFORM_MODEL_PROVIDERS`), user access if vault has a valid key for that provider. Access is **platform key OR user key**.

```133:170:worker/api/controllers/modelConfig/byokHelper.ts
export function getPlatformEnabledProviders(env: Env): string[] {
	const configured = env.PLATFORM_MODEL_PROVIDERS
		? env.PLATFORM_MODEL_PROVIDERS.split(',').map((p) => p.trim()).filter(Boolean)
		: null;
	// ... auto-detect from *_API_KEY ...
	if (configured) {
		const merged = new Set(configured);
		// ...
		return [...merged];
	}
	return autoDetected;
}
```

### What is missing

- **OpenRouter** (and other) templates exist in **non-BYOK** `getTemplatesData` but are **not** in `getBYOKTemplates`; BYOK flow for OpenRouter is not in the BYOK template loop used by `loadByokKeysFromUserVault`.  
- **No admin UI/API** to define **custom OpenAI-compatible base URLs** for tenants; user **`user_model_providers`** table + service exist but mutations are **503** (see §5).

---

## 5. Custom provider controller and DB

### What it does today

- **`ModelProvidersService`** (`worker/database/services/ModelProvidersService.ts`) implements CRUD against **`user_model_providers`** for a **userId**.  
- **`ModelProvidersController`**: **GET** list/detail still work off D1; **create / update / delete** return **503** with message to use BYOK vault. **`testProvider`** still allows ad-hoc `baseUrl` + `apiKey` **GET** to `{baseUrl}/models` (SSRF surface if exposed to untrusted URLs).

```117:120:worker/api/controllers/modelProviders/controller.ts
            return ModelProvidersController.createErrorResponse<ModelProviderCreateData>(
                'Custom model providers are temporarily disabled. Please use BYOK (Bring Your Own Key) in the vault settings.',
                503
            );
```

- **WebSocket `SESSION_INIT`**: intended to call `setRuntimeOverrides(credentialsToRuntimeOverrides(credentials))` is **commented out**; log says “Disable for now”.

```21:25:worker/agents/core/websocket.ts
            case WebSocketMessageRequests.SESSION_INIT: {
                // const credentials = parsedMessage.credentials as CredentialsPayload | undefined;
                // agent.getBehavior().setRuntimeOverrides(credentialsToRuntimeOverrides(credentials));
                logger.info(`Received session init message from ${connection.id}, Disable for now`);
```

### What is missing

- **Super-admin / agency-admin** endpoints: **none** found under `worker/` for agency or super-admin provider registration (grep for `agency`, `superAdmin`, `super_admin` in `worker/**/*.ts` returned **no matches**).  
- **Scoped providers** (platform vs agency vs user) **not** modeled; only per-user `user_model_providers` with CRUD disabled.

---

## 6. Partial bypasses of the unified resolution path

### What it does today

- **`PhaseGeneration`** passes `reasoning_effort` from **`AGENT_CONFIG.phaseGeneration`** directly, not from `resolveModelConfig` output for that field when calling `executeInference` (optional param can override merged config).

```306:314:worker/agents/operations/PhaseGeneration.ts
            const results = await executeInference({
                // ...
                context: options.inferenceContext,
                reasoning_effort: (userContext?.suggestions || issues.runtimeErrors.length > 0) ? AGENT_CONFIG.phaseGeneration.reasoning_effort == 'low' ? 'medium' : 'high' : undefined,
```

- **`realtimeCodeFixer`**: diff correction calls **`infer`** with **`AGENT_CONFIG['realtimeCodeFixer'].name`** and **no** `runtimeOverrides` — BYOK / user model config not applied on that path.

```489:498:worker/agents/assistants/realtimeCodeFixer.ts
            const llmResponse = await infer({
                env: this.env,
                metadata: this.inferenceContext.metadata,
                modelName: AGENT_CONFIG['realtimeCodeFixer'].name,
                // ...
                messages,
            });
```

- **`IsRealtimeCodeFixerEnabled`** checks `AGENT_CONFIG` first, then `inferenceContext.userModelConfigs['realtimeCodeFixer']` — consistent with user override for **enablement**, but the diff-correction **`infer`** path still ignores user model name.

### What is missing

- Single **invariant**: “all LLM calls go through `executeInference` + full `InferenceContext`” is **not** true today; documented in `docs/analysis/ai-engineering-review-2.0.0.md` as well.

---

## 7. Constraint and policy layer

### What it does today

- **`validateAgentConstraints`** (`constraintHelper.ts`): if no constraint or disabled → valid.  
- **`getFilteredModelsForAgent`**: used by **`getByokProviders`** when `agentAction` query param is set, so UI can restrict pickers per action.

### What is missing

- **D1 policy** for org/agency templates, caps, or required models: **absent**.  
- **Named preset bundles** (goal 4): **not** implemented; only implicit “platform” vs “default” `AGENT_CONFIG`.

---

## 8. Agency / super-admin hooks (explicit finding)

**Search:** `agency`, `superAdmin`, `super_admin`, `tenant` in `worker/**/*.ts` — **no matches**.

**Interpretation:** There are **no** Worker-side agency or super-admin hooks for model policy or provider registration. Administration is **per authenticated user** (`ModelConfigController`, `ModelProvidersController`) plus **deployment env** (`PLATFORM_MODEL_PROVIDERS`, `*_API_KEY`).

---

## References (repo-only)

| Topic | Primary files |
|--------|----------------|
| Defaults & constraints | `worker/agents/inferutils/config.ts` |
| Merge / inference | `worker/agents/inferutils/infer.ts`, `worker/agents/inferutils/core.ts` |
| Types / credentials | `worker/agents/inferutils/config.types.ts` |
| User config D1 | `worker/database/services/ModelConfigService.ts`, `worker/database/schema.ts` |
| HTTP model API | `worker/api/controllers/modelConfig/controller.ts` |
| BYOK helpers | `worker/api/controllers/modelConfig/byokHelper.ts` |
| Secrets templates | `worker/types/secretsTemplates.ts` |
| Custom providers | `worker/api/controllers/modelProviders/controller.ts`, `worker/database/services/ModelProvidersService.ts` |
| Agent init / reload | `worker/api/controllers/agent/controller.ts`, `worker/agents/core/codingAgent.ts`, `worker/agents/core/websocket.ts` |
| Bypass paths | `worker/agents/operations/PhaseGeneration.ts`, `worker/agents/assistants/realtimeCodeFixer.ts` |

---

*End of code trace.*
