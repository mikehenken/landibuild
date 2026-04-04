# LandiBUILD — Workers AI (`workers-ai/@cf/...`) integration plan

**Related artifacts in this folder:** [file-checklist.md](./file-checklist.md) (step-by-step file changes), [image-models-branching.md](./image-models-branching.md) (chat vs image APIs).

## Scope

Internal analysis for wiring Cloudflare Workers AI models (AI Gateway OpenAI-compatible chat where supported, and separate image-generation APIs where not) into the existing `MODELS_MASTER` / `infer` / model-config UI pipeline.

**Target model IDs (user list):**

| Model | Role |
|--------|------|
| `@cf/moonshotai/kimi-k2.5` | Chat (already in registry) |
| `@cf/openai/gpt-oss-120b` | Chat (already in registry) |
| `@cf/zai-org/glm-4.7-flash` | Chat (already in registry) |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | Chat — **add** |
| `@cf/nvidia/nemotron-3-120b-a12b` | Chat — **add** |
| `@cf/black-forest-labs/flux-2-klein-9b` | Image — **add** (not chat completions) |
| `@cf/leonardo/lucid-origin` | Image — **add** (not chat completions) |

Canonical full model strings in this codebase: `workers-ai/@cf/<publisher>/<slug>` (see comment in `worker/agents/inferutils/config.types.ts`).

---

## 1. Registry pattern

### 1.1 `MODELS_MASTER` / `AIModels` / `AI_MODEL_CONFIG`

Source of truth: `worker/agents/inferutils/config.types.ts`.

- Each entry: `{ id: string; config: AIModelConfig }`.
- **`id`**: must be the gateway-facing id, e.g. `workers-ai/@cf/meta/llama-4-scout-17b-16e-instruct`.
- **`config.provider`**: keep **`workers`** (not `workers-ai`) so `getConfigurationForModel` / `getApiKey` resolve `WORKERS_API_KEY` and gateway token behavior consistently with existing Workers AI chat entries (`KIMI_2_5`, `WORKERS_GPT_OSS_120B`, `WORKERS_GLM_4_7_FLASH`).
- **`config.size`**: map to `ModelSize.LITE | REGULAR | LARGE` for `LiteModels` / `RegularModels` / constraint UX:
  - **Lite**: small/fast chat (e.g. GLM 4.7 Flash — already LITE).
  - **Regular**: mid chat (e.g. Llama 4 Scout — candidate REGULAR if policy is “smaller than 120B class”).
  - **Large**: heavy chat (Kimi 2.5, GPT-OSS 120B, Nemotron 3 120B).
- **`creditCost`**: keep the existing convention (GPT-5 Mini baseline ≈ 1 credit in comments). For new Workers AI rows, **anchor to [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)** neuron/token rows for each `@cf/...` slug and convert to the same abstract credit scale used elsewhere (document the formula in code comments next to each new entry).

### 1.2 Chat vs image

`AIModelConfig` today has no modality field. For image models, add an explicit discriminator so chat inference never selects them by mistake, for example:

- **`modality: 'chat' | 'image'`** on `AIModelConfig` (default `'chat'` for all existing entries), **or**
- A separate `WORKERS_IMAGE_MODELS_MASTER` + exported list, and **omit** image ids from `AIModels` used by `executeInference` / `ModelTestService` chat tests.

Prefer the **`modality`** field: one registry, type-safe filtering (`filter((m) => config.modality !== 'image')`) without string heuristics.

---

## 2. Mapping models to agent actions

Defaults live in `worker/agents/inferutils/config.ts` (`AGENT_CONFIG` / `PLATFORM_AGENT_CONFIG` / `DEFAULT_AGENT_CONFIG`).

