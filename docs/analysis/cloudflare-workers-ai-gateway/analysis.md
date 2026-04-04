# Cloudflare Workers AI & AI Gateway — findings (2025–2026 docs)

Sources: see `citation.yaml`. Pulled from **Cloudflare Developers** (`developers.cloudflare.com`) on **2026-04-04**.

---

## 1) Model availability (@cf IDs)

All of the following appear in the **official Workers AI pricing table** as first-class `@cf/...` models (availability + unit pricing documented there):

| User slug (informal) | Documented Workers AI ID |
| --- | --- |
| `moonshotai/kimi-k2.5` | `@cf/moonshotai/kimi-k2.5` |
| `openai/gpt-oss-120b` | `@cf/openai/gpt-oss-120b` |
| `zai-org/glm-4.7-flash` | `@cf/zai-org/glm-4.7-flash` |
| `meta/llama-4-scout-17b-16e-instruct` | `@cf/meta/llama-4-scout-17b-16e-instruct` |
| `nvidia/nemotron-3-120b-a12b` | `@cf/nvidia/nemotron-3-120b-a12b` |
| `black-forest-labs/flux-2-klein-9b` | `@cf/black-forest-labs/flux-2-klein-9b` |
| `leonardo/lucid-origin` | `@cf/leonardo/lucid-origin` |

**Uncertain / not claimed:** Nothing in this list was left unverified against the pricing page; if a model disappears from that table or returns 404 on its model page, treat availability as changed and re-check the models index.

**Related changelog anchors (announcements, not a substitute for the pricing table):**

- FLUX.2 [klein] 9B: https://developers.cloudflare.com/changelog/2026-01-28-flux-2-klein-9b-workers-ai/
- GLM-4.7-Flash: https://developers.cloudflare.com/changelog/2026-02-13-glm-47-flash-workers-ai/

**Published unit pricing (from Workers AI pricing — same page as neuron columns):**

- `@cf/moonshotai/kimi-k2.5`: $0.60/M input, **$0.10/M cached input**, $3.00/M output (+ neuron equivalents listed on page).
- `@cf/openai/gpt-oss-120b`: $0.35/M input, $0.75/M output.
- `@cf/zai-org/glm-4.7-flash`: $0.06/M input, $0.40/M output.
- `@cf/meta/llama-4-scout-17b-16e-instruct`: $0.27/M input, $0.85/M output.
- `@cf/nvidia/nemotron-3-120b-a12b`: $0.50/M input, $1.50/M output.
- `@cf/black-forest-labs/flux-2-klein-9b`: $0.015 per first MP (1024×1024), $0.002 per subsequent MP, $0.002 per input image MP (see image section).
- `@cf/leonardo/lucid-origin`: $0.006996 per 512×512 tile, $0.000132 per step (page rounds copy in model card; pricing table is authoritative).

---

## 2) Pricing / billing

### Workers AI

- **Billing unit:** **Neurons** at **$0.011 per 1,000 Neurons** (backend billing), with **per-model display pricing** in tokens / image / audio units aligned to the same neuron economics.
- **Free allocation:** **10,000 Neurons per day** on both Workers Free and Workers Paid; overage on Paid billed at the neuron rate. **Workers Free** cannot pay for overage (must upgrade).
- **Reset:** Daily at **00:00 UTC**; exceeding limits yields errors (per pricing page).

### AI Gateway

- **Core product:** Dashboard analytics, **caching**, and **rate limiting** are described as **free** “core features” on all plans; some future features may be free or premium (explicitly left open in docs).
- **Persistent logs:** Free storage caps by Workers plan (100k total on Free; 1M total on Paid); overage handling documented as N/A with upgrade path on Free.
- **Logpush (Paid only):** **10M requests/month included**, then **$0.05 per additional million** requests.

### vs OpenAI / Anthropic “direct”

- **Not documented as a markup comparison:** Official docs do **not** provide a guaranteed “Cloudflare is X% cheaper than direct OpenAI/Anthropic” statement for passthrough traffic.
- **Unified Billing:** You **load credits** and can call listed providers **without passing their API key** (Cloudflare-managed credentials); spend is against **your Cloudflare credits**, with **daily/weekly/monthly spend limits** — this is **billing consolidation and control**, not a documented universal unit discount vs direct billing.
- **BYOK path:** If you bring your own provider keys, you still pay the provider according to their pricing; Gateway adds **observability/control** and optional **cache/rate-limit** effects, not a documented flat per-token discount.

---

## 3) Efficiency / savings (documented)

**AI Gateway caching** (authoritative claims):

- **Lower latency** on cache hits (skip round trip to origin provider).
- **Cost savings** by reducing paid provider calls for **identical** requests.
- **Higher throughput** by offloading repetitive traffic.
- **Scope:** Supported for **text and image** responses; **identical requests only**; docs note **volatile cache** behavior under concurrent identical requests. Semantic caching is described as **planned**, not current.

**AI Gateway rate limiting:**

- Documented purpose includes preventing **expensive bills** and **abuse**; returns **429** when exceeded.

**Workers AI vs external APIs (latency/cost):**

- **Cost:** Compare using **Workers AI pricing table** vs each provider’s public API pricing for the same workload — Cloudflare docs reviewed here do **not** publish a single benchmarked “Workers AI is always cheaper/faster” claim for all models.
- **Latency:** **Cache hits** are explicitly faster per AI Gateway docs; **uncached** latency vs calling a provider directly is **not** quantified in the pages retrieved for this note.

---

## 4) Image models — API shape vs chat completions

### `@cf/black-forest-labs/flux-2-klein-9b`

- **Documented invocation:** `env.AI.run` with **`multipart`** body (FormData stream + `contentType`) or REST **`/ai/run`** with **`multipart/form-data`** (`curl --form`).
- **Output:** Base64 image string in JSON (`image` field).
- **OpenAI chat completions:** **Not** described as the primary interface for this model on its model page; it is a **task-specific** (text-to-image / editing) **run** API with multipart inputs.

### `@cf/leonardo/lucid-origin`

- **Documented invocation:** `env.AI.run("@cf/leonardo/lucid-origin", { prompt, ... })` with **JSON inputs**, or REST **`/ai/run/...`** with JSON body.
- **Output:** Base64 `image` in JSON (or Worker returns image bytes in examples).
- **OpenAI chat completions:** **Not** indicated on the model page as a chat-completions surface; treat as **Workers AI run** / REST run.

### LLMs (contrast)

- Example: `@cf/openai/gpt-oss-120b` documents **three** formats: **Responses API** (`/ai/v1/responses`), **Workers AI Run** (`/ai/run` with multiple shapes), and **`/v1/chat/completions`** (OpenAI-compatible). That pattern is **model-specific**; do **not** assume image models share it unless their model page says so.

### AI Gateway + Workers AI

- REST via Gateway: `https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/{model_id}` (replaces `api.cloudflare.com/.../ai/run/...`).
- **OpenAI-compatible** paths exist for Workers AI for **text generation** and **embeddings** per provider doc; **image run** models should still use the **Workers AI run** semantics appropriate to that model (e.g. multipart for flux-2-klein-9b), not generic chat completions, unless documentation explicitly adds a compat route for that model.

---

## Explicit gaps / uncertainty

- **No hallucinated model IDs:** Every ID above was taken from the **Workers AI pricing** page table or the linked model pages.
- **Dynamic availability:** Partner models and prices can change; always reconcile **models index + pricing table + model page**.
- **Third-party “pricing explained” blogs** were **not** used as primary evidence; only Cloudflare Developers pages and changelog URLs are cited in `citation.yaml`.
