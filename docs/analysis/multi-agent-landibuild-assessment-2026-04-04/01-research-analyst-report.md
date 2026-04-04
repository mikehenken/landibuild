# Research analyst report (subagent: research-analyst)

**← [Back to index](./00-coordinator-verification-gap-analysis-and-index.md)** · [02](./02-search-specialist-report.md) · [03](./03-architect-reviewer-report.md) · [04](./04-ai-engineer-report.md) · [05](./05-refactoring-specialist-report.md) · [06](./06-context-manager-report.md) · [07](./07-follow-up-clarifications.md)

Source: Cursor Task subagent `research-analyst`, workspace `c:\Users\mikeh\Projects\landi\landibuild`. Content below is **full subagent output** (coordinator did not truncate).

---

# Landibuild repository research report

This report is based on direct reads and searches under `c:\Users\mikeh\Projects\landi\landibuild`. Paths are repo-relative unless noted.

---

## 1. High-level architecture

### 1.1 Runtime shape: one Worker, SPA assets, and subdomain traffic

The deployable unit is a **Cloudflare Worker** whose entry module is `worker/index.ts` (`wrangler.jsonc` sets `"main": "worker/index.ts"`). The Worker’s `fetch` handler implements **hostname-based routing**:

- **Main platform host** — Requests where `hostname === env.CUSTOM_DOMAIN` or `hostname === 'localhost'`:
  - Git protocol URLs under `/apps/:id.git/...` are handled by `handleGitProtocolRequest` (`worker/api/handlers/git-protocol`).
  - Non-`/api/*` paths are served from the **`ASSETS`** binding (`env.ASSETS.fetch(request)`), configured in `wrangler.jsonc` with `"directory": "dist"` and `"not_found_handling": "single-page-application"`, so the Vite-built React app handles client-side routes.
  - `/api/proxy/openai` is proxied through `proxyToAiGateway` (`worker/services/aigateway-proxy/controller.ts`).
  - All other `/api/*` traffic goes to a **Hono** app from `createApp(env)` (`worker/app.ts`).

- **Subdomain / preview host** — Requests where the host looks like `*.${previewDomain}` or `*.localhost` (but not bare `localhost`) are handled by `handleUserAppRequest`:
  - Subdomains starting with `b-` are treated as **agent browser file serving** and forwarded via `getAgentStub` → `agentStub.handleBrowserFileServing` (`worker/agents/index.ts`, `CodeGeneratorAgent`).
  - Otherwise `proxyToSandbox` (`worker/services/sandbox/request-handler.ts`) tries the **live sandbox**; on miss, **`DISPATCHER`** (`dispatch_namespaces` binding) loads a user worker by app name.

```141:211:c:\Users\mikeh\Projects\landi\landibuild\worker\index.ts
const worker = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // ...
		const isMainDomainRequest =
			hostname === env.CUSTOM_DOMAIN || hostname === 'localhost';
		const isSubdomainRequest =
			hostname.endsWith(`.${previewDomain}`) ||
			(hostname.endsWith('.localhost') && hostname !== 'localhost');

		if (isMainDomainRequest) {
			if (isGitProtocolRequest(pathname)) {
				return handleGitProtocolRequest(request, env, ctx);
			}
			if (!pathname.startsWith('/api/')) {
				return env.ASSETS.fetch(request);
			}
			if (pathname.startsWith('/api/proxy/openai')) {
                return proxyToAiGateway(request, env, ctx);
			}
			const app = createApp(env);
			return app.fetch(request, env, ctx);
		}

		if (isSubdomainRequest) {
			return handleUserAppRequest(request, env);
		}

		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
```

### 1.2 Frontend (`src/`) entry and routing

- **Bootstrap:** `src/main.tsx` calls `createBrowserRouter(routes)` with `routes` from `src/routes.ts`, then `RouterProvider`.
- **Shell:** `src/App.tsx` wraps the tree in `ErrorBoundary`, `ThemeProvider`, `FeatureProvider`, `AuthProvider`, `VaultProvider`, `AuthModalProvider`, and `AppLayout` with `<Outlet />` for nested routes.

