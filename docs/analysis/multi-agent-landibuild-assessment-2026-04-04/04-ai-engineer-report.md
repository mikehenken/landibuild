# AI engineer report (subagent: ai-engineer)

**← [Back to index](./00-coordinator-verification-gap-analysis-and-index.md)** · [01](./01-research-analyst-report.md) · [02](./02-search-specialist-report.md) · [03](./03-architect-reviewer-report.md) · [05](./05-refactoring-specialist-report.md) · [06](./06-context-manager-report.md) · [07](./07-follow-up-clarifications.md)

Source: Cursor Task subagent `ai-engineer`. **Full subagent output** below (untruncated).

---

Here is a concise but complete map of how inference is wired today, with citations.

---

## 1) Cloudflare AI Gateway: bindings, `CLOUDFLARE_AI_GATEWAY_URL`, tokens, `cf-aig-authorization`

### Wrangler / env surface

- **`AI` binding** (Workers AI / gateway client): `wrangler.jsonc` declares `ai.binding = "AI"` with `remote: true` (remote Workers AI in dev).

```47:50:c:\Users\mikeh\Projects\landi\landibuild\wrangler.jsonc
	"ai": {
		"binding": "AI",
        "remote": true
	},
```

- **Gateway name (plain var, not a secret):** `CLOUDFLARE_AI_GATEWAY` defaults to `"landibuild-gateway"`.

```152:158:c:\Users\mikeh\Projects\landi\landibuild\wrangler.jsonc
	"vars": {
        "TEMPLATES_REPOSITORY": "https://github.com/cloudflare/vibesdk-templates",
        "ALLOWED_EMAIL": "mikehenken@gmail.com",
        "DISPATCH_NAMESPACE": "landibuild-default-namespace",
        "ENABLE_READ_REPLICAS": "false",
        "CLOUDFLARE_AI_GATEWAY": "landibuild-gateway",
```

- **Secrets / vars on `Env`:** `CLOUDFLARE_AI_GATEWAY_URL` and `CLOUDFLARE_AI_GATEWAY_TOKEN` (among provider keys) appear on `Env` in `worker-configuration.d.ts`.

```14:30:c:\Users\mikeh\Projects\landi\landibuild\worker-configuration.d.ts
		CLOUDFLARE_AI_GATEWAY: "landibuild-gateway";
		PLATFORM_CAPABILITIES: {"features":{"app":{"enabled":true},"presentation":{"enabled":false},"general":{"enabled":false}},"version":"1.0.0"};
		ANTHROPIC_API_KEY: string;
		OPENAI_API_KEY: string;
		GOOGLE_AI_STUDIO_API_KEY: string;
		OPENROUTER_API_KEY: string;
		CEREBRAS_API_KEY: string;
		GROQ_API_KEY: string;
		GOOGLE_VERTEX_AI_API_KEY: string;
		PLATFORM_MODEL_PROVIDERS: string;
		SANDBOX_SERVICE_API_KEY: string;
		SANDBOX_SERVICE_TYPE: string;
		SANDBOX_SERVICE_URL: string;
		CLOUDFLARE_API_TOKEN: string;
		CLOUDFLARE_ACCOUNT_ID: string;
		CLOUDFLARE_AI_GATEWAY_URL: string;
		CLOUDFLARE_AI_GATEWAY_TOKEN: string;
```

Local example documents optional explicit gateway URL + token:

```17:19:c:\Users\mikeh\Projects\landi\landibuild\.dev.vars.example
# AI Gateway (recommended)
CLOUDFLARE_AI_GATEWAY_TOKEN=""
# CLOUDFLARE_AI_GATEWAY_URL="https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_name>/"
```

### How the gateway **base URL** is chosen

`buildGatewayUrl` (exported async function in `core.ts`) resolves in order:

