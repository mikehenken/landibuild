# Phase 1A — Config, BYOK, admin surfaces (code trace) — REFRESH

**Task:** `p1a-codebase-model-config-byok`  
**Agent:** ai-engineer  
**Repo:** `landibuild`  
**Date:** 2026-04-04 (refresh: expanded citations, constraint matrix, recursion gap)

This document traces `AGENT_CONFIG` through inference, user overrides, secrets/BYOK templates, and provider controllers. It separates **what exists today** from **what is missing** relative to plan goals 1–4 (goals 5–6 are out of scope for this task).

---

## Today vs missing (summary)

| Area | Today (verified) | Missing / weak |
|------|------------------|----------------|
| Default model bundles | Two static objects; `AGENT_CONFIG` picks one at module load from truthy `PLATFORM_MODEL_PROVIDERS` | No named bundles; comma-list in env not used for bundle selection (only in `byokHelper`) |
| User overrides | D1 `user_model_configs`, merge in `ModelConfigService`, HTTP API, `resolveModelConfig` | No org/agency layer; no admin to edit defaults without redeploy |
| BYOK at inference | `runtimeOverrides.userApiKeys` in `getApiKey`; vault load for **model test** only | WS `SESSION_INIT` disabled; DO `onStart` does not reload vault keys into `runtimeOverrides` |
| Agency / super-admin | Per-user APIs only | No `agency` / `superAdmin` / `tenant` symbols in `worker/**/*.ts` (grep) |
| Unified inference path | `executeInference` → `infer` with `runtimeOverrides` | `realtimeCodeFixer` diff fixer; **tool-recursion `infer` omits `runtimeOverrides`** |

---

## 0. `CodeGeneratorAgent` (`worker/agents/core/codingAgent.ts`)

The production codegen Durable Object is **`CodeGeneratorAgent`** (not a separate `SimpleCodeGeneratorAgent` type in this file — the DO class name is `CodeGeneratorAgent`).

**Today:** It wires WebSocket handling, behaviors (`PhasicCodingBehavior` / `AgenticCodingBehavior`), and on start reloads **merged** user model configs from D1 into the behavior. It does **not** load BYOK vault keys or re-apply HTTP `credentials` on restart.

```42:44:worker/agents/core/codingAgent.ts
export class CodeGeneratorAgent extends Agent<Env, AgentState> implements AgentInfrastructure<AgentState> {
    public _logger: StructuredLogger | undefined;
    private behavior!: BaseCodingBehavior<AgentState>;
```

```205:209:worker/agents/core/codingAgent.ts
        const modelConfigService = new ModelConfigService(this.env);
        const userConfigsRecord = await modelConfigService.getUserModelConfigs(this.state.metadata.userId);
        this.behavior.setUserModelConfigs(userConfigsRecord);
        this.logger().info(`Agent ${this.getAgentId()} session: ${this.state.sessionId} onStart: User configs loaded successfully`, {userConfigsRecord});
```

**Missing:** `setRuntimeOverrides` is never called from `onStart`; only `setUserModelConfigs`. Compare with HTTP bootstrap in `CodingAgentController` which sets both `userModelConfigs` (subset) and `runtimeOverrides` from `body.credentials`.

---

## 1. Build-time defaults: `AGENT_CONFIG` and `PLATFORM_MODEL_PROVIDERS`

### Today

- **`COMMON_AGENT_CONFIGS`:** `screenshotAnalysis`, `realtimeCodeFixer`, `fastCodeFixer`, `templateSelection` (`worker/agents/inferutils/config.ts:11-39`).
- **`PLATFORM_AGENT_CONFIG`** vs **`DEFAULT_AGENT_CONFIG`:** full `AgentConfig` (`config.ts:56-195`).
- **`AGENT_CONFIG`:** chosen at **Worker module load** — any **truthy** `env.PLATFORM_MODEL_PROVIDERS` string selects `PLATFORM_AGENT_CONFIG`; the **contents** of the comma-separated list are **not** read here.