```1:27:c:\Users\mikeh\Projects\landi\landibuild\src\main.tsx
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { initSentry } from './utils/sentry';

import { routes } from './routes.ts';
import './index.css';

initSentry();

const router = createBrowserRouter(routes, {
	hydrationData: window.__staticRouterHydrationData,
});

createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
);
```

**`src/routes.ts`** defines the route tree: `/` → `App`, with children including `chat/:chatId` → `Chat`, `profile` / `settings` / `apps` behind `ProtectedRoute`, `app/:id`, `discover`, `auth/callback`, `login`.

### 1.3 Vite + Cloudflare integration

`vite.config.ts` uses `@cloudflare/vite-plugin` with `configPath: 'wrangler.jsonc'`, aliases `@` → `./src`, `worker` → `./worker`, `shared` → `./shared`. On Windows it disables container dev (`enable_containers: false`) because the plugin cannot build/pull sandbox images natively.

### 1.4 How bindings fit together

From `wrangler.jsonc` and generated `worker-configuration.d.ts`:

| Binding | Role in this codebase (evidence) |
|--------|----------------------------------|
| **`DB`** (D1) | Drizzle ORM access via `worker/database/database.ts`; users, sessions, apps, model configs, etc. (`worker/database/schema.ts`). |
| **`VibecoderStore`** (KV) | Rate limits (`worker/services/rate-limit/rateLimits.ts`), cache (`worker/services/cache/KVCache.ts`), global/user config (`worker/config/index.ts`), sandbox wrangler config blobs (`worker/services/sandbox/sandboxSdkClient.ts`). |
| **`TEMPLATES_BUCKET`** (R2) | Template catalog and assets (`worker/services/sandbox/BaseSandboxService.ts`), image uploads (`worker/utils/images.ts`), screenshots (`worker/api/controllers/screenshots/controller.ts`). |
| **`AI`** | Workers AI binding; used in `worker/agents/inferutils/core.ts` as `env.AI.gateway(env.CLOUDFLARE_AI_GATEWAY)` to resolve gateway URLs. |
| **`CodeGenObject`** | Durable Object namespace for **`CodeGeneratorAgent`** — core codegen/chat agent (`worker/agents/core/codingAgent.ts`). |
| **`Sandbox`** | Durable Object namespace for **`UserAppSandboxService`** — container-backed dev sandbox (`worker/services/sandbox/sandboxSdkClient.ts` export). |
| **`DISPATCHER`** | Dispatch namespace for permanently deployed user workers after sandbox miss (`worker/index.ts`). |
| **`DORateLimitStore`** | Rate limiting durable object (`worker/index.ts` re-export). |
| **`UserSecretsStore`** | User secrets vault DO (`worker/index.ts` export). |
| **`ASSETS`** | Static SPA from `dist`. |
| **`API_RATE_LIMITER` / `AUTH_RATE_LIMITER`** | Unsafe ratelimit bindings used by rate-limit services. |

### 1.5 Worker HTTP API routing (Hono)

`createApp` (`worker/app.ts`) stacks:

1. `secureHeaders` (skipped for WebSocket upgrade).
2. `cors` on `/api/*`.
3. CSRF middleware (`CsrfService`) for non-upgrade requests.
4. Per-request **global config** + **`RateLimitService.enforceGlobalApiRateLimit`** on `/api/*`.
5. **Default auth:** `app.use('/api/*', setAuthLevel(AuthConfig.ownerOnly))` — so routes are **owner-only unless a route overrides** with `setAuthLevel` on the specific handler.
6. `setupRoutes(app)` from `worker/api/routes/index.ts`.
7. `notFound` → `env.ASSETS.fetch` (SPA fallback for unknown API paths).

`adaptController` (`worker/api/honoAdapter.ts`) always runs **`enforceAuthRequirement`** before controllers, which resolves **ticket auth** (e.g. agent WebSocket) or **JWT** via `authMiddleware` → `AuthService.validateTokenAndGetUser`.

**Route modules** mounted from `setupRoutes` include: `setupSentryRoutes`, `setupStatusRoutes`, `setupCapabilitiesRoutes`, `setupAuthRoutes` (`/api/auth`), `setupTicketRoutes`, `setupCodegenRoutes`, `setupUserRoutes`, `setupAppRoutes`, `setupStatsRoutes`, `setupAnalyticsRoutes`, `setupModelConfigRoutes`, `setupModelProviderRoutes`, `setupGitHubExporterRoutes`, `setupScreenshotRoutes`, plus public `GET /api/health`.

