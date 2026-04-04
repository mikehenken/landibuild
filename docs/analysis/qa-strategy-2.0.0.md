---
doc_type: study
title: QA Strategy & Sign-off Criteria — v2.0.0
description: >
  Full quality assurance strategy for the landibuild v2.0.0 pre-release,
  covering test coverage mapping, gap analysis, risk matrix, test matrix,
  sign-off criteria, and recommended new tests.
created_at: "2026-04-04"
artifact_type: analysis-report
study_id: qa-strategy-2.0.0
workflow_name: qa-pre-release-review
---

# QA Strategy & Sign-off Criteria — landibuild v2.0.0

**Date:** 2026-04-04  
**Platform:** Cloudflare Workers + Vite React SPA  
**Test framework:** Vitest + `@cloudflare/vitest-pool-workers` (Miniflare)  
**Scope:** All changes tracked in git diff `main...origin/main` for the v2.0.0 release

---

## 1. Test Environment Constraints

Before reading coverage data it is important to understand what *can* be tested in this repo's vitest environment and what cannot:

| Category | Testable in vitest Workers pool? | Notes |
|---|---|---|
| Worker utility functions (pure logic) | ✅ Yes | Best target for unit tests |
| Durable Object state & methods | ✅ Yes | Via `runInDurableObject` (cloudflare:test) |
| Output format parsers | ✅ Yes | No I/O dependencies |
| Auth middleware logic (pure) | ✅ Yes | `routeAuthChecks` is pure function |
| Controller flag helpers | ✅ Yes | `isSupabaseAuthEnabled`, `hasOAuthProviders` are pure |
| Agent constraint / model config tables | ✅ Yes | Pure data, no Cloudflare bindings needed |
| HTTP route handlers | ⚠️ Partial | Routes excluded by config; integration path only |
| Frontend React components | ❌ No | Vite SPA — not in Workers vitest scope |
| Live DB operations (Drizzle + D1) | ❌ No | Requires Miniflare D1 binding; feasible but heavy |
| OAuth handshake flows | ❌ No | External HTTP, not feasible in unit tests |
| Real LLM inference calls | ❌ No | Must be mocked |

---

## 2. Existing Test Coverage Map

### 2.1 `worker/api/controllers/modelConfig/byokHelper.test.ts` — **11 tests**

| Function Under Test | Scenarios Covered |
|---|---|
| `getAccessProviderFromModelId` | workers-ai prefix → `workers`; openai/ prefix → `openai`; no-slash → `cloudflare` |
| `getProviderFromModel` | DISABLED model → `cloudflare` |
| `getPlatformEnabledProviders` | No key; short key; `none`/`default` sentinel; valid WORKERS_API_KEY; OPENAI_API_KEY; merge with PLATFORM_MODEL_PROVIDERS |
| `getPlatformAvailableModels` | workers enabled → chat Workers AI models present; image models excluded |
| `getByokModels` | hasValidKey true → chat models; hasValidKey false → no models |
| `validateModelAccessForEnvironment` | platform key only; user key only; neither |

**Assessment:** Strong coverage of the BYOK model-access layer. Covers all six exported helpers. New models (Kimi 2.5, GLM, Llama 4 Scout) are implicitly exercised via `AIModels` enum references.

---

### 2.2 `worker/database/services/ModelTestService.test.ts` — **2 tests**

| Scenario Covered |
|---|
| Image model (`WORKERS_FLUX_2_KLEIN_9B`) returns `success: false`, no `infer` call |
| Leonardo image model returns `success: false`, no `infer` call |

**Assessment:** Very narrow. Only exercises the image-model short-circuit path. Does not test successful model inference path, error handling for network failures, or latency measurement for real calls. Acceptable because real inference cannot run in unit tests without mocking.

---

### 2.3 `worker/services/secrets/UserSecretsStore.test.ts` — **8 tests**

| Describe block | Scenarios |
|---|---|
| Session Validation | `isVaultUnlocked` returns false without session; `requestSecretByProvider` returns `vault_locked`; `getVaultStatus` returns `exists: false` |
| Storage Operations | `storeSecret` without session; `listSecrets` empty; `deleteSecret` not-found; `getSecret` not-found |
| CRUD Lifecycle | Full store→get→list→delete→verify lifecycle |