1. **Runtime SDK override:** `gatewayOverride.baseUrl` → pathname rewritten to append `/{provider}` or `/compat`.
2. **`CLOUDFLARE_AI_GATEWAY_URL`:** if set, valid `http(s)`, same pathname rewrite.
3. **Binding:** `env.AI.gateway(env.CLOUDFLARE_AI_GATEWAY)` then `getUrl(provider)` or `` `${await gateway.getUrl()}compat` ``.

```199:233:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
export async function buildGatewayUrl(
	env: Env,
	providerOverride?: AIGatewayProviders,
	gatewayOverride?: { baseUrl: string; token: string },
): Promise<string> {
    // Runtime override (SDK): explicit AI Gateway base URL
    if (gatewayOverride?.baseUrl) {
        const url = new URL(gatewayOverride.baseUrl);
        return constructGatewayUrl(url, providerOverride);
    }

    // If CLOUDFLARE_AI_GATEWAY_URL is set and is a valid URL, use it directly
    if (env.CLOUDFLARE_AI_GATEWAY_URL && 
        env.CLOUDFLARE_AI_GATEWAY_URL !== 'none' && 
        env.CLOUDFLARE_AI_GATEWAY_URL.trim() !== '') {
        
        try {
            const url = new URL(env.CLOUDFLARE_AI_GATEWAY_URL);
            // Validate it's actually an HTTP/HTTPS URL
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                // Add 'providerOverride' as a segment to the URL
                const cleanPathname = url.pathname.replace(/\/$/, ''); // Remove trailing slash
                url.pathname = buildGatewayPathname(cleanPathname, providerOverride);
                return url.toString();
            }
        } catch (error) {
            // Invalid URL, fall through to use bindings
            console.warn(`Invalid CLOUDFLARE_AI_GATEWAY_URL provided: ${env.CLOUDFLARE_AI_GATEWAY_URL}. Falling back to AI bindings.`);
        }
    }
    
    // Build the url via bindings
    const gateway = env.AI.gateway(env.CLOUDFLARE_AI_GATEWAY);
    const baseUrl = providerOverride ? await gateway.getUrl(providerOverride) : `${await gateway.getUrl()}compat`;
    return baseUrl;
}
```

Path suffixes: **`/compat`** = OpenAI-compatible unified endpoint; with `providerOverride`, a provider-specific segment is used (`buildGatewayPathname`).

```189:196:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
function buildGatewayPathname(cleanPathname: string, providerOverride?: AIGatewayProviders): string {
    return providerOverride ? `${cleanPathname}/${providerOverride}` : `${cleanPathname}/compat`;
}

function constructGatewayUrl(url: URL, providerOverride?: AIGatewayProviders): string {
    const cleanPathname = url.pathname.replace(/\/$/, '');
    url.pathname = buildGatewayPathname(cleanPathname, providerOverride);
    return url.toString();
}
```

`AIGatewayProviders` is the Cloudflare Workers type for AI Gateway provider slugs (from `@cloudflare/workers-types`, global `Ai` types).

### **Bearer** vs **`cf-aig-authorization`**

- The **OpenAI SDK** is constructed with `apiKey` = provider key (or gateway token when no valid provider key) and `baseURL` = gateway URL (for the normal path).

```560:571:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
        const { apiKey, baseURL, defaultHeaders } = await getConfigurationForModel(
            modelConfig,
            env,
            metadata.userId,
            runtimeOverrides,
        );
        console.log(`baseUrl: ${baseURL}, modelName: ${modelName}`);

        // Remove [*.] from model name
        modelName = modelName.replace(/\[.*?\]/, '');

        const client = new OpenAI({ apiKey, baseURL: baseURL, defaultHeaders });
```

- **`cf-aig-authorization`:** When there is a gateway token **and** it differs from `apiKey`, it is sent as `defaultHeaders` so the gateway can authenticate while `Authorization` carries the upstream provider key (“wholesaling” pattern).

