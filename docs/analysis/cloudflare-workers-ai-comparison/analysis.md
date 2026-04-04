# Cloudflare Workers AI — comparative analysis (codegen, debugger, image gen)

**Audience:** product and engineering. **Scope:** `@cf` models the user listed, plus routing guidance vs frontier APIs and OpenAI-style image stacks. **Sources:** `citation.yaml` (Cloudflare Developers, vendor model cards, Moonshot blog). **Date:** 2026-04-04.

---

## Executive summary

- **Workers AI chat models** in this set span three practical bands: **efficient general/agentic** (`@cf/zai-org/glm-4.7-flash`), **large open-weight reasoning/coding** (`@cf/openai/gpt-oss-120b`, `@cf/nvidia/nemotron-3-120b-a12b`, `@cf/moonshotai/kimi-k2.5`), and **multimodal mid-size** (`@cf/meta/llama-4-scout-17b-16e-instruct`). None of them are drop-in guarantees of “always equals Claude Opus / Gemini 3 Pro / GPT-5.x” on your repository — **benchmarks are harness-specific**, and **hosted inference** may differ from vendors’ reference evaluations.
- **Workers AI + AI Gateway** is strongest when you want **Cloudflare-native billing**, **Worker-side secrets**, **unified analytics**, **rate limiting**, and **caching of identical** text/image requests. **BYOK / direct provider** stays appropriate when you need a **specific closed model SKU**, **provider-only features** (fine-tuning, certain safety configs, enterprise contracts), or **maximum reproducibility** against that provider’s eval story.
- **Image generation** on Workers AI is **not** the same integration model as OpenAI `images/generations`: pricing units (**MP / 512×512 tiles / steps**) and **partner model** behaviors differ; choose Flux vs Leonardo from **unit economics + latency + prompt fidelity** needs, validated on your prompts.
- **Add five complementary `@cf` models** (see §4) to cover **code-specialized**, **reasoning**, **cheap MoE**, **vision + long context**, and **safety/guard** paths without overlapping the user’s core list.

---

## 1) Chat models vs “frontier tiers” (codegen & debugging)

### 1.1 How to read this section (honesty guardrails)

1. **Frontier** here means **best-in-class closed chat APIs** (Claude 4.x, Gemini 2.5/3.x, GPT-4.1/5.x families) plus **flagship hosted** Kimi/GLM APIs — not only open weights.
2. **Coding** benchmarks in the wild (SWE-Bench variants, LiveCodeBench, Terminal-Bench) **differ by agent scaffold, tools, and prompts**. A higher number from vendor A is **not strictly comparable** to vendor B unless the harness matches.
3. **Workers AI** may serve **optimized/quantized** deployments; treat public benchmarks as **directional**, then run **your own** tests on landiBUILD-style tasks (TypeScript/React, Workers, D1, wrangler).

### 1.2 Model-by-model: role, strengths, limitations

| Workers AI ID | Role vs frontier tier | Strengths (engineering-relevant) | Limitations / risks |
| --- | --- | --- | --- |
| `@cf/moonshotai/kimi-k2.5` | **Open multimodal agent class**; Moonshot positions vs GPT-5.2 / Claude 4.5 Opus / Gemini 3 Pro in their blog table. | **256k context** (per Cloudflare model page), **tool calling**, **vision**, **structured outputs** — strong fit for **long-horizon** codegen and **UI-grounded** tasks if the hosted endpoint matches your quality bar. Moonshot reports **SWE-Bench Verified 76.8** under their setup (`citation.yaml`: `moonshot-kimi-k25-blog`). | Blog **footnote 5**: SWE-Bench series used an **internally developed** evaluation framework — scores are **not** automatically comparable to other SWE leaderboards. Blog also recommends official API for repro and cites **KVV** for third-party providers — relevant for **non-Moonshot** hosts including Workers AI. **Output pricing** is high on Workers AI ($3/M output tokens per `citation.yaml`: `cf-workers-ai-pricing`). |
| `@cf/zai-org/glm-4.7-flash` | **Efficiency / high-volume** tier relative to largest closed models; Z.ai positions as strong in-class **30B-A3B MoE**. | **Low input cost** ($0.06/M input on Workers AI), **131k context** (model page), **function calling** — good **default router** for linter fixes, small patches, summarization, and **preflight** triage before escalating. Model card reports **SWE-bench Verified 59.2**, **LCB v6 64.0** (`citation.yaml`: `hf-glm-47-flash`). | Not a substitute **by benchmark alone** for hardest multi-file refactors vs top closed models; vendor table compares to **GPT-OSS-20B** and **Qwen3-30B** — not to Claude/Gemini flagship SKUs. |
| `@cf/openai/gpt-oss-120b` | **Open-weight generalist** with strong reasoning narrative from OpenAI; NVIDIA’s table shows **mixed coding leaderboard** vs Nemotron. | **Function calling + reasoning** (Cloudflare model page). NVIDIA model card: **LiveCodeBench (v5) 88.00** vs Nemotron **81.19** — suggests **strong algorithmic/live coding** under their harness (`citation.yaml`: `nvidia-nemotron3-super-modelcard`). Good candidate when you want **OpenAI-trained inductive biases** without OpenAI API. | Same NVIDIA table: **SWE-Bench (OpenHands) 41.9** vs Nemotron **60.47** — **repo-issue fixing** may lag **other** open heavyweights **in that harness**. Do not overfit to one row. |
| `@cf/nvidia/nemotron-3-120b-a12b` | **Long-context agentic** open model (NVIDIA claims **up to 1M** context on model card). | Positioned for **agentic workflows**, **tool use**, **RAG** at long span. NVIDIA reports **SWE-Bench (OpenHands) 60.47** vs **41.9** for GPT-OSS-120B (`citation.yaml`: `nvidia-nemotron3-super-modelcard`). Attractive for **large codebase context** *if* Workers AI exposes sufficient practical context for your binding and latency budget. | **Higher $/token** than GLM-4.7-flash and gpt-oss-120b on Workers AI (`citation.yaml`: `cf-workers-ai-pricing`). LiveCodeBench row **lower** than GPT-OSS-120B in NVIDIA table — **not** “dominates on all coding metrics.” |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | **Mid-size multimodal** (vision + text) vs **frontier** closed vision models. | MoE **17B** with **vision**, **function calling** (Cloudflare model page). Useful for **screenshot-assisted** debugging, UI reproduction, and **lighter** codegen where latency/cost matter. Meta’s public Llama 4 materials cite **LiveCodeBench** figures for Scout **below** larger Llama 4 variants (`citation.yaml`: `meta-llama4`) — aligns with “smaller sibling” positioning. | **Not** the automatic choice for hardest backend refactors vs largest text-only open or closed models; vision adds **payload and complexity** in your Worker API. |