```197:199:worker/agents/inferutils/config.ts
export const AGENT_CONFIG: AgentConfig = env.PLATFORM_MODEL_PROVIDERS 
    ? PLATFORM_AGENT_CONFIG 
    : DEFAULT_AGENT_CONFIG;
```

- **`PLATFORM_MODEL_PROVIDERS` (parsed):** `getPlatformEnabledProviders` splits on comma and merges with auto-detected `*_API_KEY` (`worker/api/controllers/modelConfig/byokHelper.ts:133-170`). This drives **which models are considered platform-available** for validation/UI — **not** which static `AGENT_CONFIG` object is active.

- **`AGENT_CONSTRAINTS`:** only seven action keys are registered (`config.ts:226-257`). Other `AgentConfig` keys have **no** map entry → `validateAgentConstraints` treats them as unconstrained (`constraintHelper.ts:25-28`).

**Constraint coverage matrix**

| `AgentActionKey` | In `AGENT_CONSTRAINTS`? |
|------------------|-------------------------|
| `fastCodeFixer` | Yes |
| `realtimeCodeFixer` | Yes |
| `fileRegeneration` | Yes (allows `AllModels`) |
| `phaseGeneration` | Yes (allows `AllModels`) |
| `projectSetup` | Yes (allows `AllModels`) |
| `conversationalResponse` | Yes (allows `AllModels`) |
| `templateSelection` | Yes (allows `AllModels`) |
| `blueprint` | **No** |
| `firstPhaseImplementation` | **No** |
| `phaseImplementation` | **No** |
| `screenshotAnalysis` | **No** |
| `deepDebugger` | **No** |
| `agenticProjectBuilder` | **No** |

### Missing

- No runtime or D1-driven **switch** between config bundles beyond the two static objects + env truthiness gate.  
- **Semantic split:** `AGENT_CONFIG` branch ≠ `getPlatformEnabledProviders` parsing of the same env var name.

---

## 2. Per-user overrides: D1, API, merge precedence

### Today

- **`ModelConfigService.mergeWithDefaults` / `applyConstraintsWithFallback`** (`worker/database/services/ModelConfigService.ts:54-112`, `117-135`).  
- **`ModelConfigController`** user-scoped HTTP; updates call `validateModelAccessForEnvironment` (`controller.ts:156-192`).  
- **`resolveModelConfig`** precedence: user `ModelConfig` > `AGENT_CONFIG`, plus constraint checks (`infer.ts:28-95`).

**HTTP session start** — only overrides with `isUserOverride` are passed in `inferenceContext.userModelConfigs`; `runtimeOverrides` from optional credentials:

```114:136:worker/api/controllers/agent/controller.ts
            const userConfigsRecord = await modelConfigService.getUserModelConfigs(user.id);
                                
            // Extract only user-overridden configs, stripping metadata fields
            const userModelConfigs: Record<string, ModelConfig> = {};
            for (const [actionKey, mergedConfig] of Object.entries(userConfigsRecord)) {
                if (mergedConfig.isUserOverride) {
                    const { isUserOverride, userConfigId, ...modelConfig } = mergedConfig;
                    userModelConfigs[actionKey] = modelConfig;
                }
            }

            const runtimeOverrides = credentialsToRuntimeOverrides(body.credentials);

            const inferenceContext = {
                metadata: {
                    agentId: agentId,
                    userId: user.id,
                },
                userModelConfigs,
                runtimeOverrides,
                enableRealtimeCodeFix: false, // This costs us too much, so disabled it for now
                enableFastSmartCodeFix: false,
            }
```

**`getInferenceContext()` on the DO** rebuilds context per operation with **hardcoded** flags (not from initial HTTP context):

```342:352:worker/agents/core/behaviors/base.ts
    protected getInferenceContext(): InferenceContext {
        const controller = this.getOrCreateAbortController();
        
        return {
            metadata: this.state.metadata,
            enableFastSmartCodeFix: false,  // TODO: Do we want to enable it via some config?
            enableRealtimeCodeFix: false,   // TODO: Do we want to enable it via some config?
            abortSignal: controller.signal,
            userModelConfigs: this.getUserModelConfigs(),
            runtimeOverrides: this.getRuntimeOverrides(),
        };
    }
```