**Assessment:** Uses real Durable Object via `runInDurableObject`. Solid basic coverage. Does not test encrypted vault unlock / decrypt paths (acceptable — those require cryptographic setup not feasible without real key material in tests).

---

### 2.4 `worker/agents/utils/preDeploySafetyGate.test.ts` — **14 tests**

| Describe block | Scenarios |
|---|---|
| `runPreDeploySafetyGate` | Empty input; non-script file pass-through; selector object literal detection; fixer invocation; destructured selector splitting; setState in render; useEffect missing deps; constructor throw; fixer run rejection; fixer throws; invalid syntax; fuzz 200 files |
| `detectPreDeploySafetyFindings` | Invalid input does not throw; fuzz 200 random strings |

**Assessment:** Excellent coverage. Fuzz testing, error resilience, and key detection scenarios all exercised. This is the strongest test file in the repo.

---

### 2.5 Output Format Tests — **~200+ tests across 5 files**

| File | Module | Coverage |
|---|---|---|
| `xml-stream.test.ts` | `XmlStreamFormat` | Basic parsing, streaming, error handling, buffer management, config options, nested elements, real-world LLM scenarios, edge cases, utilities |
| `scof.test.ts` | `SCOFFormat` | Shell command parsing, multiple files, streaming chunks, special chars, patch commands, comments, EOF variants, `deserialize` |
| `scof-comprehensive.test.ts` | `SCOFFormat` | Extended streaming, edge cases, additional scenarios |
| `udiff.test.ts` | `applyDiff` (unified) | Simple add/delete/modify, multiple hunks, edge cases, whitespace, Windows line endings, real-world diffs |
| `udiff-comprehensive.test.ts` | `applyDiff` (unified) | Malformed headers, resilience, LLM output patterns |
| `search-replace.test.ts` | `applyDiff`, `createSearchReplaceDiff`, `validateDiff` | Full suite: basic ops, error handling, multiple blocks, LLM robustness, edge cases, performance, validation, enhanced parser robustness |

**Assessment:** Exceptionally thorough for the output format layer. These cover the AI code-generation pipeline's critical output parsing. Well-maintained.

---

## 3. Coverage Gaps — v2.0.0 Changed Areas

### 3.1 AI Config (`worker/agents/inferutils/config.ts`, `config.types.ts`)

| Changed Item | Test Coverage | Gap Severity |
|---|---|---|
| New model registrations in `MODELS_MASTER` (Kimi 2.5, GLM 4.7 Flash, Llama 4 Scout, Nemotron 120B, Flux.2, Lucid Origin, Claude 4.x, GPT-5.x, Gemini 3.x, Grok 4.x, Vertex models) | Implicit via byokHelper tests for Workers AI models only | **MEDIUM** — other providers' new models untested |
| `AGENT_CONSTRAINTS` map (new constrained actions: fastCodeFixer, realtimeCodeFixer, fileRegeneration, phaseGeneration, projectSetup, conversationalResponse, templateSelection) | **None** | **MEDIUM** — constraint set membership not validated |
| `credentialsToRuntimeOverrides` utility function | **None** | **MEDIUM** — called on every BYOK inference path |
| `isValidAIModel` utility function | **None** | **LOW** — simple lookup, low complexity |
| `isChatCompletionAIModel` utility function | **None** | **LOW** — simple lookup; image exclusion logic used by byokHelper (tested indirectly) |
| `toAIModel` utility function | **None** | **LOW** — simple guard |
| `AGENT_CONFIG` conditional (env.PLATFORM_MODEL_PROVIDERS → PLATFORM_AGENT_CONFIG vs DEFAULT_AGENT_CONFIG) | **None** | **LOW** — config data integrity, not runtime logic |

**False positive check:** `byokHelper.test.ts` already validates that chat Workers AI models appear in available-model lists and image models are excluded — this exercises `isChatCompletionAIModel` indirectly through `getPlatformAvailableModels`. The direct unit test is still recommended for clarity.

---

### 3.2 Auth Layer (`worker/database/services/AuthService.ts`, `worker/api/controllers/auth/controller.ts`, `worker/middleware/auth/routeAuth.ts`, `worker/api/routes/authRoutes.ts`)