**Agent-facing HTTP API** (`worker/api/routes/codegenRoutes.ts`):

- `POST /api/agent` — start generation (`CodingAgentController.startCodeGeneration`), **authenticated**.
- `GET /api/agent/:agentId/ws` — WebSocket; **`AuthConfig.ownerOnly` + `ticketAuth`** for SDK tickets.
- `GET /api/agent/:agentId/connect` — **owner only**.
- `GET /api/agent/:agentId/preview` — **authenticated** (public-app preview rules inside controller).

---

## 2. Repository structure (key directories)

Evidence from glob/listing and file reads:

- **`src/`** — React 19 SPA: `routes/`, `components/` (UI primitives under `components/ui/`, layout under `components/layout/`), `contexts/`, `hooks/`, `lib/` (`api-client.ts`, `supabase-browser-client.ts`, `landi-platform-nav-config.ts`), `features/` (feature modules), `utils/`, `main.tsx`, `App.tsx`, `routes.ts`, `api-types.ts` (re-exports worker types for the client).
- **`worker/`** — Cloudflare Worker: `index.ts` (fetch entry, DO exports), `app.ts` (Hono factory), `api/` (routes, controllers, `honoAdapter.ts`, websocket types), `agents/` (DO agent, tools, inferutils, operations, planning), `database/` (Drizzle schema, services, `AppService`, `AuthService`, etc.), `middleware/` (auth, security), `services/` (sandbox, secrets, rate-limit, static-analysis, github, aigateway-proxy, cache), `utils/`, `config/`, `logger`, `types/`.
- **`shared/`** — Cross-cutting types/errors consumed as `shared/types/errors` etc.
- **`migrations/`** — D1 SQL migrations (referenced by wrangler `migrations_dir`).
- **`public/`** — Static files for Vite `public/`.
- **`scripts/`** — e.g. `setup.ts`, deploy.
- **`cli/`** — CLI / TUI entrypoints (`package.json` scripts `cli`, `tui`).
- **`docs/`** — API collections and docs.
- **`landi-labs/studies/`** — Study artifacts (not runtime).
- **Root config:** `vite.config.ts`, `wrangler.jsonc`, `worker-configuration.d.ts` (Wrangler-generated `Env`), `package.json`, test configs.

---

## 3. How AI / agent features are wired

### 3.1 Agents SDK and the Durable Object agent

- Package **`agents`** (`package.json` `"agents": "^0.2.32"`).
- **`CodeGeneratorAgent`** in `worker/agents/core/codingAgent.ts` **extends** `Agent<Env, AgentState>` from `agents`, implements codegen lifecycle, WebSocket handling (`./websocket`), file/deployment services, SQLite via `this.sql` for conversation tables, and behavior strategies **`PhasicCodingBehavior`** vs **`AgenticCodingBehavior`** chosen in `onStart` from `behaviorType`.

Stub acquisition uses **`getAgentByName`** from the `agents` package:

```21:28:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\index.ts
export async function getAgentStub(
    env: Env, 
    agentId: string,
    props?: AgentStubProps
) : Promise<DurableObjectStub<CodeGeneratorAgent>> {
    const options = props ? { props } : undefined;
    return getAgentByName<Env, CodeGeneratorAgent>(env.CodeGenObject, agentId, options);
}
```

### 3.2 Controller → agent bootstrap

`CodingAgentController.startCodeGeneration` (`worker/api/controllers/agent/controller.ts`):

1. Parses **`CodeGenArgs`** (query, `projectType`, `behaviorType`, templates, images, credentials).
2. Resolves **`behaviorType`** via `resolveBehaviorType` (e.g. `presentation` / `workflow` / `general` → **`agentic`**, default **`phasic`** for `app`).
3. Builds **`inferenceContext`** with `agentId`, `userId`, per-action **`userModelConfigs`**, and **`runtimeOverrides`** from `credentialsToRuntimeOverrides`.
4. Calls **`getTemplateForQuery`** (`worker/agents/index.ts`) for template selection / scratch.
5. Opens an **NDJSON/SSE-style stream** to the client with `agentId`, `websocketUrl`, blueprint chunks, etc.
6. Gets stub via **`getAgentStub(env, agentId, { behaviorType, projectType })`** and calls **`agentInstance.initialize(initArgs)`**.