**Missing:** No tenant/agency merge. **`runtimeOverrides`** are not restored on DO restart unless something calls `setRuntimeOverrides` (only possible via commented WS path today). **Flag mismatch:** HTTP `inferenceContext` disables realtime fixer explicitly; DO `getInferenceContext` also forces false — so even if HTTP passed true, behavior would reset unless state carried flags (it does not).

---

## 3. Inference stack: `executeInference` → `infer` → keys and gateway

### Today

- **`executeInference`** merges config then calls **`infer`** with `runtimeOverrides: context.runtimeOverrides` (`infer.ts:157-220`).  
- **`infer`** calls **`getConfigurationForModel`** with `runtimeOverrides` (`core.ts:619-624`).  
- **`getApiKey`** order: `runtimeOverrides.userApiKeys[provider]` → `PROVIDER_API_KEY` env → gateway token path (`core.ts:277-305`).  
- **`InferenceRuntimeOverrides` / `credentialsToRuntimeOverrides`** (`config.types.ts:513-556`).

```277:305:worker/agents/inferutils/core.ts
async function getApiKey(
	provider: string,
	env: Env,
	_userId: string,
	runtimeOverrides?: InferenceRuntimeOverrides,
): Promise<string> {
    console.log("Getting API key for provider: ", provider);

    const runtimeKey = runtimeOverrides?.userApiKeys?.[provider];
    if (runtimeKey && isValidApiKey(runtimeKey)) {
        return runtimeKey;
    }
    // Fallback to environment variables
    const providerKeyString = provider.toUpperCase().replaceAll('-', '_');
    const envKey = `${providerKeyString}_API_KEY` as keyof Env;
    let apiKey: string = env[envKey] as string;
    // ...
}
```

### Missing / bug-shaped gap

**Tool-call recursion drops `runtimeOverrides`:** when `infer` recurses after tool execution, the nested `infer` call does **not** pass `runtimeOverrides` (nor `stream` in some branches). Subsequent hops rely on env keys only — **BYOK injected only on the first hop is lost**.

```946:987:worker/agents/inferutils/core.ts
            if (executedCallsWithResults.length) {
                if (schema && schemaName) {
                    const output = await infer<OutputSchema>({
                        env,
                        metadata,
                        messages,
                        schema,
                        schemaName,
                        format,
                        formatOptions,
                        actionKey,
                        modelName,
                        maxTokens,
                        stream,
                        tools,
                        reasoning_effort,
                        temperature,
                        frequency_penalty,
                        abortSignal,
                        onAssistantMessage,
                        completionConfig,
                    }, newToolCallContext);
                    return output;
                } else {
                    const output = await infer({
                        env,
                        metadata,
                        messages,
                        modelName,
                        maxTokens,
                        actionKey,
                        stream,
                        tools,
                        reasoning_effort,
                        temperature,
                        frequency_penalty,
                        abortSignal,
                        onAssistantMessage,
                        completionConfig,
                    }, newToolCallContext);
                    return output;
                }
```

---

## 4. BYOK: templates, vault, platform model list

### Today

- **`loadByokKeysFromUserVault`**, **`getUserProviderStatus`**, **`getByokModels`**, **`validateModelAccessForEnvironment`**, **`getPlatformAvailableModels`** (`byokHelper.ts:29-202`).  
- **`ModelConfigController.testModelConfig`:** when `useUserKeys`, loads vault into `userApiKeys` and passes to `ModelTestService` (`controller.ts:300-313`).  
- **`ModelTestService.testModelConfig`** passes `runtimeOverrides: { userApiKeys }` into **`infer`** (`ModelTestService.ts:45-57`).

### Missing

- Vault keys are **not** merged into agent `runtimeOverrides` during normal codegen — only tests and optional HTTP `credentials`.  
- OpenRouter / other non-BYOK-template providers: not in the same vault template loop as `getBYOKTemplates()` (verify in `worker/types/secretsTemplates.ts` when extending BYOK).

---

## 5. Custom provider controller and DB

### Today