| Changed Item | Test Coverage | Gap Severity |
|---|---|---|
| `AuthController.isSupabaseAuthEnabled()` — NEW Supabase auth bridge flag check | **None** | **HIGH** — new code path, multiple env var combinations |
| `AuthController.hasOAuthProviders()` — now includes Supabase check | **None** | **HIGH** — determines whether email/password registration is blocked |
| `AuthService.register()` — email/password flow | **None** | **HIGH** (feasibility: requires mocked DB) |
| `AuthService.login()` — email/password flow | **None** | **HIGH** (feasibility: requires mocked DB) |
| `routeAuthChecks()` — pure function implementing public/authenticated/owner-only logic | **None** | **HIGH** — testable today without mocks |
| `enforceAuthRequirement()` — orchestrates ticket auth + JWT auth + rate limit | **None** | **MEDIUM** — requires mocked Hono context |
| `checkAppOwnership()` — pure-ish function with mocked service | **None** | **MEDIUM** |
| JWT session validation (`authMiddleware`) | **None** | **MEDIUM** |
| New auth routes (`worker/api/routes/authRoutes.ts`) | **None** (excluded by vitest config) | **LOW** — routes excluded intentionally |

**False positive check:** `AuthService` login/register are intentionally not unit-tested because they require a live D1 database. This is an accepted limitation of the Workers vitest environment without Miniflare D1 setup. `routeAuthChecks` is a **pure function** that takes `(user, env, requirement, params)` and returns `{success, response}` — it has zero external dependencies and can be unit-tested today with zero mocking overhead.

---

### 3.3 Model Config Controller (`worker/api/controllers/modelConfig/controller.ts`, `byokHelper.ts`)

| Changed Item | Test Coverage | Gap Severity |
|---|---|---|
| `byokHelper.ts` — all helpers | **Excellent** — 11 tests | ✅ No gap |
| `modelConfig controller` HTTP handling | **None** (routes excluded) | **LOW** — route exclusion is intentional |

---

### 3.4 Presentation Components (`src/features/presentation/`)

| Changed Item | Test Coverage | Gap Severity |
|---|---|---|
| `PresentationPreview` — fullscreen mode changes | **None** | **NOT APPLICABLE** — React component, not in Workers vitest scope |
| `PresentationHeaderActions` | **None** | **NOT APPLICABLE** |

---

### 3.5 Chat UI (`src/routes/chat/components/`)

| Changed Item | Test Coverage | Gap Severity |
|---|---|---|
| `main-content-panel`, `preview-iframe`, `view-header`, `view-mode-switch` | **None** (routes explicitly excluded from vitest config) | **NOT APPLICABLE** — excluded per vitest config |

---

### 3.6 UI Layout (`src/components/layout/`)

| Changed Item | Test Coverage | Gap Severity |
|---|---|---|
| `app-sidebar`, `app-layout`, `collapsed-sidebar-trigger`, `global-header` | **None** | **NOT APPLICABLE** — React components |

---

### 3.7 New Additions

| New File | Test Coverage | Gap Severity |
|---|---|---|
| `src/components/layout/landi-platform-nav.tsx` | **None** | **NOT APPLICABLE** — React component |
| `src/lib/supabase-browser-client.ts` | **None** | **LOW** — thin client wrapper, no logic to test |
| `src/routes/auth/` | **None** | **NOT APPLICABLE** — routes excluded |
| `src/routes/login.tsx` | **None** | **NOT APPLICABLE** — React component |
| New auth routes in worker | **None** | **LOW** — routes excluded per config |

---

## 4. Priority Risk Matrix

Risk is rated as: **HIGH** (blocks release), **MEDIUM** (needs mitigation), **LOW** (acceptable gap)