| Agent action | Typical need | Workers AI chat fit | Notes |
|--------------|--------------|---------------------|--------|
| `blueprint` | Structured JSON, high quality | Kimi / GPT-OSS / Nemotron | Large context; validate JSON schema reliability per model. |
| `phaseGeneration` | Planning + optional multimodal | Same tier | Already `AllModels` in constraints. |
| `deepDebugger` | Reasoning, stack traces | Kimi / GPT-OSS / Nemotron | **No** `AGENT_CONSTRAINTS` entry today → UI uses full filtered platform/BYOK list once fixed. |
| `fileRegeneration` | Code edits | Fast + code-biased | GLM Flash, Llama Scout, or Kimi per benchmarks; Nemotron if acceptable latency. |
| `templateSelection` | **Lite only** | **Only** models in `LiteModels` | GLM 4.7 Flash qualifies; Kimi / 120B models do **not** unless reclassified (not recommended). |
| `conversationalResponse` | **RegularModels** only in constraints | Subset of Workers chat | Expand `RegularModels` or constraints carefully so Workers chat models that are LARGE do not appear unless constraint updated. |
| `realtimeCodeFixer` / `fastCodeFixer` | `WORKERS_AI_CHOICE` only | Kimi, GPT-OSS, GLM | Add new chat models to `WORKERS_AI_CHOICE` only if latency meets realtime goals. |
| Image features (future) | Pixel output | Flux / Lucid Origin | **Not** `executeInference` text path; see `image-models-branching.md`. |

**`AGENT_CONSTRAINTS`** (`worker/agents/inferutils/config.ts`): today only a subset of actions are constrained. Any new Workers chat model that should appear in **fast fixers** must be added to `WORKERS_AI_CHOICE` (or a renamed set). Actions without constraints use the full “accessible” list from the API.

---

## 3. `byokHelper` / platform lists / configure screen

### 3.1 Why the UI shows **“No models found”**

`src/components/config-modal.tsx` builds `availableModels` only from `GET /api/model-configs/byok-providers`:

- **BYOK bucket**: `getByokModels(providerStatuses)` keeps models where `model.startsWith(\`${status.provider}/\`)` for each provider with `hasValidKey: true` (`worker/api/controllers/modelConfig/byokHelper.ts`).
- **Platform bucket**: `getPlatformAvailableModels(env)` keeps models whose **`getProviderFromModel(model)`** is in `getPlatformEnabledProviders(env)`.

Problems today:

1. **`getUserProviderStatus` always returns `hasValidKey: false`** for every template (`worker/api/controllers/modelConfig/byokHelper.ts`). So **`modelsByProvider` is always empty** regardless of vault state.
2. **`getProviderFromModel`** uses **only the substring before the first `/`**. For `workers-ai/@cf/...` that yields **`workers-ai`**, but platform keys are tracked under **`openai`**, **`anthropic`**, **`google-ai-studio`**, etc. **`workers-ai` is never enabled**, so **Workers AI chat models never appear in `platformModels`**.
3. Even if BYOK were fixed, **`workers` BYOK templates** (if added) use prefix `workers/`, while model ids use **`workers-ai/`** — **prefix mismatch** means `getByokModels` would still not attach Workers AI models to the `workers` provider without special-casing.

4. **`validateModelAccessForEnvironment`** uses the same **`getProviderFromModel`**, so selecting a Workers AI model can fail with **403** (“requires API key for provider `workers-ai`”) even when `WORKERS_API_KEY` and gateway token are set, because **`workers-ai` ∉ enabled providers**.

**Root cause summary:** the configure flow treats “provider for access control” as the first path segment of the model id. That matches `openai/gpt-5` but **does not** match `workers-ai/@cf/...`, and BYOK status is not wired to the vault.

### 3.2 Intended fixes (design)

- **Normalize provider for access checks**: e.g. map `workers-ai` → `workers` (or introduce `getAccessProviderFromModelId(model: string): string`) and use it in:
  - `getPlatformAvailableModels`
  - `validateModelAccessForEnvironment`
  - optional: frontend `getProviderFromModel` in `config-modal.tsx` for badge logic