### 3.3 Tools

- Tool definitions live under **`worker/agents/tools/toolkit/`** (e.g. `web-search`, `deploy-preview`, `deep-debugger`, `git`, `generate-files`, …).
- **`buildTools`** and **`buildDebugTools`** in **`worker/agents/tools/customTools.ts`** assemble `ToolDefinition[]` for the main agent vs deep-debug sessions; **`withRenderer`** wraps `onStart`/`onComplete` to emit UI-oriented tool call events via `RenderToolCall`.

```42:63:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\tools\customTools.ts
export function buildTools(
    agent: ICodingAgent,
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void,
): ToolDefinition<any, any>[] {
    return [
        toolWebSearchDefinition,
        toolFeedbackDefinition,
        createQueueRequestTool(agent, logger),
        createGetLogsTool(agent, logger),
        createDeployPreviewTool(agent, logger),
        createWaitForGenerationTool(agent, logger),
        createWaitForDebugTool(agent, logger),
        createRenameProjectTool(agent, logger),
        createAlterBlueprintTool(agent, logger),
        createGitTool(agent, logger, { excludeCommands: ['reset'] }),
        createDeepDebuggerTool(agent, logger, toolRenderer, streamCb),
    ];
}
```

### 3.4 `inferutils` (inference stack)

Files under **`worker/agents/inferutils/`** include:

- **`infer.ts`** — **`executeInference`**: merges **user model config** with **`AGENT_CONFIG`** defaults (`resolveModelConfig`), applies **constraint validation** via `validateAgentConstraints`, handles retries/backoff, structured vs string outputs (Zod schema branch), streaming, and delegates to **`infer`** in **`core.ts`**.
- **`core.ts`** — OpenAI client construction, **Cloudflare AI Gateway URL** resolution (`getGatewayBaseUrl`: `CLOUDFLARE_AI_GATEWAY_URL` override vs **`env.AI.gateway(env.CLOUDFLARE_AI_GATEWAY)`**), **`getApiKey`** (BYOK / env keys / gateway token), tool-call loop plumbing (`executeToolCallsWithDependencies` from **`toolExecution.ts`**), completion detection (`completionDetection.ts`), schema formatters (`schemaFormatters.ts`), etc.
- **`config.ts` / `config.types.ts`** — **`AgentActionKey`**, **`InferenceContext`**, model names, **`credentialsToRuntimeOverrides`**, etc.
- **`toolExecution.ts`**, **`loopDetection.ts`**, **`completionDetection.ts`**, **`common.ts`** — execution and message types.

**Call sites of `executeInference`** (grep) span planning and operations: `templateSelector.ts`, `blueprint.ts`, `UserConversationProcessor.ts`, `PhaseGeneration.ts`, `PhaseImplementation.ts`, `SimpleCodeGeneration.ts`, `PostPhaseCodeFixer.ts`, `operations/common.ts`, `conversationCompactifier.ts`, `assistants/realtimeCodeFixer.ts`, `assistants/projectsetup.ts`.

### 3.5 Platform “features” (backend)

Backend feature flags and defaults live in **`worker/agents/core/features/`** (`types.ts`, `DEFAULT_FEATURE_DEFINITIONS`). **`CapabilitiesController.getCapabilities`** merges **`env.PLATFORM_CAPABILITIES`** from wrangler with those defaults and exposes **`GET /api/capabilities`** — consumed by the frontend **`FeatureProvider`** (`src/features/core/context.tsx`).

---

## 4. Auth model (Supabase + Worker)

### 4.1 Primary model: first-party sessions in D1 + JWT