```323:330:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
    // AI Gateway wholesaling: when using BYOK provider key + platform gateway token
    const defaultHeaders = gatewayToken && apiKey !== gatewayToken ? {
        'cf-aig-authorization': `Bearer ${gatewayToken}`,
    } : undefined;
    return {
        baseURL,
        apiKey,
        defaultHeaders
    };
```

Gateway token resolution: platform token vs custom gateway override is in `getConfigurationForModel` / `getApiKey`:

```312:274:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
    const gatewayOverride = runtimeOverrides?.aiGatewayOverride;
    const isUsingCustomGateway = !!gatewayOverride?.baseUrl;
    const baseURL = await buildGatewayUrl(env, providerForcedOverride, gatewayOverride);

    const gatewayToken = isUsingCustomGateway
        ? gatewayOverride?.token
        : (gatewayOverride?.token ?? env.CLOUDFLARE_AI_GATEWAY_TOKEN);  // Platform gateway

    // Try to find API key of type <PROVIDER>_API_KEY else default to gateway token
    const apiKey = await getApiKey(modelConfig.provider, env, userId, runtimeOverrides);
```

```247:275:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
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
    
    // Check if apiKey is empty or undefined and is valid
    if (!isValidApiKey(apiKey)) {
        // only use platform token if NOT using a custom gateway URL
        // User's gateway = user's credentials only
        if (runtimeOverrides?.aiGatewayOverride?.baseUrl) {
            // User provided custom gateway
            apiKey = runtimeOverrides.aiGatewayOverride.token ?? '';
        } else {
            apiKey = runtimeOverrides?.aiGatewayOverride?.token ?? env.CLOUDFLARE_AI_GATEWAY_TOKEN;
        }
    }
    return apiKey;
}
```

### **`cf-aig-metadata`**

Every chat completion request adds metadata JSON (agent id, user id, schema name, action key):

```684:704:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\core.ts
            response = await client.chat.completions.create({
                ...schemaObj,
                ...extraBody,
                ...toolsOpts,
                model: modelName,
                messages: messagesToPass as OpenAI.ChatCompletionMessageParam[],
                max_completion_tokens: maxTokens || 150000,
                stream: stream ? true : false,
                reasoning_effort: modelConfig.nonReasoning ? undefined : reasoning_effort,
                temperature,
                frequency_penalty,
            }, {
                signal: abortSignal,
                headers: {
                    "cf-aig-metadata": JSON.stringify({
                        chatId: metadata.agentId,
                        userId: metadata.userId,
                        schemaName,
                        actionKey,
                    })
                }
            });
```

The **user-app OpenAI proxy** repeats the same pattern: `Authorization: Bearer ${apiKey}`, optional `defaultHeaders` (including `cf-aig-authorization`), and `cf-aig-metadata`:

```152:175:c:\Users\mikeh\Projects\landi\landibuild\worker\services\aigateway-proxy\controller.ts
        const { baseURL, apiKey, defaultHeaders } = await getConfigurationForModel(
            AI_MODEL_CONFIG[modelName as AIModels],
            env,
            app.userId
        );

        console.log(`[AI Proxy] Forwarding request to model: ${modelName}, baseURL: ${baseURL}`);

        const proxyHeaders = new Headers();
        proxyHeaders.set('Content-Type', 'application/json');
        proxyHeaders.set('Authorization', `Bearer ${apiKey}`);
        
        if (defaultHeaders) {
            Object.entries(defaultHeaders).forEach(([key, value]) => {
                proxyHeaders.set(key, value);
            });
        }
        // Add metadata for tracking
        proxyHeaders.set('cf-aig-metadata', JSON.stringify({
            appId: app.id,
            userId: app.userId,
            source: 'user-app-proxy',
            model: modelName
        }));
```

---

## 2) Difficulty removing/replacing the gateway while keeping OpenAI-compatible clients