| # | Area | Test Coverage | Risk Level | Rationale |
|---|---|---|---|---|
| 1 | `routeAuthChecks` (routeAuth middleware) | ❌ None | 🔴 HIGH | Pure function; all authenticated routes depend on it; testable today |
| 2 | `AuthController.isSupabaseAuthEnabled` + `hasOAuthProviders` | ❌ None | 🔴 HIGH | New Supabase path; if misconfigured, email/password auth silently breaks or opens unintended |
| 3 | `credentialsToRuntimeOverrides` | ❌ None | 🟡 MEDIUM | Called on every BYOK AI inference; wrong output silently causes auth failures |
| 4 | `AGENT_CONSTRAINTS` model set membership | ❌ None | 🟡 MEDIUM | A typo in the allowed model set causes user-facing model selection failures |
| 5 | `isValidAIModel` / `isChatCompletionAIModel` / `toAIModel` | ❌ None (direct) | 🟡 MEDIUM | Used in model validation pipeline; image vs chat classification is critical |
| 6 | `ModelTestService` success path | ⚠️ Partial | 🟡 MEDIUM | Only image-model rejection tested; text model success path not tested (requires mocked `infer`) |
| 7 | `AuthService` login/register | ❌ None | 🟡 MEDIUM | Complex auth; acceptable gap given D1 dependency; mitigate with integration/manual testing |
| 8 | New Workers AI models in BYOK flow | ⚠️ Partial | 🟢 LOW | Kimi 2.5, GLM 4.7 Flash exercised in byokHelper tests; Llama/Nemotron not directly named |
| 9 | Output formats (xml-stream, scof, udiff, search-replace) | ✅ Excellent | 🟢 LOW | No gaps |
| 10 | preDeploySafetyGate | ✅ Excellent | 🟢 LOW | No gaps |
| 11 | UserSecretsStore DO | ✅ Good | 🟢 LOW | Basic coverage sufficient |
| 12 | Frontend components (presentation, chat, layout) | ❌ None (by design) | 🟢 LOW | Not in Workers vitest scope; manual testing required |

---

## 5. Test Matrix

Each row represents a changed area. Test type: **U** = Unit, **I** = Integration, **M** = Manual.

| Changed Area | Test Type | Required? | Status | Notes |
|---|---|---|---|---|
| `routeAuthChecks` | U | ✅ Required | ❌ Missing | Pure function — write now |
| `AuthController.isSupabaseAuthEnabled` | U | ✅ Required | ❌ Missing | Pure env-flag check |
| `AuthController.hasOAuthProviders` | U | ✅ Required | ❌ Missing | Includes new Supabase branch |
| `credentialsToRuntimeOverrides` | U | ✅ Required | ❌ Missing | Regression-prone mapping function |
| `AGENT_CONSTRAINTS` map contents | U | ✅ Required | ❌ Missing | Data integrity check |
| `isValidAIModel` | U | Recommended | ❌ Missing | Low complexity but new models |
| `isChatCompletionAIModel` | U | Recommended | ❌ Missing | Already indirect-tested |
| `toAIModel` | U | Recommended | ❌ Missing | Simple guard |
| `byokHelper` (all helpers) | U | ✅ Required | ✅ Exists (11 tests) | No new tests needed |
| `ModelTestService` image-skip | U | ✅ Required | ✅ Exists (2 tests) | Adequate for image path |
| `UserSecretsStore` DO | U | ✅ Required | ✅ Exists (8 tests) | Adequate |
| `preDeploySafetyGate` | U | ✅ Required | ✅ Exists (14 tests) | Excellent |
| Output formats (xml, scof, udiff, s-r) | U | ✅ Required | ✅ Exists (~200 tests) | Excellent |
| `AuthService` login/register | I | Recommended | ❌ Missing | Needs Miniflare D1 or mock DB |
| Presentation fullscreen changes | M | Manual only | — | React component; manual smoke test |
| Chat UI (preview-iframe, view-mode-switch) | M | Manual only | — | Excluded per vitest config |
| UI Layout (sidebar, header) | M | Manual only | — | React component; visual regression |
| New auth routes | I/M | Manual only | — | Routes excluded per vitest config |
| `supabase-browser-client.ts` | M | Manual only | — | Thin wrapper; manual OAuth flow test |

---

## 6. Recommended New Tests

The following tests are all feasible within the Vitest Workers pool environment (no real DB, no real network, no Hono context required for pure-function tests).

### 6.1 `worker/agents/inferutils/config.types.test.ts` *(NEW FILE)*