### 1.3 Practical routing suggestions (codegen vs debugger)

- **Codegen (greenfield files, CRUD, tests):** start with **`glm-4.7-flash`** for volume; escalate to **`gpt-oss-120b`** or **`nemotron-3-120b-a12b`** when tasks need **long context** or **agentic** tool loops; use **`kimi-k2.5`** when **vision + long context + tool richness** is worth the **output token cost**.
- **Debugger (logs, stack traces, small diffs):** same ladder, but bias toward **cheaper models** first; reserve **`kimi-k2.5`** / **`llama-4-scout`** when the bug is **UI/visual** or needs **screenshot reasoning**.
- **When frontier closed APIs still win:** highest-stakes security reviews, **guaranteed** compliance with a specific vendor, **features** absent from `@cf` bindings, or when your eval shows closed models **consistently** reduce rework on your codebase.

---

## 2) Workers AI + AI Gateway vs BYOK / direct provider (Vite + Worker)

### 2.1 Architecture pattern

Typical **Vite** frontend talks to your **Worker** (REST or RPC). The Worker holds **secrets** and calls upstream AI. That aligns with Cloudflare’s **server-side** inference and avoids exposing provider keys in the browser.

### 2.2 Prefer Workers AI (often with AI Gateway) when

- You want **one invoice** and **Neuron/token pricing** from Cloudflare’s table (`citation.yaml`: `cf-workers-ai-pricing`) without maintaining separate provider accounts for `@cf` models.
- You need **AI Gateway** features: **dashboard analytics**, **rate limiting**, and **caching** for **identical** requests (`citation.yaml`: `cf-ai-gateway-pricing`, `cf-ai-gateway-caching`).
- You will route Worker AI calls through Gateway URLs or bindings as documented (`citation.yaml`: `cf-ai-gateway-workers-ai-provider`) — including **`skipCache` / `cacheTtl`** on `env.AI.run`.
- Your workload has **repeatable prompts** (docs snippets, canned explanations, deterministic system prompts) where cache **hits** reduce cost/latency. **Chatty, unique** threads benefit **less** (docs: identical-request semantics; semantic cache **planned**, not current).

### 2.3 Prefer BYOK / direct provider when

- You require **specific closed models** or **provider features** not mirrored on Workers AI.
- You already have **enterprise agreements**, **VPC/private** routes, or **audit** requirements tied to a given vendor.
- You need **maximum transparency** for debugging model behavior against **that vendor’s** documented baseline (Moonshot explicitly flags third-party variance — see `citation.yaml`: `moonshot-kimi-k25-blog`).
- **Cost optimization** is **non-obvious**: compare **your** measured tokens + cache hit rate vs direct API pricing; Cloudflare docs reviewed here do **not** assert universal cheapest path for every model.

### 2.4 Hybrid (common in production)

- **Workers AI** for **default** and **high-volume** tiers; **AI Gateway passthrough** (BYOK) for **premium** or **fallback** models.
- **Gateway** still adds **observability** and **guardrails** even when the upstream is not Workers AI.

---

## 3) Image path: Flux vs Leonardo on Workers AI vs OpenAI image APIs

### 3.1 Workers AI: Flux vs Leonardo (integration + economics)

From **Workers AI pricing** (`citation.yaml`: `cf-workers-ai-pricing`):