The **client** is already **OpenAI SDK → arbitrary `baseURL`**. The gateway is not baked into the SDK type; it is **URL + header policy** in one module and its callers.

**Concrete touchpoints:**

| Area | Role |
|------|------|
| `worker/agents/inferutils/core.ts` | `buildGatewayUrl`, `getConfigurationForModel`, `getApiKey`, `cf-aig-*` headers, `directOverride` branch |
| `worker/services/aigateway-proxy/controller.ts` | Same `getConfigurationForModel` for `/api/proxy/openai` |
| `wrangler.jsonc` | `ai` binding + `CLOUDFLARE_AI_GATEWAY` var |
| `worker-configuration.d.ts` | Env shape (regenerated from Wrangler) |
| `scripts/setup.ts`, `.dev.vars.example`, `docs/setup.md` | Onboarding assumes gateway |
| `README.md` | Operational troubleshooting for gateway |

**To replace the gateway with another OpenAI-compatible proxy** (LiteLLM, Bifrost, provider-native `/v1`, etc.):

- Point `baseURL` at that endpoint: either set `CLOUDFLARE_AI_GATEWAY_URL` to the proxy base (still goes through `buildGatewayPathname` → `/compat` or `/{provider}`) **or** refactor to stop appending `/compat` when using a non–AI-Gateway URL.
- Stop sending **`cf-aig-authorization`** / **`cf-aig-metadata`** if the replacement does not understand them (today they are harmless extra headers only if ignored, but you may want to gate them).
- **`env.AI.gateway(...)`** fallback: removing the `ai` binding requires always setting a full base URL or a new resolution strategy.

**Difficulty:** **Medium-low** for a single-tenant deploy (env-only base URL + provider keys). **Medium** for multi-tenant parity (per-user base URLs already partially exist via `aiGatewayOverride` in `InferenceRuntimeOverrides`).

---

## 3) BYOK today: DB, env, runtime overrides, `getApiKey`, AuthService

### `getApiKey` (authoritative)

- **First:** `runtimeOverrides.userApiKeys[provider]` if valid.
- **Else:** `env[`${PROVIDER}_API_KEY`]` (e.g. `OPENAI_API_KEY`).
- **Else:** If no valid provider key: use `runtimeOverrides.aiGatewayOverride.token` or `env.CLOUDFLARE_AI_GATEWAY_TOKEN`, with a special case when `aiGatewayOverride.baseUrl` is set (user’s gateway → token from override).

**`_userId` is unused** — there is **no per-user key load from DB** inside `getApiKey`.

### **AuthService**

`AuthService` handles **identity / OAuth / email** — **not** LLM provider keys. No BYOK storage there (grep shows only OAuth/email “provider” usage).

### **Runtime BYOK path that does work**

- **`CredentialsPayload`** → **`credentialsToRuntimeOverrides`** → passed into **`InferenceContext.runtimeOverrides`** when starting code generation:

```125:136:c:\Users\mikeh\Projects\landi\landibuild\worker\api\controllers\agent\controller.ts
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

Types:

```426:468:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\inferutils\config.types.ts
export type InferenceRuntimeOverrides = {
	/** Provider API keys (BYOK) keyed by provider id, e.g. "openai" -> key. */
	userApiKeys?: Record<string, string>;
	/** Optional AI gateway override (baseUrl + token). */
	aiGatewayOverride?: { baseUrl: string; token: string };
};
// ...
export type CredentialsPayload = {
	providers?: Record<string, { apiKey: string }>;
	aiGateway?: { baseUrl: string; token: string };
};