```typescript
import { describe, it, expect } from 'vitest';
import {
  AIModels,
  isValidAIModel,
  isChatCompletionAIModel,
  toAIModel,
  credentialsToRuntimeOverrides,
} from './config.types';

describe('isValidAIModel', () => {
  it('returns true for a registered model id', () => {
    expect(isValidAIModel(AIModels.KIMI_2_5)).toBe(true);
  });

  it('returns true for a new v2 model (Gemini 3 Pro Preview)', () => {
    expect(isValidAIModel(AIModels.GEMINI_3_PRO_PREVIEW)).toBe(true);
  });

  it('returns false for an unregistered string', () => {
    expect(isValidAIModel('openai/gpt-99')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidAIModel('')).toBe(false);
  });
});

describe('isChatCompletionAIModel', () => {
  it('returns true for chat models', () => {
    expect(isChatCompletionAIModel(AIModels.KIMI_2_5)).toBe(true);
    expect(isChatCompletionAIModel(AIModels.GEMINI_2_5_FLASH)).toBe(true);
  });

  it('returns false for image models', () => {
    expect(isChatCompletionAIModel(AIModels.WORKERS_FLUX_2_KLEIN_9B)).toBe(false);
    expect(isChatCompletionAIModel(AIModels.WORKERS_LEONARDO_LUCID_ORIGIN)).toBe(false);
  });

  it('returns true for unknown model ids (fail-open)', () => {
    expect(isChatCompletionAIModel('unknown/model-xyz')).toBe(true);
  });
});

describe('toAIModel', () => {
  it('returns model for valid id', () => {
    expect(toAIModel(AIModels.KIMI_2_5)).toBe(AIModels.KIMI_2_5);
  });

  it('returns undefined for invalid id', () => {
    expect(toAIModel('not-a-model')).toBeUndefined();
  });

  it('returns undefined for null and undefined', () => {
    expect(toAIModel(null)).toBeUndefined();
    expect(toAIModel(undefined)).toBeUndefined();
  });
});

describe('credentialsToRuntimeOverrides', () => {
  it('returns undefined when credentials is undefined', () => {
    expect(credentialsToRuntimeOverrides(undefined)).toBeUndefined();
  });

  it('maps provider api keys into userApiKeys', () => {
    const result = credentialsToRuntimeOverrides({
      providers: {
        openai: { apiKey: 'sk-test' },
        anthropic: { apiKey: 'ant-test' },
      },
    });
    expect(result?.userApiKeys?.openai).toBe('sk-test');
    expect(result?.userApiKeys?.anthropic).toBe('ant-test');
  });

  it('omits userApiKeys when no provider keys', () => {
    const result = credentialsToRuntimeOverrides({ providers: {} });
    expect(result?.userApiKeys).toBeUndefined();
  });

  it('maps aiGateway override', () => {
    const result = credentialsToRuntimeOverrides({
      aiGateway: { baseUrl: 'https://gateway.example.com', token: 'gw-token' },
    });
    expect(result?.aiGatewayOverride?.baseUrl).toBe('https://gateway.example.com');
    expect(result?.aiGatewayOverride?.token).toBe('gw-token');
  });

  it('maps both providers and aiGateway together', () => {
    const result = credentialsToRuntimeOverrides({
      providers: { grok: { apiKey: 'grok-key' } },
      aiGateway: { baseUrl: 'https://gw.example.com', token: 'tok' },
    });
    expect(result?.userApiKeys?.grok).toBe('grok-key');
    expect(result?.aiGatewayOverride).toBeDefined();
  });
});
```

---

### 6.2 `worker/agents/inferutils/config.test.ts` *(NEW FILE)*

```typescript
import { describe, it, expect } from 'vitest';
import { AGENT_CONSTRAINTS } from './config';
import { AIModels } from './config.types';

describe('AGENT_CONSTRAINTS', () => {
  it('includes fastCodeFixer constraint', () => {
    expect(AGENT_CONSTRAINTS.has('fastCodeFixer')).toBe(true);
  });

  it('fastCodeFixer allows Workers AI models', () => {
    const constraint = AGENT_CONSTRAINTS.get('fastCodeFixer')!;
    expect(constraint.enabled).toBe(true);
    expect(constraint.allowedModels.has(AIModels.KIMI_2_5)).toBe(true);
    expect(constraint.allowedModels.has(AIModels.GROK_4_1_FAST_NON_REASONING)).toBe(true);
    expect(constraint.allowedModels.has(AIModels.DISABLED)).toBe(true);
  });

  it('fastCodeFixer does not allow image-only models', () => {
    const constraint = AGENT_CONSTRAINTS.get('fastCodeFixer')!;
    expect(constraint.allowedModels.has(AIModels.WORKERS_FLUX_2_KLEIN_9B)).toBe(false);
    expect(constraint.allowedModels.has(AIModels.WORKERS_LEONARDO_LUCID_ORIGIN)).toBe(false);
  });

  it('realtimeCodeFixer constraint exists and is enabled', () => {
    const constraint = AGENT_CONSTRAINTS.get('realtimeCodeFixer')!;
    expect(constraint).toBeDefined();
    expect(constraint.enabled).toBe(true);
  });

  it('fileRegeneration allows all chat models', () => {
    const constraint = AGENT_CONSTRAINTS.get('fileRegeneration')!;
    expect(constraint.allowedModels.has(AIModels.KIMI_2_5)).toBe(true);
    expect(constraint.allowedModels.has(AIModels.GEMINI_3_PRO_PREVIEW)).toBe(true);
  });
});
```