- **`ModelProvidersController`:** GET list/detail active providers; create/update/delete return **503** with BYOK vault message (`controller.ts:117-120`, `156-159`, `179-181`).  
- **`testProvider`:** ad-hoc `baseUrl` + `apiKey` fetch to `{baseUrl}/models` (`controller.ts:216-228`).

### Missing

- Super-admin / agency registration routes: **none** in `worker` for the searched patterns (see §8).  
- SSRF / abuse review for `testProvider` if exposed to untrusted callers.

---

## 6. `SESSION_INIT`, `PhaseGeneration`, `realtimeCodeFixer`

### `SESSION_INIT` (WebSocket)

**Today:** Handler exists; credential wiring **commented out**.

```21:25:worker/agents/core/websocket.ts
            case WebSocketMessageRequests.SESSION_INIT: {
                // const credentials = parsedMessage.credentials as CredentialsPayload | undefined;
                // agent.getBehavior().setRuntimeOverrides(credentialsToRuntimeOverrides(credentials));
                logger.info(`Received session init message from ${connection.id}, Disable for now`);
                break;
```

### `PhaseGeneration`

**Today:** Uses **`executeInference`** with `agentActionName: "phaseGeneration"` so **model name** respects `resolveModelConfig`.  
**Gap:** Explicit `reasoning_effort` argument is derived from **`AGENT_CONFIG.phaseGeneration`**, not from the merged user config for that field when the branch activates.

```306:314:worker/agents/operations/PhaseGeneration.ts
            const results = await executeInference({
                env: env,
                messages,
                agentActionName: "phaseGeneration",
                schema: PhaseConceptGenerationSchema,
                context: options.inferenceContext,
                reasoning_effort: (userContext?.suggestions || issues.runtimeErrors.length > 0) ? AGENT_CONFIG.phaseGeneration.reasoning_effort == 'low' ? 'medium' : 'high' : undefined,
                format: 'markdown',
            });
```

### `realtimeCodeFixer`

**Today:** `IsRealtimeCodeFixerEnabled` checks `AGENT_CONFIG` then `userModelConfigs['realtimeCodeFixer']` (`realtimeCodeFixer.ts:536-548`).  
**Gap:** Diff-correction path calls **`infer` directly** with `modelName: AGENT_CONFIG['realtimeCodeFixer'].name` and **no** `runtimeOverrides` — user model choice and BYOK keys from context are **not** applied on that hop.

```489:498:worker/agents/assistants/realtimeCodeFixer.ts
            const llmResponse = await infer({
                env: this.env,
                metadata: this.inferenceContext.metadata,
                modelName: AGENT_CONFIG['realtimeCodeFixer'].name,
                reasoning_effort: 'low',
                temperature: 0.0,
                maxTokens: 10000,
                actionKey:'realtimeCodeFixer',
                messages,
            });
```

---

## 7. Constraint and policy layer

### Today

- **`validateAgentConstraints`**, **`getFilteredModelsForAgent`** (`constraintHelper.ts`).  
- **`getByokProviders`** optional `agentAction` filter (`modelConfig/controller.ts:383-437`).

### Missing

- Org/agency allow-lists in D1.  
- Named preset bundles (goal 4).

---

## 8. Agency / super-admin hooks (explicit finding)

**Search:** `agency`, `superAdmin`, `super_admin`, `tenant` in `worker/**/*.ts` — **no matches** (2026-04-04).

**Interpretation:** No Worker-side agency or super-admin hooks for model policy or provider registration under these names. Administration is **per user** + **deployment env**.

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
| Model test + BYOK | `worker/database/services/ModelTestService.ts` |
| Secrets templates | `worker/types/secretsTemplates.ts` |
| Custom providers | `worker/api/controllers/modelProviders/controller.ts`, `worker/database/services/ModelProvidersService.ts` |
| Agent init / DO | `worker/api/controllers/agent/controller.ts`, `worker/agents/core/codingAgent.ts`, `worker/agents/core/behaviors/base.ts`, `worker/agents/core/websocket.ts` |
| Bypass / partial paths | `worker/agents/operations/PhaseGeneration.ts`, `worker/agents/assistants/realtimeCodeFixer.ts` |

---

*End of code trace.*
