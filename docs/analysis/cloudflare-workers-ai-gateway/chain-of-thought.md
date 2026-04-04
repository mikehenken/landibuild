# Chain of thought (brief) — search strategy & verification

## Objectives

1. Confirm whether specific **vendor-style slugs** map to real **`@cf/...`** IDs on Workers AI.
2. Extract **billing mechanics** (Workers AI neurons + AI Gateway billable add-ons).
3. Extract **documented** Gateway benefits (cache, rate limits, unified billing), separating **marketing** from **docs claims**.
4. Classify **image** vs **chat** API patterns from **model pages**, not assumptions.

## Query strategy

- **Site-biased searches** (`site:developers.cloudflare.com`) for rare model strings to avoid blog noise.
- **Direct fetches** of:
  - Workers AI **pricing** (single table is the strongest artifact for “is this model real?”).
  - AI Gateway **pricing**, **caching**, **rate limiting**, **unified billing**.
  - AI Gateway **Workers AI provider** (integration URL patterns + compat scope).
  - Representative **model pages**: `flux-2-klein-9b`, `lucid-origin`, `gpt-oss-120b`.

## Verification rules

- **Primary source of truth for IDs + prices:** `workers-ai/platform/pricing/` table — it lists exact `@cf/...` strings alongside token/neuron pricing.
- **If not in table:** would have reported **unverified**; in this run, **all seven** user-listed models appeared in that table.
- **Cost vs OpenAI/Anthropic:** no official doc in this set states a universal discount; **Unified Billing** is framed as **credits + consolidated billing + limits**, not “cheaper tokens by default.”

## Image vs chat conclusion (logic)

- Read **model-specific** “Usage” sections:
  - **Flux 2 Klein 9B** → **multipart** + `/ai/run` → **not** chat-completions-shaped.
  - **Lucid Origin** → JSON **`AI.run`** + `/ai/run` → **not** chat-completions on the model page.
  - **GPT-OSS-120B** → explicitly lists **chat completions** as one of several supported formats → **do not generalize** to image models.

## Residual uncertainty

- **Future doc drift:** pricing rows and model pages can update without notice; changelog entries supplement but do not replace the pricing table.
- **Compat endpoint coverage for every image model:** only **general** statements exist that Workers AI supports OpenAI-compatible endpoints for **text generation** and **embeddings**; per-image-model compat was **not** assumed beyond what each model page shows.