export function credentialsToRuntimeOverrides(
	credentials: CredentialsPayload | undefined,
): InferenceRuntimeOverrides | undefined {
	if (!credentials) return undefined;

	const userApiKeys: Record<string, string> = {};
	for (const [provider, v] of Object.entries(credentials.providers ?? {})) {
		if (v.apiKey) userApiKeys[provider] = v.apiKey;
	}

	const hasKeys = Object.keys(userApiKeys).length > 0;
	return {
		...(hasKeys ? { userApiKeys } : {}),
		...(credentials.aiGateway ? { aiGatewayOverride: credentials.aiGateway } : {}),
	};
}
```

`executeInference` forwards `context.runtimeOverrides` into `infer()` (see `infer.ts` 179, 194).

### **WebSocket path**

`worker/agents/core/websocket.ts` has **commented-out** wiring to apply credentials from messages — not active.

### **Settings / “BYOK” UX vs backend**

- **`user_model_configs`** stores **per-user model choice** (model name, tokens, temperature, etc.), **not** API keys:

```452:463:c:\Users\mikeh\Projects\landi\landibuild\worker\database\schema.ts
export const userModelConfigs = sqliteTable('user_model_configs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Configuration Details
    agentActionName: text('agent_action_name').notNull(), // Maps to AgentActionKey from config.ts
    modelName: text('model_name'), // Override for AIModels - null means use default
    maxTokens: integer('max_tokens'), // Override max tokens - null means use default
    temperature: real('temperature'), // Override temperature - null means use default
    reasoningEffort: text('reasoning_effort', { enum: REASONING_EFFORT_VALUES }), // Override reasoning effort  
    providerOverride: text('provider_override', { enum: PROVIDER_OVERRIDE_VALUES }), // Override provider
    fallbackModel: text('fallback_model'), // Override fallback model
```

- **`user_model_providers`** + **`secret_id`** exist for **custom OpenAI-compatible endpoints** with vault-backed secrets (schema), with `ModelProvidersService` — parallel track to gateway BYOK, not wired into `getApiKey` today.

- **`getUserProviderStatus`** in `byokHelper.ts` currently returns **all BYOK templates with `hasValidKey: false`** (stubs). So **`validateModelAccessForEnvironment`** effectively only admits models whose providers have **platform** env keys:

```5:19:c:\Users\mikeh\Projects\landi\landibuild\worker\api\controllers\modelConfig\byokHelper.ts
export async function getUserProviderStatus(
	_userId: string,
	_env: Env,
): Promise<UserProviderStatus[]> {
	try {
		const byokTemplates = getBYOKTemplates();

		return byokTemplates.map((template) => ({
			provider: template.provider,
			hasValidKey: false,
		}));
```

- **Model config test endpoint** never passes user keys: `userApiKeys` is hard-coded `undefined`:

```298:306:c:\Users\mikeh\Projects\landi\landibuild\worker\api\controllers\modelConfig\controller.ts
			const userApiKeys: Record<string, string> | undefined = undefined;


            // Test the configuration
            const testResult = await modelTestService.testModelConfig({
                modelConfig: configToTest,
                userApiKeys,
                testPrompt: validatedData.testPrompt
            });
```

(`ModelTestService` *can* accept `userApiKeys` when provided — see `ModelTestService.testModelConfig` 39–41.)

### **Direct (non-gateway) path in code**

`getConfigurationForModel` can return fixed **OpenRouter / Google AI Studio OpenAI shim / Anthropic** URLs and env keys if `modelConfig.directOverride` is true. **No entry in `MODELS_MASTER` sets `directOverride` in the current `config.types.ts` catalog**, so in practice **all catalog models use the gateway URL path** unless you add that flag to a model.

---

## 4) What’s needed for user-configurable BYOK in UI + secure storage

**Today:** UI can configure **models** (`Settings` + `ModelConfigTabs`, `getModelConfigs` / `updateModelConfig`). **Persisted BYOK keys for inference** are not wired end-to-end: stubbed provider status, test path ignores user keys, `getApiKey` ignores `userId`.

**To ship real BYOK:**

1. **Storage**
   - Prefer **encryption**: existing **UserSecretsStore** (DO + client VMK) and/or **`user_secrets`** / `secret_id` on `user_model_providers` pattern.
   - Avoid plaintext provider keys in D1; if stored server-side, use **`SECRETS_ENCRYPTION_KEY`** (already on `Env`) with audited crypto and tight access.

2. **Read path in inference**
   - Extend **`getApiKey`** (or a small `UserKeyResolver`) to load **per-user** secrets by `userId` + provider (from vault metadata or encrypted columns) and merge with `runtimeOverrides`.
   - Ensure **agent code generation** can attach the same keys without requiring the client to resend `credentials` every time (today only request-body credentials populate `runtimeOverrides`).

3. **BYOK helper**
   - Implement **`getUserProviderStatus`** to reflect **actual** stored keys (not always `false`).

4. **Model config validation**
   - **`validateModelAccessForEnvironment`** should use the real status so users can select models when their BYOK is present.

5. **Testing / settings**
   - **`testModelConfig`**: load user keys when `useUserKeys` is true (schema already has it; controller ignores it).
   - **`testProviderKey`** already tests a key via `runtimeOverrides.userApiKeys` — reuse that pattern from the UI.

6. **API surface**
   - Secure endpoints: save/delete masked keys, never log full keys, rate-limit, audit.

7. **Optional:** Wire **`user_model_providers`** + vault `secret_id` into `getConfigurationForModel` for **custom base URLs** (true “bring your own endpoint”).

---

## 5) Workers AI integration given current abstractions

**Current usage of `env.AI`:** only **`env.AI.gateway(...).getUrl()`** for gateway URL resolution — **no** `env.AI.run()` / Workers AI chat models in the inference stack.

**`infer` stack:** **`OpenAI` SDK** + **`chat.completions.create`** + optional **streaming** (`Stream` iteration) in `core.ts` (728+). Model IDs are **provider-prefixed strings** from `AIModels` (e.g. `google-ai-studio/gemini-2.5-flash`), which match **AI Gateway’s OpenAI-compatible** naming, not necessarily `@cf/meta/...` Workers AI model names.

**To add Workers AI as a backend:**

1. **Binding:** `AI` is already in `wrangler.jsonc`; you’d use **`env.AI.run(model, options)`** (or current Workers AI API per Cloudflare docs) on a **separate code path** when `modelConfig.provider === 'cloudflare'` (or a new flag).
2. **Model naming:** map internal `AIModels` entries to **`@cf/...`** (or whatever the binding expects) — different from gateway slash-prefixed IDs.
3. **Streaming:** Workers AI streaming is **not** OpenAI’s SSE chunk format; you’d either:
   - wrap Workers AI output into the same **`stream.onChunk`** contract used today, or
   - branch in `infer()` and avoid the OpenAI `Stream` path for that provider.
4. **Tools / JSON schema / `response_format`:** would need explicit compatibility work; Workers AI may not match OpenAI tool + structured-output behavior.
5. **Headers:** `cf-aig-*` are gateway-specific; Workers AI path would omit them.

**Net:** the codebase is **structured around one OpenAI-shaped client**; Workers AI is a **second implementation** behind a provider switch, not a config tweak.

---

## DoD self-check (subagent-original)

- Read **`worker/agents/inferutils/core.ts`** and traced **URL resolution**, **`getApiKey`**, **`getConfigurationForModel`**, **`cf-aig-authorization`**, **`cf-aig-metadata`**, and **OpenAI client** usage with line citations.
- Checked **config types** (`InferenceRuntimeOverrides`, `CredentialsPayload`), **agent controller** credential wiring, **BYOK helper stub**, **model config test** `userApiKeys` gap, **schema** (`user_model_configs`, `user_model_providers`), **proxy** and **`wrangler.jsonc`** / **`worker-configuration.d.ts`**.
- Confirmed **AuthService** does not implement LLM BYOK.
- Confirmed **`env.AI`** is used for **gateway URL only**, not Workers AI chat **`run`**.
- No feature removal; analysis only.