---

### 6.3 `worker/middleware/auth/routeAuth.test.ts` *(NEW FILE)*

```typescript
import { describe, it, expect } from 'vitest';
import { routeAuthChecks, AuthConfig } from './routeAuth';
import type { AuthUser } from '../../types/auth-types';

const mockUser: AuthUser = {
  id: 'user-123',
  email: 'test@example.com',
};

describe('routeAuthChecks', () => {
  describe('public routes', () => {
    it('always succeeds without a user', async () => {
      const result = await routeAuthChecks(null, {} as Env, AuthConfig.public);
      expect(result.success).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it('also succeeds with an authenticated user', async () => {
      const result = await routeAuthChecks(mockUser, {} as Env, AuthConfig.public);
      expect(result.success).toBe(true);
    });
  });

  describe('authenticated routes', () => {
    it('returns success: false and 401 response without a user', async () => {
      const result = await routeAuthChecks(null, {} as Env, AuthConfig.authenticated);
      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('returns success: true with a valid user', async () => {
      const result = await routeAuthChecks(mockUser, {} as Env, AuthConfig.authenticated);
      expect(result.success).toBe(true);
    });
  });

  describe('owner-only routes', () => {
    it('returns success: false and 401 without a user', async () => {
      const result = await routeAuthChecks(null, {} as Env, AuthConfig.ownerOnly);
      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(401);
    });

    it('returns success: true when resourceOwnershipCheck passes', async () => {
      const requirement = {
        required: true,
        level: 'owner-only' as const,
        resourceOwnershipCheck: async () => true,
      };
      const result = await routeAuthChecks(mockUser, {} as Env, requirement, { agentId: 'agent-1' });
      expect(result.success).toBe(true);
    });

    it('returns success: false with 403 when resourceOwnershipCheck fails', async () => {
      const requirement = {
        required: true,
        level: 'owner-only' as const,
        resourceOwnershipCheck: async () => false,
      };
      const result = await routeAuthChecks(mockUser, {} as Env, requirement, { agentId: 'agent-1' });
      expect(result.success).toBe(false);
      expect(result.response?.status).toBe(403);
    });

    it('returns success: false when no params passed to owner-only with check', async () => {
      const requirement = {
        required: true,
        level: 'owner-only' as const,
        resourceOwnershipCheck: async () => true,
      };
      const result = await routeAuthChecks(mockUser, {} as Env, requirement); // no params
      expect(result.success).toBe(false);
    });
  });
});
```

---

### 6.4 `worker/api/controllers/auth/controller.test.ts` *(NEW FILE — static helpers only)*