- **`@cf/black-forest-labs/flux-2-klein-9b`:** priced per **first megapixel (1024×1024)**, **subsequent MP**, and **input image MP** — aligned with **fast distilled** FLUX.2 Klein positioning (`citation.yaml`: `cf-model-flux2-klein-9b`).
- **`@cf/leonardo/lucid-origin`:** priced per **512×512 tile** and **step** — different **unit step function**; typically **more expensive per heavy generation** than tiny FLUX schnell-style runs but may win on **prompt adherence** for marketing/product shots (`citation.yaml`: `cf-model-lucid-origin`).

**Integration implications:**

- You will implement **model-specific** request bodies and **size/step** parameters against Workers AI **run** APIs, not a single OpenAI-shaped `images/generations` payload (unless you wrap them yourself).
- **AI Gateway caching** can apply to **image** responses but only for **identical** requests (`citation.yaml`: `cf-ai-gateway-caching`) — rare for creative prompts; more useful for **templated** thumbnails or fixed marketing assets.
- **Partner** models may have **capability** nuances (editing, reference images, safety filters) — verify on each model page in the Workers AI catalog (`citation.yaml`: `cf-workers-ai-models`).

### 3.2 vs typical OpenAI image APIs

OpenAI’s **Images API** (`/v1/images/generations`, edits, variations) is **standardized** across DALL·E / GPT-image SKUs with **vendor-specific** parameters and **billing per image / quality / size** (`citation.yaml`: `openai-images-api`).

| Dimension | Workers AI (Flux / Leonardo `@cf`) | OpenAI Images API |
| --- | --- | --- |
| **Request schema** | Workers AI native / bindings; Gateway wraps URL | OpenAI JSON + auth |
| **Pricing mental model** | Neurons; **tiles/MP/steps** | Per-image tiers on OpenAI price list |
| **Ecosystem** | Fits **Worker** + **AI** binding + optional Gateway | Fits **Node** clients, huge example corpus |
| **When to choose** | Tight Cloudflare coupling, single-vendor spend, `@cf` SLAs | You need **OpenAI-specific** image SKUs or existing OpenAI-centric toolchain |

**Practical recommendation:** prototype **both** on a **fixed prompt set** (product UI, icon, hero, screenshot edit) and compare **quality, latency, and $/image** using your actual Worker payloads — avoid choosing from spec sheets alone.

---

## 4) Additional `@cf` models worth adding (beyond the user list)

Rationale: cover **specialists** and **adjacent tasks** the six-model set can miss.

| Model | Why add it | Doc link |
| --- | --- | --- |
| `@cf/qwen2.5-coder-32b-instruct` | **Code-specialized** Qwen; strong **dedicated codegen** baseline when general chat models over-generate prose. Listed with **LoRA** in catalog. | https://developers.cloudflare.com/workers-ai/models/qwen2.5-coder-32b-instruct/ |
| `@cf/deepseek-r1-distill-qwen-32b` | **Reasoning-first** behavior for **hard bugs**, race conditions, and multi-step root-cause analysis; trades cost vs smaller instruct models. | https://developers.cloudflare.com/workers-ai/models/deepseek-r1-distill-qwen-32b/ |
| `@cf/qwen3-30b-a3b-fp8` | **Very cheap MoE** on Workers AI pricing table — excellent **pre-filter**, **classification**, and **light fix** tier before escalating to 120B-class models. | https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/ |
| `@cf/mistral-small-3.1-24b-instruct` | **Vision + 128k context** — bridges gap when you need **screenshots** but Llama 4 Scout is not the right fit; Mistral’s “small 3.1” is a pragmatic multimodal workhorse in the catalog. | https://developers.cloudflare.com/workers-ai/models/mistral-small-3.1-24b-instruct/ |
| `@cf/meta/llama-guard-3-8b` | **Safety / policy** classification for **prompt and response** moderation layers in a codegen product — complements capability models without using a flagship LLM for gating. | https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b/ |

*Optional image slot:* `@cf/black-forest-labs/flux-2-dev` when you need **higher fidelity / multi-reference** generation vs **Klein** speed (`citation.yaml`: `cf-workers-ai-models`).

---

## 5) Self-review (completeness)

| Request item | Status |
| --- | --- |
| §1 Chat model comparison vs frontier tiers with benchmarks + caveats | **Done** — citations to Moonshot blog, HF GLM card, NVIDIA Nemotron card; harness limitations explicit. |
| §2 Workers AI + Gateway vs BYOK for Vite+Worker | **Done** — ties to official pricing, caching, Workers AI provider doc. |
| §3 Image: Flux vs Leonardo vs OpenAI APIs | **Done** — pricing units + integration differences; no aesthetic overclaim. |
| §4 Five extra `@cf` models | **Done** — all IDs exist in Workers AI catalog / pricing index. |
| Deliverables: `analysis.md`, `chain-of-thought.md`, `citation.yaml` | **Done** |

**Known gaps (acceptable):** Workers AI does not publish side-by-side **latency SLAs** vs direct OpenAI on identical prompts; any latency story should be **measured** per account/region. Closed frontier SKUs will **outpace** static benchmark tables — **re-evaluate quarterly**.