- **Platform availability for Workers AI**: treat as available when **`WORKERS_API_KEY`** (or gateway-only policy) is valid **and/or** account has Workers AI entitlement — mirror how `getPlatformEnabledProviders` checks other keys (extend list or special-case `workers`).
- **BYOK**: implement `getUserProviderStatus` using `UserSecretsStore` + `getBYOKTemplates()` (same pattern as `loadByokKeysFromUserVault`). For Workers AI user keys, either:
  - add a **BYOK template** with `provider: 'workers-ai'` **and** register models under that prefix, **or**
  - keep ids as `workers-ai/...` but in `getByokModels` map **`workers`** vault provider to **`workers-ai/`** model prefix.

---

## 4. `ModelTestService`

`worker/database/services/ModelTestService.ts`:

- **`testModelConfig`** calls `infer(...)` — valid only for **chat** models.
- **`getTestModelForProvider('workers')`** already maps to `AIModels.WORKERS_GLM_4_7_FLASH`.

After adding image models:

- Reject or branch in `testModelConfig` when `AI_MODEL_CONFIG[model].modality === 'image'` (or equivalent), returning a clear error or calling an image test harness instead of `infer`.

---

## 5. Frontend dropdown filtering

- **`ModelSelector`** (`src/components/ui/model-selector.tsx`): shows “No models found.” when `filteredModels.length === 0` and `includeDefaultOption` is false — i.e. when **`availableModels` from the parent is empty** (see `config-modal.tsx` `useMemo`).
- **Constraint filtering** happens server-side in `ModelConfigController.getByokProviders` via `getFilteredModelsForAgent` (`worker/api/controllers/modelConfig/constraintHelper.ts`), intersecting with `AGENT_CONSTRAINTS`.

So fixing the API lists (section 3) restores options for actions like **`deepDebugger`** (no constraint). For **`templateSelection`**, only `LiteModels` pass — ensure desired Workers models are **LITE** or relax constraints deliberately.

---

## 6. `src/api-types.ts`

Re-exports `AIModels` from `worker/agents/inferutils/config.types.ts`. Any new `AIModels` union members or `AIModelConfig` fields are automatically reflected on the frontend type side when types are imported from the same source; no duplicate string unions required unless the API returns a narrower DTO.

---

## 7. Inference path (chat)

`worker/agents/inferutils/core.ts` — `getConfigurationForModel` uses `modelConfig.provider` (from `AI_MODEL_CONFIG`), not the raw id prefix. That is **correct** for Workers AI **chat** as long as registry `provider` stays **`workers`**.

Ensure OpenAI client / gateway URL construction accepts full model name `workers-ai/@cf/...` as the `model` parameter (current pattern for existing three Workers models).

---

## 8. Self-review checklist

- [ ] Registry ids use `workers-ai/@cf/...` consistently.
- [ ] `config.provider` remains `workers` for gateway key resolution.
- [ ] Access control uses a **normalized** provider, not naive `split('/')[0]` on the full id.
- [ ] Image models are excluded from chat `infer` / `ModelTestService` unless explicitly implemented.
- [ ] `getUserProviderStatus` reflects vault reality so BYOK models populate.
- [ ] New chat models are added to `WORKERS_AI_CHOICE` only where product intends (fast fixers).
- [ ] `creditCost` / `contextSize` documented with pricing doc reference.

---

## References (code)

- `MODELS_MASTER` / `AIModels`: `worker/agents/inferutils/config.types.ts`
- Defaults and constraints: `worker/agents/inferutils/config.ts`
- Platform/BYOK and access validation: `worker/api/controllers/modelConfig/byokHelper.ts`
- API orchestration: `worker/api/controllers/modelConfig/controller.ts`
- Constraint filter: `worker/api/controllers/modelConfig/constraintHelper.ts`
- Model test: `worker/database/services/ModelTestService.ts`
- Configure modal list: `src/components/config-modal.tsx`
- Empty state: `src/components/ui/model-selector.tsx`