```typescript
import { describe, it, expect } from 'vitest';
import { AuthController } from './controller';

function makeEnv(overrides: Partial<Env> = {}): Env {
  return overrides as Env;
}

describe('AuthController.isSupabaseAuthEnabled', () => {
  it('returns false when USE_SUPABASE_AUTH is not set', () => {
    expect(AuthController.isSupabaseAuthEnabled(makeEnv({}))).toBe(false);
  });

  it('returns false when flag is true but SUPABASE_JWT_SECRET missing', () => {
    expect(AuthController.isSupabaseAuthEnabled(makeEnv({
      USE_SUPABASE_AUTH: 'true',
      SUPABASE_URL: 'https://example.supabase.co',
    }))).toBe(false);
  });

  it('returns false when flag is true but SUPABASE_URL missing', () => {
    expect(AuthController.isSupabaseAuthEnabled(makeEnv({
      USE_SUPABASE_AUTH: 'true',
      SUPABASE_JWT_SECRET: 'some-secret',
    }))).toBe(false);
  });

  it('returns true when flag is "true" and both secrets are present', () => {
    expect(AuthController.isSupabaseAuthEnabled(makeEnv({
      USE_SUPABASE_AUTH: 'true',
      SUPABASE_JWT_SECRET: 'jwt-secret',
      SUPABASE_URL: 'https://example.supabase.co',
    }))).toBe(true);
  });

  it('returns true when flag is "1"', () => {
    expect(AuthController.isSupabaseAuthEnabled(makeEnv({
      USE_SUPABASE_AUTH: '1',
      SUPABASE_JWT_SECRET: 'jwt-secret',
      SUPABASE_URL: 'https://example.supabase.co',
    }))).toBe(true);
  });

  it('returns false when flag is any other value', () => {
    expect(AuthController.isSupabaseAuthEnabled(makeEnv({
      USE_SUPABASE_AUTH: 'yes',
      SUPABASE_JWT_SECRET: 'jwt-secret',
      SUPABASE_URL: 'https://example.supabase.co',
    }))).toBe(false);
  });
});

describe('AuthController.hasOAuthProviders', () => {
  it('returns false when no providers configured', () => {
    expect(AuthController.hasOAuthProviders(makeEnv({}))).toBe(false);
  });

  it('returns true when Google OAuth is configured', () => {
    expect(AuthController.hasOAuthProviders(makeEnv({
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
    }))).toBe(true);
  });

  it('returns true when GitHub OAuth is configured', () => {
    expect(AuthController.hasOAuthProviders(makeEnv({
      GITHUB_CLIENT_ID: 'ghid',
      GITHUB_CLIENT_SECRET: 'ghsecret',
    }))).toBe(true);
  });

  it('returns true when Supabase auth is enabled', () => {
    expect(AuthController.hasOAuthProviders(makeEnv({
      USE_SUPABASE_AUTH: 'true',
      SUPABASE_JWT_SECRET: 'jwt-secret',
      SUPABASE_URL: 'https://example.supabase.co',
    }))).toBe(true);
  });

  it('returns false when only one side of an OAuth pair is set', () => {
    expect(AuthController.hasOAuthProviders(makeEnv({
      GOOGLE_CLIENT_ID: 'gid', // missing GOOGLE_CLIENT_SECRET
    }))).toBe(false);
  });
});
```

---

## 7. Sign-off Criteria for v2.0.0 Release

### 7.1 Automated — Must Pass Before Release

| Criterion | Command | Threshold |
|---|---|---|
| All vitest tests pass | `npm run test` | 0 failures |
| TypeScript compiles clean | `npm run typecheck` | 0 errors |
| No new lint errors | `npm run lint` | 0 new errors (pre-existing errors are documented) |

### 7.2 New Test Requirements — Must Exist Before Release

| Test File | Minimum Tests | Key Assertions |
|---|---|---|
| `worker/middleware/auth/routeAuth.test.ts` | 7 | Public always passes; authenticated returns 401 without user; owner-only returns 401/403 correctly |
| `worker/api/controllers/auth/controller.test.ts` | 9 | `isSupabaseAuthEnabled` all flag combinations; `hasOAuthProviders` all provider combos |
| `worker/agents/inferutils/config.types.test.ts` | 10 | `isValidAIModel`, `isChatCompletionAIModel`, `toAIModel`, `credentialsToRuntimeOverrides` |
| `worker/agents/inferutils/config.test.ts` | 5 | `AGENT_CONSTRAINTS` map presence, fixer model allowances, image model exclusions |

### 7.3 Manual Smoke Tests — Required Before Release

| Scenario | Steps | Pass Criteria |
|---|---|---|
| Email/password login | Log in with existing account via email/password | Redirects to dashboard; no errors |
| Supabase OAuth login (if `USE_SUPABASE_AUTH=true`) | Click OAuth login button | OAuth flow completes; session established |
| BYOK model selection | Add a BYOK API key for Workers AI; open model picker | Workers AI models appear; image models absent |
| New model availability | Open model picker without BYOK; verify default models | Kimi 2.5 or configured default appears |
| Presentation fullscreen | Open a presentation; click fullscreen | Fullscreen renders correctly |
| Chat preview iframe | Create/open a project; switch view modes | Preview iframe loads; view-mode-switch works |
| Sidebar collapse/expand | Collapse and expand app sidebar | No layout regressions |
| Agent AI generation | Trigger a chat/generation request | Request completes without 500 errors |

