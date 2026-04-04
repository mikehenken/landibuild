# Architect reviewer report (subagent: architect-reviewer)

**← [Back to index](./00-coordinator-verification-gap-analysis-and-index.md)** · [01](./01-research-analyst-report.md) · [02](./02-search-specialist-report.md) · [04](./04-ai-engineer-report.md) · [05](./05-refactoring-specialist-report.md) · [06](./06-context-manager-report.md) · [07](./07-follow-up-clarifications.md)

Source: Cursor Task subagent `architect-reviewer`. **Full subagent output** below (untruncated).

---

Architecture review (extensibility focus) for `c:\Users\mikeh\Projects\landi\landibuild`, based on the files above.

---

## 1) Separation of concerns: UI vs worker vs shared types (`src/api-types.ts`, `api-client`)

### What the codebase actually does

**Types (`src/api-types.ts`)**  
The file is documented as the single place for frontend–worker API typing, but it is implemented as a **wide re-export surface** from the worker tree (controllers, database, agents, services) plus a small amount of frontend-only shaping (e.g. `ActiveSessionsData`, `ApiKeysData`, `FileType`).

Evidence of the pattern:

- Re-exports from worker modules such as `worker/api/controllers/types`, `worker/database/schema`, `worker/agents/core/features/types`, `worker/api/websocketTypes`, etc. (see the block starting around the “Base API Response Types” section in `src/api-types.ts`).
- Error types bridged from `shared/types/errors.js` (e.g. `RateLimitExceededError`, `SecurityError`) — the worker’s `worker/app.ts` imports the same `shared/types/errors`, so **shared** is real but **minimal** today (only errors surfaced in the grep path).

**Vite resolution** (`vite.config.ts`) aliases:

- `@` → `./src`
- `worker` → `./worker`
- `shared` → `./shared`

So the SPA does not consume “generated OpenAPI types” or a slim `packages/contracts` package; it **type-depends on worker source paths**. That keeps types in sync by construction but **tightens coupling**: renaming a worker file or moving a type breaks the frontend compile, and the frontend’s dependency graph includes semantic knowledge of agents, DB rows, and controller DTOs.

**API client (`src/lib/api-client.ts`)**  
Responsibilities bundled together:

- HTTP transport (`fetch`, base URL, JSON parsing, optional streaming).
- **Auth-adjacent behavior**: `getAuthHeaders()` reads `localStorage` (`anonymous_session_token`) and cookies; CSRF token lifecycle.
- **Global UX side effect**: `setGlobalAuthModalTrigger` for 401 → modal (cross-cutting concern).
- A large, flat method surface for many domains (apps, model config, vault, auth, …).

So separation is **layered in folders** (UI / worker / shared) but **not strict by responsibility** inside the client: networking, session hints, CSRF, and UI triggers share one class.

### Anti-patterns / risks

1. **Self-import in `api-types.ts`**  
   The file contains:

```5:6:c:\Users\mikeh\Projects\landi\landibuild\src\api-types.ts
import { SessionResponse } from 'worker/utils/authUtils';
import { AuthUser } from './api-types';
```

   `AuthUser` is also re-exported from `worker/types/auth-types` later in the same file. The `./api-types` import is **redundant and circular**; it should be removed or replaced with the worker import only. This is a maintainability and tooling smell (bundlers/analyzers may still elide it for `import type`, but it confuses readers and risks subtle ordering issues).

2. **“Contract” = entire worker**  
   Fine for a single product and small team; **poor for extensibility** if you want a third-party client, a mobile app, or a split repo: you would not want them to depend on `worker/agents/schemas` for types.

3. **Thick `ApiClient`**  
   Hard to swap transport (e.g. add retries, tracing, or non-browser runtime) without dragging auth modal and CSRF along. A more extensible split would be: `HttpClient` (pure) + `LandiBuildApi` (methods) + `AuthInterceptor` / `CsrfPlugin` + `UiAuthBridge` (registered from React).

### What works well

- **Hono worker** (`worker/app.ts`): clear middleware pipeline (security headers, CORS, CSRF, rate limit, auth level, `setupRoutes`). That is a **clean server-side separation** compared to the monolithic client.
- **Feature/capability types** living in `worker/agents/core/features/types.ts` and re-exported through `api-types` gives a **single definition** for `FeatureDefinition` / `ProjectType`-driven behavior — good for consistency between `/api/capabilities` and the SPA registry.