- **Users and sessions** are modeled in **`worker/database/schema.ts`** (`users`, `sessions`, `api_keys`, …).
- **`AuthService`** (`worker/database/services/AuthService.ts`) implements register/login/OAuth/API keys, and **`validateTokenAndGetUser`** (used from **`authMiddleware`** in `worker/middleware/auth/auth.ts`).
- Tokens are extracted via **`extractToken`** (`worker/utils/authUtils.ts` — not expanded here but referenced by middleware).

### 4.2 Route-level enforcement

- Global default on `/api/*` is **`AuthConfig.ownerOnly`** (`worker/app.ts`).
- Per-route overrides use **`setAuthLevel(AuthConfig.public | authenticated | ownerOnly)`** on routers/handlers (`worker/api/routes/authRoutes.ts`, `codegenRoutes.ts`, etc.).
- **`enforceAuthRequirement`** (`worker/middleware/auth/routeAuth.ts`):
  - Optional **ticket** auth (`authenticateViaTicket`, `hasTicketParam`) for resources like **`agent`** WebSocket.
  - Else **JWT** via **`authMiddleware`** → session user + **`getUserConfigurableSettings`** + auth rate limits.
  - **`checkAppOwnership`** uses **`AppService.checkAppOwnership`** for `agentId` / `id` params.

### 4.3 Supabase bridge (optional)

- **`USE_SUPABASE_AUTH`**, **`SUPABASE_URL`**, **`SUPABASE_JWT_SECRET`**, OAuth flags appear in **`worker-configuration.d.ts`** / `wrangler.jsonc`.
- **Public route** `POST /api/auth/supabase` → **`AuthController.bridgeSupabase`** (`worker/api/controllers/auth/controller.ts`): requires Supabase mode enabled, accepts Bearer or JSON `access_token`, calls **`AuthService.exchangeSupabaseAccessToken`**, which **verifies the Supabase JWT** with **`jose` `jwtVerify`** (issuer `${SUPABASE_URL}/auth/v1`, audience `authenticated`, HS256), then **`findOrCreateOAuthUser('supabase', ...)`** and creates a **Worker session** + **httpOnly cookies** via **`setSecureAuthCookies`**.

Frontend **`src/routes/auth/supabase-callback.tsx`** and **`src/lib/supabase-browser-client.ts`** participate in the browser-side Supabase flow; the **authoritative bridge** to the Worker session is the **`/api/auth/supabase`** contract above.

### 4.4 CSRF

`worker/app.ts` integrates **`CsrfService`** for double-submit cookie behavior on API requests, with rotation on auth in **`bridgeSupabase`** when configured.

---

## 5. UI patterns: tabs, modes, extensibility

### 5.1 Radix/shadcn **Tabs**

