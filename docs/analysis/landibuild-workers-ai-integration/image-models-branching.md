# Image models: Workers AI vs OpenAI-compatible chat/completions

## Facts

- **Chat / multimodal chat** in LandiBUILD goes through **`executeInference` → `infer`** (`worker/agents/inferutils/infer.ts`, `worker/agents/inferutils/core.ts`): OpenAI-style messages, tools, schemas, streaming.
- **Workers AI** exposes many **text** models via the **AI Gateway OpenAI-compatible** surface using model ids like `workers-ai/@cf/...` (same pattern as existing `KIMI_2_5`, `WORKERS_GPT_OSS_120B`, `WORKERS_GLM_4_7_FLASH`).
- **Image generation** models (`@cf/black-forest-labs/flux-2-klein-9b`, `@cf/leonardo/lucid-origin`) use **Workers AI image generation APIs** (HTTP to gateway Workers AI routes or **`env.AI.run`**-style image bindings per [Cloudflare Workers AI docs](https://developers.cloudflare.com/workers-ai/)), **not** the chat completions message format.

Treating an image model id as `model` in **`/v1/chat/completions`** is expected to fail or return nonsense; it must not share the same code path as blueprint / debugger / phase generation.

---

## How the codebase should branch

### 1. Registry layer

- Tag image-capable entries explicitly (**`modality: 'image'`** on `AIModelConfig` recommended).
- Ensure `AIModels` values for image models exist for **settings / cost / allowlists**, but **exclude** them from:
  - `LiteModels` / `RegularModels` **unless** you intentionally want them in a dropdown (usually a separate “Image model” picker).

### 2. Inference layer

| Path | Use for |
|------|---------|
| **`executeInference` / `infer`** | Text + tool + JSON schema + multimodal **inputs** (user images in messages). |
| **New `generateWorkersAiImage` (or similar)** | Text/params → image bytes / URL for Flux, Lucid Origin, etc. |

**Branch point:** central helper, e.g. `routeModelInvocation(env, modelId, purpose)` that:

1. Resolves `AIModelConfig` from `AI_MODEL_CONFIG` (after narrowing `modelId` to `AIModels`).
2. If `modality === 'image'`, call **image** implementation.
3. Else call existing **`infer`**.

Type this with **`AIModels`** and `AIModelConfig` — no `any`.

### 3. `ModelTestService`

- **`testModelConfig`** must not call `infer` for image modality.
- Options:
  - **A)** Return structured failure: `{ success: false, error: 'Image models must be tested via image test endpoint' }`.
  - **B)** Add **`POST /api/model-configs/test-image`** that runs a tiny generation and checks for binary / URL response.

### 4. UI

- **Configure Deep Debugger** / other **chat** agent modals: **filter out** `modality === 'image'` from `availableModels` (server-side in `getByokProviders` + platform list, or client-side duplicate filter for defense in depth).
- If the product adds **“Generate asset image”** features: separate **Image model** dropdown, separate constraints map (e.g. `AGENT_CONSTRAINTS` for a future `imageGeneration` action), separate max tokens / aspect ratio fields — do not reuse `max_tokens` from chat.

### 5. Agent actions mapping

- **`screenshotAnalysis`**: remains **vision-language chat** (multimodal **input**), not the same as **image output** models. Flux / Lucid Origin are **not** substitutes unless the feature is redesigned to “generate reference image.”
- **Future `imageGeneration` action** (if added): wire to Workers AI image API only; keep out of `DeepDebugger` and `blueprint`.

---

## Summary

- **One registry** with explicit **chat vs image** modality.
- **Two execution paths**: OpenAI-compatible **`infer`** vs Workers AI **image** API.
- **Configure UI** lists chat-only models for chat agents; image models only where generation is supported.
- **Tests** must branch the same way as runtime.
