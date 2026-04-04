# Refactoring specialist report (subagent: refactoring-specialist)

**← [Back to index](./00-coordinator-verification-gap-analysis-and-index.md)** · [01](./01-research-analyst-report.md) · [02](./02-search-specialist-report.md) · [03](./03-architect-reviewer-report.md) · [04](./04-ai-engineer-report.md) · [06](./06-context-manager-report.md) · [07](./07-follow-up-clarifications.md)

Source: Cursor Task subagent `refactoring-specialist`. **Full subagent output** below (untruncated).

---

# LandiBuild: orchestrations, UI tabs, and framework gating — refactor / extension map

## Executive snapshot

- **Single creation funnel today:** Home (`src/routes/home.tsx`) collects a prompt and navigates to `/chat/new?query=…&projectType=…`; `use-chat` posts to **`POST /api/agent`** (`worker/api/routes/codegenRoutes.ts` → `CodingAgentController.startCodeGeneration`).
- **Feature / “product” model:** `ProjectType` is fixed to four values in **`worker/agents/core/types.ts`**. Capabilities and the React feature registry are wired for **app / presentation / general** on the wire and in the UI registry; **`workflow` exists in `DEFAULT_FEATURE_DEFINITIONS` but is not fully plumbed** through `PLATFORM_CAPABILITIES`, `CapabilitiesController`, or `src/features/index.ts`.
- **Deep Research in the sidebar** navigates to `/?mode=research`, but **`research` is not a valid `ProjectType`** — this is a real type/behavior gap, not just UX.
- **Agent tools are split by path:** conversational tools live in **`worker/agents/tools/customTools.ts`** (`buildTools`); agentic generation uses **`AgenticProjectBuilder.buildTools`** in `worker/agents/operations/AgenticProjectBuilder.ts` (different list, includes blueprint/filesystem tools).
- **“Workflow tabs” in Settings** (`src/lib/constants/workflow-tabs.ts` + `src/utils/model-helpers.ts`) are **model-config groupings** keyed by agent action names — they are **not** the same as chat view tabs (editor/preview/docs/…).

---

## 1) Concrete refactor / extension points (files / modules)

### 1.1 New orchestration modes & entry points (home → API → agent)

| Area | File(s) | What to extend |
|------|---------|----------------|
| URL → type safety | `src/routes/home.tsx` | `projectMode` / `searchParams.get('mode') as ProjectType` — today allows invalid modes (e.g. `research`). |
| Sidebar modes | `src/components/layout/app-sidebar.tsx` | `/?mode=presentation`, `/?mode=research` — must align with real `ProjectType` or a separate route. |
| Routing | `src/routes.ts` | Add routes if deep-research or “site builder only” is a **separate shell** (e.g. `/research`, `/build`) instead of overloading `/?mode=`. |
| Chat bootstrap | `src/routes/chat/chat.tsx` | Reads `projectType` from query; passes to `useChat`. |
| Session creation | `src/routes/chat/hooks/use-chat.ts` | `apiClient.createAgentSession({ query, projectType, images })` for `urlChatId === 'new'`. |
| API client | `src/lib/api-client.ts` | `createAgentSession` → `POST /api/agent` with `CodeGenArgs`. |
| Types (SSoT) | `src/api-types.ts` (re-exports), `worker/api/controllers/agent/types.ts` | `CodeGenArgs`, `MAX_AGENT_QUERY_LENGTH`. |
| Backend entry | `worker/api/routes/codegenRoutes.ts`, `worker/api/controllers/agent/controller.ts` | Auth, rate limit, `getTemplateForQuery`, `getAgentStub`, streaming NDJSON. |
| Project type union | `worker/agents/core/types.ts` | **`ProjectType`** — extend here first; then all switch/records must follow. |
| Template / blueprint behavior | `worker/agents/planning/templateSelector.ts`, `worker/agents/planning/blueprint.ts`, `worker/agents/prompts.ts`, `worker/agents/operations/prompts/agenticBuilderPrompts.ts` | “Landing-editor-like” prompts and PRD style live here, not on Home. |
| State compatibility | `worker/agents/core/stateMigration.ts` | Any new `projectType` must be added to validation branches (see existing `workflow` check). |

### 1.2 UI tabs (chat shell vs settings “workflow” tabs)

| Kind | File(s) | Role |
|------|---------|------|
| Chat views | `src/routes/chat/chat.tsx` (`view` state), `src/routes/chat/components/main-content-panel.tsx`, `view-header.tsx`, `view-container.tsx` | Editor / preview / docs / blueprint / terminal / presentation. |
| Feature-driven views | `src/features/*/index.ts`, `src/features/core/registry.ts`, `worker/agents/core/features/types.ts` | `supportedViews`, lazy preview/header components. |
| Capabilities-driven enablement | `src/features/core/context.tsx` (`getCapabilities` on mount), `worker/api/controllers/capabilities/controller.ts`, `wrangler.jsonc` (`PLATFORM_CAPABILITIES`) | Which **project types** are enabled on this deploy. |
| Model-config “workflow tabs” | `src/lib/constants/workflow-tabs.ts`, `src/utils/model-helpers.ts`, `src/components/model-config-tabs.tsx`, `src/components/shared/ModelConfigInfo.tsx` | Grouping **agent action keys** for BYOK/model UI. New orchestration steps → extend `categorizeAgent` + possibly new tab ids. |