### 7.4 Regression Criteria

| Pre-existing state | Expectation |
|---|---|
| Pre-existing ~10 lint errors | Still ~10 or fewer (no new lint errors) |
| Pre-existing ~2 TypeScript errors | Still ~2 or fewer (no regressions) |
| All 10 current test files | 100% pass rate (0 new failures) |

---

## 8. Go / No-Go Assessment

### Automated Status (current state, before new tests)

| Check | Status | Blocking? |
|---|---|---|
| Existing vitest tests (10 files, ~250+ tests) | ✅ All pass (assumed; run `npm run test` to confirm) | Yes |
| TypeScript typecheck | ⚠️ Run to confirm | Yes |
| Lint | ⚠️ Run to confirm (pre-existing errors expected) | Yes (new errors only) |

### Test Gap Status (current state)

| Gap | Severity | Blocks Release? |
|---|---|---|
| `routeAuthChecks` has no tests | 🔴 HIGH | **YES** — pure function, must be tested before release |
| `isSupabaseAuthEnabled` / `hasOAuthProviders` have no tests | 🔴 HIGH | **YES** — new Supabase path could silently break auth |
| `credentialsToRuntimeOverrides` has no tests | 🟡 MEDIUM | **Strongly recommended** — every BYOK inference uses this |
| `AGENT_CONSTRAINTS` has no tests | 🟡 MEDIUM | Recommended before release |
| `isValidAIModel`/`isChatCompletionAIModel`/`toAIModel` | 🟡 MEDIUM | Recommended before release |
| `AuthService` login/register no unit tests | 🟡 MEDIUM | Acceptable (D1 dependency); mitigated by manual smoke testing |
| Frontend components no vitest coverage | ✅ Acceptable | Mitigated by manual smoke testing |

### Verdict

```
❌ NO-GO (current state)

Blocker: routeAuthChecks and isSupabaseAuthEnabled/hasOAuthProviders
have zero test coverage. These are high-risk pure functions that
are testable today and represent new/changed behavior in v2.0.0.

Path to GO:
1. Add the 4 recommended test files (31 new tests total)
2. Run npm run test — all tests must pass
3. Run npm run typecheck — 0 new errors
4. Complete manual smoke test checklist (section 7.3)
5. Confirm existing test pass rate remains 100%

Estimated effort: ~2–3 hours of test authoring + validation run
```

---

## 9. Appendix: Test File Inventory

| File | Tests | Suite |
|---|---|---|
| `worker/api/controllers/modelConfig/byokHelper.test.ts` | 11 | Model config |
| `worker/database/services/ModelTestService.test.ts` | 2 | Model testing |
| `worker/services/secrets/UserSecretsStore.test.ts` | 8 | Secrets / Durable Objects |
| `worker/agents/utils/preDeploySafetyGate.test.ts` | 14 | AI safety |
| `worker/agents/output-formats/streaming-formats/xml-stream.test.ts` | ~30 | Output formats |
| `worker/agents/output-formats/streaming-formats/scof.test.ts` | ~15 | Output formats |
| `worker/agents/output-formats/streaming-formats/scof-comprehensive.test.ts` | ~20 | Output formats |
| `worker/agents/output-formats/diff-formats/udiff.test.ts` | ~15 | Output formats |
| `worker/agents/output-formats/diff-formats/udiff-comprehensive.test.ts` | ~20 | Output formats |
| `worker/agents/output-formats/diff-formats/search-replace.test.ts` | ~80 | Output formats |
| **Total existing** | **~215** | |
| `worker/middleware/auth/routeAuth.test.ts` *(new)* | 7 | Auth |
| `worker/api/controllers/auth/controller.test.ts` *(new)* | 9 | Auth |
| `worker/agents/inferutils/config.types.test.ts` *(new)* | 10 | AI config |
| `worker/agents/inferutils/config.test.ts` *(new)* | 5 | AI config |
| **Total with new tests** | **~246** | |