- **`src/components/ui/tabs.tsx`** wraps **`@radix-ui/react-tabs`** (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`).
- **Usage examples:**
  - **`src/routes/profile.tsx`** — multi-tab profile (About, Apps, Achievements, Activity).
  - **`src/routes/app/index.tsx`** — large tabbed surface (e.g. preview / code / additional tab content).
  - **`src/components/model-config-tabs.tsx`** + **`src/routes/settings/index.tsx`** — model configuration tabs.
  - **`src/components/byok-api-keys-modal.tsx`** — Add vs Manage tabs.
  - **`src/components/shared/ModelConfigInfo.tsx`** — dynamic tab list.
  - **`src/components/shared/AppSortTabs.tsx`** — used on **`src/routes/apps/index.tsx`** and **`src/routes/discover/index.tsx`** for sort modes (tabs as filter UI).

### 5.2 “Modes” in the chat / builder UX

- **`src/routes/chat/chat.tsx`** drives **project type from URL** (`projectType` query, default `'app'`), loads existing app via **`useApp`**, and **`useChat`** exposes **`behaviorType`**, **`projectType`**, phase timeline, deployment, debugging flags, etc. — these are **behavioral modes** tied to backend **`BehaviorType`** / **`ProjectType`**, not a single React `mode` enum.
- **Debug tooling** is explicit: `DebugMessage`, `PhaseTimeline`, vault unlock hooks, etc.

### 5.3 Extensibility: feature registry and views

- **`src/features/index.ts`** registers **`app`**, **`presentation`**, and **`general`** with **`featureRegistry.register(...)`** and lazy `import()` loaders.
- **`FeatureRegistry`** (`src/features/core/registry.ts`) supports **`updateFromCapabilities`**, lazy **`load`**, **`getLazyPreviewComponent`**, **`getLazyHeaderActionsComponent`**, keyed by **`ProjectType`**.
- **`FeatureProvider`** fetches **`apiClient.getCapabilities()`**, updates the registry, and loads modules when **`activeFeatureId`** changes; exposes **`getViews`**, **`processFiles`**, etc.
- **`FeatureContext`** (`src/features/core/types.ts`) includes **`currentView: ViewMode`**, **`onViewChange`**, preview/editor refs, blueprint, websocket — the **view mode** abstraction for feature UIs.
- **`ViewMode`** in **`worker/agents/core/features/types.ts`** is **`'editor' | 'preview' | 'docs' | 'blueprint' | 'terminal' | (string & {})`** — explicitly allowing **custom string views** per feature.
- **`FeatureDefinition`** includes optional **`moduleUrl`** for **external feature modules** (future/plugin-style loading), alongside **`FeatureCapabilities`** (`supportedViews`, `hasCustomHeaderActions`, `hasCustomSidebar`, `hasCustomFileFilter`, etc.).

Together, this is a **capability-driven, lazy-loaded feature plugin** pattern on the frontend, aligned with **`PLATFORM_CAPABILITIES`** and **`/api/capabilities`** on the backend.

---

## Definition of Done self-check (subagent-original)

| Item | Verified in repo | Assumed / not fully traced |
|------|------------------|----------------------------|
| Worker entry and domain routing | Read `worker/index.ts`, `wrangler.jsonc` | Exact implementation of `proxyToSandbox`, git protocol handler, and ticket service not fully read line-by-line |
| SPA asset serving + SFA | `wrangler.jsonc` `assets`, `worker/index.ts` | Production CDN/cache behavior outside Worker config |
| Hono app middleware order | Read `worker/app.ts` | Every individual controller body beyond agent/auth/capabilities samples |
| API route inventory | Read `worker/api/routes/index.ts` + grep for `app.route` / `app.get` | Commented-out `userSecretsRoutes` / `secretsRoutes` noted but not analyzed |
| D1 schema surface | Read start of `worker/database/schema.ts` | Full table list beyond first sections |
| KV / R2 usage | Grep `VibecoderStore`, `TEMPLATES_BUCKET` | All call sites (grep capped at representative set) |
| AI Gateway + `env.AI` | Read `inferutils/core.ts` around `getGatewayBaseUrl` | Full OpenAI streaming/tool loop in `core.ts` (only partial read) |
| Agent class + stub API | Read `codingAgent.ts` (partial), `agents/index.ts`, codegen controller (partial) | Full `CodeGeneratorAgent` method list and websocket protocol |
| Tools registration | Read `customTools.ts` | Each toolkit file’s implementation |
| `executeInference` consumers | Grep across `worker/agents` | Each call’s parameters and error paths |
| Auth: JWT middleware | Read `auth.ts`, `routeAuth.ts` (full), `honoAdapter.ts` | `extractToken` implementation details |
| Auth: Supabase bridge | Read `AuthController.bridgeSupabase` and `AuthService.exchangeSupabaseAccessToken` | Frontend `supabase-callback.tsx` / browser client flow not read in this pass |
| Frontend routes | Read `src/routes.ts`, `App.tsx`, `main.tsx` | Every route component’s internal state |
| Tabs usage | Grep `Tabs` / `@radix-ui/react-tabs` | Every tab instance’s business logic |
| Feature extensibility | Read `registry.ts`, `context.tsx`, `features/index.ts`, `features/core/types.ts`, `worker/agents/core/features/types.ts`, `CapabilitiesController` | Runtime loading of `moduleUrl` (field exists; loader behavior not validated end-to-end) |
| `worker-configuration.d.ts` vs wrangler | Read file | Minor mismatch risk: `GlobalProps.durableNamespaces` lists three classes while exports include `UserSecretsStore` — generated type nuance only |

**Paths not accessed:** None required for this report were blocked; the workspace was readable. Partial reads are noted above where the full file was not necessary for the stated sections.

---

This completes the requested research report with file-path and symbol-level grounding from the actual `landibuild` tree.