### 1.3 Deep research (dedicated endpoint + UI)

| Layer | File(s) | Notes |
|-------|---------|-------|
| **No existing deep-research HTTP route** in this repo | — | Implement e.g. `worker/api/routes/...` + controller, or proxy to an external service (e.g. platform orchestrator). |
| UI | New route component under `src/routes/…` + `src/routes.ts`; optionally keep sidebar in `app-sidebar.tsx` | Replace `/?mode=research` with a real route and typed flow. |
| Auth | `worker/middleware/auth/routeAuth.ts` + existing patterns in `codegenRoutes.ts` | Choose `AuthConfig.authenticated` vs `public` per product. |
| If research **reuses** coding agent | Same chain as §1.1 | Then extend `ProjectType` and template/prompt paths; **tools** may need a reduced allowlist (see §1.4). |

### 1.4 Gating by framework / guardrails (web components, agency extensions)

| Mechanism | File(s) | Current use |
|-----------|---------|-------------|
| Deploy-level features | `wrangler.jsonc` → `PLATFORM_CAPABILITIES`, `CapabilitiesController.getCapabilities` | Turns **project types** on/off for the SPA. |
| Per-feature capabilities | `worker/agents/core/features/types.ts` (`FeatureCapabilities`, `moduleUrl` placeholder) | **Intended** extension point for optional UI modules (`moduleUrl` in types). |
| App listing filter | `worker/database/schema.ts` (`apps.framework`), `worker/database/services/AppService.ts`, `worker/api/controllers/apps/controller.ts`, `src/hooks/use-paginated-apps.ts` | **Discovery/filter**, not authorization. |
| Default stack / codegen body | `worker/api/controllers/agent/controller.ts` (`defaultCodeGenArgs`: `react`, `vite`) | “Framework” for generation defaults. |
| Blueprint | `worker/agents/tools/toolkit/alter-blueprint.ts`, schemas in `worker/agents/schemas.ts` | `frameworks[]` on blueprint. |
| API key scopes (future gate) | `worker/database/schema.ts` (`api_keys.scopes`) | JSON scopes — **not** referenced in the grep sweep for feature gating; usable for **extension-only** APIs. |
| Agent tool allowlists | `worker/agents/tools/customTools.ts`, `worker/agents/operations/AgenticProjectBuilder.ts` | **Primary place** to restrict what an “extension” or “web component builder” agent can call. |

**landi-store-extension / Lit:** no matches for those products in this codebase; gating would be **new** policy (capabilities + tool subsets + optional D1 columns or user metadata).

### 1.5 Known inconsistencies worth fixing as part of any “multi-product” work

1. **`workflow` feature definition** exists in `worker/agents/core/features/types.ts` (`DEFAULT_FEATURE_DEFINITIONS.workflow`) but:
   - `wrangler.jsonc` `PLATFORM_CAPABILITIES.features` has **no** `workflow` key.
   - `CapabilitiesController.getCapabilities` only merges **app, presentation, general** — **workflow is omitted** from the API response.
   - `src/features/index.ts` **does not** `featureRegistry.register` for `workflow`.
2. **`research` mode** in `app-sidebar.tsx` does not match `ProjectType` in `worker/agents/core/types.ts`.

---

## 2) Estimated complexity (S / M / L) with reasoning

| Initiative | Size | Reasoning |
|------------|------|-----------|
| Fix `research` sidebar + align `ProjectType` / URL modes | **S** | Localized: `app-sidebar.tsx`, `home.tsx`, `types.ts`, migration guard in `stateMigration.ts`, any switch on `ProjectType`. No new network surface if `research` maps to an existing type temporarily. |
| Extend `PLATFORM_CAPABILITIES` + `CapabilitiesController` + register `workflow` in `src/features/index.ts` + add `src/features/workflow` module | **M** | Touches env schema (`worker-configuration.d.ts` / wrangler), backend controller, frontend registry, new feature folder mirroring `general`/`presentation`. Must verify chat + templates for `workflow` (agentic, no preview in defaults). |
| New **deep-research** HTTP API + minimal UI tab/page (non-agent or slim agent) | **M–L** | **M** if thin proxy + read-only UI; **L** if long-running jobs, persistence, citations, D1 tables, streaming UX, and separate auth/rate limits. This repo has **no** existing route to extend. |
| “Site builder chat” replacing home wizard with **landing-editor-class** prompts | **M** | Home stays thin; real work is **prompt + template + blueprint** pipeline (`worker/agents/planning/*`, `prompts.ts`, `agenticBuilderPrompts.ts`) and possibly **behavior** selection. Risk of regressions in phasic vs agentic paths. |
| **Guardrails** per product (web components vs full app vs extension): capabilities + tool allowlists + optional user/app flags | **L** | Cross-cuts: types, capabilities, `CodingAgentController` / init args, `buildTools` / `AgenticProjectBuilder.buildTools`, possibly D1 migrations, admin UX, tests. |

