# File-by-file implementation checklist — Workers AI integration

Work in order where dependencies apply. Check boxes as you complete each step.

## Registry and types

- [ ] **`worker/agents/inferutils/config.types.ts`**
  - Add `WORKERS_LLAMA_4_SCOUT`, `WORKERS_NEMOTRON_3_120B` chat entries (`id`: `workers-ai/@cf/...`, `provider`: `workers`, `size`, `creditCost`, `contextSize`).
  - Add image entries (`flux-2-klein-9b`, `lucid-origin`) with **`modality: 'image'`** (or equivalent) once `AIModelConfig` is extended; default `modality: 'chat'` on existing entries.
  - Re-export derived lists if needed: e.g. `ChatAIModels` type or `isChatAIModel(id: string): boolean` helper (typed, no `any`).

- [ ] **`worker/agents/inferutils/config.ts`**
  - Decide defaults per `AGENT_CONFIG` branch (`PLATFORM_AGENT_CONFIG` / `DEFAULT_AGENT_CONFIG`) for new chat models (optional).
  - Extend `WORKERS_AI_CHOICE` if realtime/fast fixers should allow Llama Scout / Nemotron.
  - Review `templateSelection` / `conversationalResponse` constraints vs new model sizes.

## Access control and APIs

- [ ] **`worker/api/controllers/modelConfig/byokHelper.ts`**
  - Replace naive `getProviderFromModel` usage for access lists with **`normalizeModelAccessProvider(model: string): string`** (e.g. `workers-ai` → `workers`).
  - Implement **`getUserProviderStatus`** to read vault secrets for `getBYOKTemplates()` and set `hasValidKey` from real stored values (pattern: `loadByokKeysFromUserVault` + template list).
  - Update **`getByokModels`** so `workers` BYOK keys match models prefixed with `workers-ai/` (explicit mapping).
  - Extend **`getPlatformEnabledProviders`** / **`getPlatformAvailableModels`** so Workers AI chat models appear when `WORKERS_API_KEY` (and policy) satisfies platform access.
  - Update **`validateModelAccessForEnvironment`** to use normalized provider consistently.

- [ ] **`worker/api/controllers/modelConfig/controller.ts`**
  - Re-test `getByokProviders` with `agentAction` query for `deepDebugger`, `templateSelection`, `realtimeCodeFixer` after helper fixes.
  - Confirm update path no longer 403s for valid Workers AI models.

- [ ] **`worker/api/controllers/modelConfig/constraintHelper.ts`**
  - No change unless new actions or constraint rules; verify `getFilteredModelsForAgent` with expanded `AIModels`.

## Inference and agents

- [ ] **`worker/agents/inferutils/core.ts`** / **`worker/agents/inferutils/infer.ts`**
  - Guard: if model is image modality, **do not** call chat completions; throw typed error or delegate to image module.
  - Confirm `modelName` passed to OpenAI-compatible client remains full `workers-ai/@cf/...` string.

- [ ] **`worker/database/services/ModelTestService.ts`**
  - Branch `testModelConfig`: chat vs image; for image, call Workers AI image API (new helper) or return “not supported in test” with clear message.
  - Extend **`getTestModelForProvider`** if new provider aliases appear.

## Frontend

- [ ] **`src/components/config-modal.tsx`**
  - Align **`getProviderFromModel`** with backend normalization for display/BYOK badges (`workers-ai` → treat as platform Workers AI when appropriate).
  - Optionally show human-readable labels via `AI_MODEL_CONFIG` name map (future: API returns labels).

- [ ] **`src/utils/model-helpers.ts`**
  - Already handles `workers-ai/` for provider badge; verify after any id changes.

- [ ] **`src/lib/api-client.ts`**
  - Only if response shapes change (e.g. new fields on `ByokProvidersData`).

## Config and env

- [ ] **`worker-configuration.d.ts`** / **`wrangler.jsonc`** / **`.dev.vars.example`**
  - Document `WORKERS_API_KEY`, gateway vars for Workers AI; ensure `Env` types include any new bindings.

## Tests

- [ ] **Unit tests** for `normalizeModelAccessProvider`, `getByokModels` mapping, and constraint filtering (Vitest in worker test suite if present).
- [ ] **Manual**: open Settings → configure an agent with `deepDebugger` — dropdown must list Workers AI chat models when platform key is set.

## Image generation (see `image-models-branching.md`)

- [ ] New module e.g. **`worker/agents/inferutils/workersAiImage.ts`** (name as you prefer) calling Workers AI REST/image binding per Cloudflare docs.
- [ ] Wire only from features that produce images (not from `executeInference`).