---

## 2) How hard to reuse this UI shell for other products (sidebar, layout, routes)

### Layout composition

`App.tsx` stacks providers and one shell:

```11:29:c:\Users\mikeh\Projects\landi\landibuild\src\App.tsx
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FeatureProvider>
          <AuthProvider>
            <VaultProvider>
              <AuthModalProvider>
                <AppLayout>
                  <Outlet />
                </AppLayout>
```

`AppLayout` is relatively **structurally reusable**: `SidebarProvider`, `AppSidebar`, `LandiPlatformNav`, `AppsDataProvider`, and `Outlet`/children.

```13:34:c:\Users\mikeh\Projects\landi\landibuild\src\components\layout\app-layout.tsx
export function AppLayout({ children }: AppLayoutProps) {
  const { pathname } = useLocation();
  return (
    <AppsDataProvider>
      <SidebarProvider 
        defaultOpen={false}
        ...
      >
        <AppSidebar />
        <SidebarInset className={clsx("bg-bg-3 flex flex-col h-screen relative", pathname !== "/" && "overflow-hidden")}>
          <LandiPlatformNav />
          <div className={clsx("flex-1 bg-bg-3", pathname !== "/" && "min-h-0 overflow-auto")}>
            {children || <Outlet />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppsDataProvider>
  );
}
```

### What is *not* reusable without work

**`AppSidebar`** (`src/components/layout/app-sidebar.tsx`) is **product- and ecosystem-specific**:

- Brand: `/logobuild.png`, “LANDiBUILD home”, “New Chat” → `navigate('/')`.
- Multiple `window.open(...)` links to fixed hosts (`https://landi.build`, `https://docs.landi.build`, `https://claw.landi.build`, etc.).
- “Chat History” is **landibuild’s app list** via `useRecentApps()` and routes to `/app/:id`.

So the **shell pattern** (collapsible sidebar + inset + optional platform header) is reusable; the **current sidebar content** is not a generic “product shell.”

**`LandiPlatformNav`** (`src/components/layout/landi-platform-nav.tsx`) embeds the Lit package `@landi/header` and passes fixed props (`brand-name`, `logo-href`, `login-url`, etc.). Toggle is env-driven (`VITE_SHOW_LANDI_HEADER` via `landi-platform-nav-config.ts`), which is a **good extensibility hook**. Hiding rules live in `use-landi-nav-visibility.ts` (e.g. hide on `/chat/` and `/app/:id`).

**Routing** (`src/routes.ts`) is a **single manifest**: easy to fork for another product, but today it encodes landibuild routes (`chat/:chatId`, `app/:id`, `discover`, Supabase callback, etc.).

### Reuse difficulty (honest assessment)

- **Low effort**: Reuse `SidebarProvider` + `SidebarInset` + your own sidebar component; keep or drop `LandiPlatformNav` via env.
- **Medium effort**: Parameterize sidebar sections (links, history source, CTA label/target) via config/context instead of hardcoded URLs and hooks.
- **High effort**: Extract a **package** (`@landi/shell` or similar) with no imports from `@/hooks/use-apps`, landibuild auth, or vault — and define an interface for “recent items” / “primary action.”

---

## 3) Adding new top-level “tabs” or modes in the SPA (from real routing/layout code)

There are **three different “mode” concepts** in the code; conflating them hurts extensibility.

### A) New **top-level routes** (whole pages)

**Where:** `src/routes.ts` — add a child under the `App` route’s `children`, same as `discover`, `settings`, etc.

```16:57:c:\Users\mikeh\Projects\landi\landibuild\src\routes.ts
const routes = [
	{
		path: '/',
		Component: App,
		children: [
			{ index: true, Component: Home },
			{ path: 'chat/:chatId', Component: Chat },
      ...
```

**Layout impact:** `AppLayout` wraps all of these unless you introduce a **route group** or a second layout route — today there is **no nested layout split**; everything gets `AppsDataProvider` + sidebar + platform nav (subject to header hide rules on some paths).

### B) **Home composer “mode”** (query string on `/`)

**Where:** `src/routes/home.tsx` reads `searchParams.get('mode')` and maps it to `projectMode` state, typed as `ProjectType`:

```23:35:c:\Users\mikeh\Projects\landi\landibuild\src\routes\home.tsx
	const initialMode = (searchParams.get('mode') as ProjectType) || 'app';
	const [projectMode, setProjectMode] = useState<ProjectType>(initialMode);

	useEffect(() => {
		const mode = searchParams.get('mode') as ProjectType;
		if (mode) {
			setProjectMode(mode);
		} else {
			setProjectMode('app');
		}
	}, [searchParams]);
```

Sidebar triggers Slides / Deep Research with:

```247:265:c:\Users\mikeh\Projects\landi\landibuild\src\components\layout\app-sidebar.tsx
									<SidebarMenuButton
										onClick={() => navigate('/?mode=presentation')}
...
									<SidebarMenuButton
										onClick={() => navigate('/?mode=research')}
```

**Problem:** `ProjectType` in the worker is:

```13:13:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\core\types.ts
export type ProjectType = 'app' | 'workflow' | 'presentation' | 'general';
```

There is **no `'research'`** in that union. So `/?mode=research` is an **unchecked string** forced through `as ProjectType` — an extensibility bug: TypeScript does not protect you, and runtime behavior may not match a real registered feature.

### C) **Builder “tabs” / view modes** inside chat (feature system)

The scalable pattern for “modes” inside the editor is the **feature registry** + **view definitions**:

- Registration: `src/features/index.ts` calls `featureRegistry.register` with `DEFAULT_FEATURE_DEFINITIONS.*` and a dynamic import.

```33:51:c:\Users\mikeh\Projects\landi\landibuild\src\features\index.ts
function registerBuiltInFeatures(): void {
	featureRegistry.register(
		{ ...DEFAULT_FEATURE_DEFINITIONS.app, enabled: true },
		() => import('./app'),
	);
	featureRegistry.register(
		{ ...DEFAULT_FEATURE_DEFINITIONS.presentation, enabled: true },
		() => import('./presentation'),
	);
	featureRegistry.register(
		{ ...DEFAULT_FEATURE_DEFINITIONS.general, enabled: true },
		() => import('./general'),
	);
}
```

- `ViewMode` is intentionally extensible:

```23:23:c:\Users\mikeh\Projects\landi\landibuild\worker\agents\core\features\types.ts
export type ViewMode = 'editor' | 'preview' | 'docs' | 'blueprint' | 'terminal' | (string & {});
```

- `FeatureProvider` loads capabilities from the API and updates the registry (`src/features/core/context.tsx`).

**End-to-end checklist for a new **project type** (true “tab” / mode of generation):**

1. Add to `ProjectType` in `worker/agents/core/types.ts` (and any persistence / agent routing that branches on it).
2. Add defaults in `DEFAULT_FEATURE_DEFINITIONS` in `worker/agents/core/features/types.ts`.
3. Implement `getBehaviorTypeForProject` coverage (already keyed off `DEFAULT_FEATURE_DEFINITIONS`).
4. Register a lazy feature module in `src/features/index.ts` with `PreviewComponent` / optional `HeaderActionsComponent` / `getViews()` as needed.
5. Ensure `/api/capabilities` returns the new feature as enabled (backend controller must align).
6. Use **consistent URL params**: chat uses `projectType` on `/chat/new?...` (`src/routes/chat/chat.tsx`), not only `mode` on `/`.

**Notable gap:** `workflow` exists in `ProjectType` and `DEFAULT_FEATURE_DEFINITIONS` (`worker/agents/core/features/types.ts`) but **no** `featureRegistry.register(..., () => import('./workflow'))` exists under `src/features/` (grep shows no workflow feature folder). So the architecture *supports* workflow as a capability concept, but the **frontend module is missing** — incomplete extensibility.

---

## 4) Risks / constraints (vendor lock-in to Cloudflare primitives)

From `wrangler.jsonc` and `worker/index.ts`, the system is **deeply native** to Cloudflare:

- **D1** (`DB`), **Durable Objects** (`CodeGenObject`, `Sandbox`, `DORateLimitStore`, `UserSecretsStore`), **R2**, **KV**, **Workers AI** (`AI`), **dispatch namespaces** (`DISPATCHER`), **containers** (`UserAppSandboxService` + image), **assets** as SPA with `run_worker_first`, **rate limit** bindings under `unsafe.bindings`.

Implications for extensibility:

- **Portability:** Moving to AWS/GCP/Azure would not be a “rewrite the worker”; it would be **reimplementing** DO semantics (stateful agents, sessions, rate limit store), container orchestration (sandbox), and object/KV storage, plus the git/subdomain routing in `worker/index.ts`.
- **Mental model:** Features like `requiresSandbox: true` in feature definitions are **aligned with CF Containers**, not generic Kubernetes.
- **Local dev:** `vite.config.ts` disables `enable_containers` on `win32` — a **platform constraint** for contributors; full sandbox behavior expects non-Windows or remote bindings.

These are acceptable **if** landibuild is intentionally CF-native (it appears to be). They are **constraints** if the goal is a neutral “product platform” runnable on arbitrary clouds.

---

## 5) Comparison angle: this stack vs a separate KMP client (conceptual)

You asked to reference the idea that **landing-editor** may have a KMP unified chat plan — I do not have that repo in this workspace, so this stays **architectural**, not a citation to their docs.

**This repo (Vite + React + Cloudflare Worker + D1/DO/R2/…):**

- **Strengths:** One TypeScript stack end-to-end; types can flow from worker to UI (as in `api-types.ts`); browser-first UX; feature registry + lazy features fit web delivery; tight integration with edge and sandbox.
- **Weaknesses for multi-surface:** iOS/Android/desktop would **not** reuse React DOM; you would expose the same **HTTP/WebSocket contract** and reimplement UI. The current coupling (thick client, worker type imports) makes the **contract** implicit rather than a published boundary.

**KMP (Kotlin Multiplatform) client (conceptual):**

- **Strengths:** Shared domain + networking + models on mobile/desktop; native UI per platform; forces a **clear API contract** (OpenAPI/protobuf) because Kotlin cannot import `worker/agents/...`.
- **Costs:** Second language ecosystem, build complexity, and you still need a **backend** (could remain this worker or a separate service). Chat/agent streaming and file preview would be reimplemented per platform or via embedded WebViews.

**Coexistence story:** A mature approach is **contract-first API** (versioned, documented) + thin generated clients, with landibuild’s React app as **one** consumer and KMP as another — today, landibuild is **optimized for the first consumer only**.

---

## Anti-patterns flagged (concise list)

| Item | Where | Issue |
|------|--------|-------|
| Circular/redundant import | `src/api-types.ts` L5–6 | `AuthUser` from `./api-types` |
| Unsafe casts | `home.tsx` (`mode` as `ProjectType`), `chat.tsx` (`urlProjectType as ProjectType`) | Strings from URL bypass the union |
| URL vs type mismatch | `app-sidebar.tsx` `/?mode=research` vs `ProjectType` | `research` ∉ `ProjectType` |
| Incomplete feature wiring | `workflow` in worker definitions, absent `src/features/workflow` | Backend/front capability drift |
| Types coupling | `api-types.ts` → deep `worker/*` imports | Hard to reuse client or split repos |
| `ApiClient` | `src/lib/api-client.ts` | Transport + CSRF + storage + global modal intertwined |

---

## Definition of Done (self-check) (subagent-original)

| Criterion | Met? |
|-----------|------|
| Addressed separation of UI vs worker vs shared types with concrete file references | Yes — `api-types.ts`, `api-client.ts`, `worker/app.ts`, `shared/types/errors`, Vite aliases |
| Explained reuse of UI shell (sidebar, layout, routes) with difficulty levels | Yes — `AppLayout`, `AppSidebar`, `LandiPlatformNav`, `routes.ts` |
| Explained how to add top-level routes and modes using **actual** routing/layout/feature code | Yes — `routes.ts`, `home.tsx` query `mode`, `features/index.ts`, registry, `ProjectType` / `ViewMode` |
| Covered Cloudflare lock-in with evidence from config/worker | Yes — `wrangler.jsonc`, `worker/index.ts`, Vite Windows container note |
| Included conceptual KMP comparison and noted landing-editor KMP plan only as external context | Yes — no fabricated citations to landing-editor files |
| Cited paths and flagged anti-patterns | Yes — tables and code references |
| Full detail, not summary-only | Yes — structured deep sections |

If you want a follow-up **implementation** pass, the highest-value fixes for extensibility are: remove the `api-types` self-import, align `research` with a real `ProjectType` + feature module or remove the sidebar link, and either add a `workflow` feature module or remove `workflow` from the public capability surface until it exists.