---

## 3) Dependency chains

### 3.1 Auth

- **`POST /api/agent`**: `setAuthLevel(AuthConfig.authenticated)` in `codegenRoutes.ts`.
- **WebSocket**: `AuthConfig.ownerOnly` (+ optional ticket) for `/api/agent/:agentId/ws`.
- **Capabilities**: `AuthConfig.public` in `capabilitiesRoutes.ts`.
- Frontend: `useAuth`, `useAuthGuard` on home (`home.tsx`), `api-client` session handling.

Any new orchestration endpoint should reuse **`routeAuth.ts`** patterns and mirror **`CodingAgentController`** rate limiting (`RateLimitService.enforceAppCreationRateLimit`) where appropriate.

### 3.2 API types

- Frontend imports from **`src/api-types.ts`** (re-exports worker controller types).
- Changing `CodeGenArgs` or `ProjectType` requires: **`worker/api/controllers/agent/types.ts`** → **`worker/agents/core/types.ts`** → **`src/api-types.ts`** export surface → **`api-client.ts`** → **`use-chat.ts`** / **`chat.tsx`**.

### 3.3 Agent tools

- **Phasic / conversational path:** `UserConversationProcessor` → `buildTools` in **`worker/agents/tools/customTools.ts`**.
- **Agentic path:** **`AgenticProjectBuilder.buildTools`** — blueprint, virtual FS, generate/regenerate, deploy, etc.
- **Deep debugger:** **`buildDebugTools`** in same file, used from **`DeepDebugger.ts`**.

Product guardrails should define **which builder** runs and **which tool array** is built (possibly factories parameterized by `ProjectType` or a new `productId`).

### 3.4 D1

- **`apps`** (`worker/database/schema.ts`): `framework` is a **string** for metadata/filters, not typed enums for products.
- **Users / API keys**: identity and optional **`scopes`** for future extension APIs.
- New orchestrations that **persist** research jobs or per-tenant flags would need **new tables** or **`users.preferences` / `apps` columns** — not present today for deep-research.

---

## 4) Suggested incremental implementation order

1. **Normalize types and dead-end UX**  
   - Add a real `ProjectType` value or stop using `research` in the URL until defined.  
   - Fix **capabilities vs registry vs `workflow`** so the platform’s “feature matrix” is internally consistent (`CapabilitiesController`, `wrangler.jsonc`, `src/features/index.ts`).

2. **Gate at the capability layer first**  
   - Extend `PLATFORM_CAPABILITIES` for any new product line (`web-components`, `deep-research`, etc.).  
   - Teach **`FeatureProvider`** / sidebar / home to **hide** entry points when disabled (already the pattern for registered features).

3. **API + client contract**  
   - Add types to **`worker/api/controllers/.../types.ts`** and **`src/api-types.ts`**.  
   - Add **`api-client`** method(s).  
   - For agent-based flows, extend **`CodeGenArgs`** or add a parallel endpoint if the response shape is not NDJSON + websocket.

4. **Backend orchestration**  
   - Either branch inside **`CodingAgentController`** (same entry) or add a dedicated controller/route for research.  
   - Adjust **`getTemplateForQuery`** / prompts for the new mode.

5. **Tooling guardrails**  
   - Introduce a **single factory** (refactor from duplicated `buildTools` lists) that selects tools by capability flags — reduces drift between `customTools` and `AgenticProjectBuilder`.

6. **UI**  
   - New route or tab: **`routes.ts`** + shell component; reuse **`MainContentPanel`** patterns only if the UX matches (research may not need editor/preview).

7. **Persistence (if needed)**  
   - D1 migration + **`AppService`** or new service.

8. **Model config tabs (optional)**  
   - If new agent actions are added, update **`model-helpers.ts`** / **`workflow-tabs.ts`** so Settings stays coherent.

---

## DoD self-check (subagent-original)

| Criterion | Status |
|-----------|--------|
| Grounded in repo (grep/read, not hand-waving) | **Yes** — paths and behaviors cited from `routes.ts`, `home.tsx`, `use-chat.ts`, `codegenRoutes.ts`, `controller.ts`, `types.ts`, `features/types.ts`, `capabilities/controller.ts`, `wrangler.jsonc`, `customTools.ts`, `AgenticProjectBuilder.ts`, `schema.ts`, `app-sidebar.tsx`, `workflow-tabs.ts`. |
| Concrete extension points listed | **Yes** — tables in §1. |
| Complexity estimates with reasoning | **Yes** — §2. |
| Dependency chains (auth, API types, tools, D1) | **Yes** — §3. |
| Incremental order | **Yes** — §4. |
| Gaps / risks called out | **Yes** — `research` vs `ProjectType`, `workflow` not in capabilities/registry/wrangler, no deep-research endpoint in repo, two separate tool stacks. |

---

**Note:** The instructions mentioned querying a “context manager” JSON payload; that system is not available in this subagent’s tool set, so the assessment is based on direct codebase inspection only.
