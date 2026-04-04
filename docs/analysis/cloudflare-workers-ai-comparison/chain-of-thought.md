# Chain of thought — Cloudflare Workers AI comparative analysis

**Role:** research-analyst subagent. **Date:** 2026-04-04. **Output folder:** `docs/analysis/cloudflare-workers-ai-comparison/`.

## Objectives (from request)

1. Compare listed `@cf` chat models to “frontier tier” families (GLM-4.x, Gemini, Claude, Kimi) for **code generation** and **debugging**, with honest benchmarking discipline.
2. Decision frame: **Workers AI + AI Gateway** vs **BYOK / direct provider** in a **Vite + Worker** architecture.
3. **Image:** Flux vs Leonardo on Workers AI vs typical OpenAI image APIs — integration implications.
4. Suggest **3–5 additional `@cf` models** beyond the user’s list, with rationale and documentation links.

## Method

1. **Anchor on authoritative Cloudflare docs** for pricing, gateway behavior, and integration paths (`citation.yaml` ids `cf-*`).
2. **Triangulate model claims** using primary vendor artifacts:
   - Hugging Face model card for GLM-4.7-Flash (benchmark table in README).
   - NVIDIA Build model card for Nemotron 3 Super (tabular comparison vs GPT-OSS-120B and Qwen3.5-122B).
   - Moonshot Kimi K2.5 blog (large comparison table + explicit footnote that SWE-Bench series used an **internal** evaluation framework).
3. **Avoid overclaiming:**
   - Do not equate “higher SWE-Bench number” across different harnesses or evaluation stacks without stating the mismatch.
   - Note that **Workers AI hosted inference** may not reproduce every digit of a vendor’s self-hosted eval.
   - Surface Moonshot’s **Kimi Vendor Verifier (KVV)** note for third-party hosting — relevant because Workers AI is a third-party route to the weights.
4. **Product/engineering lens:** prioritize routing guidance (cost, latency, observability, secret handling, cache fit) over model fan rankings.

## Key tensions resolved in synthesis

| Tension | Resolution |
| --- | --- |
| Nemotron vs GPT-OSS “who codes better” | NVIDIA’s own table shows **tradeoffs**: higher SWE-Bench (OpenHands) for Nemotron vs **higher LiveCodeBench (v5)** for GPT-OSS-120B. Report both; recommend **internal A/B** on real repo tasks. |
| Kimi K2.5 vs closed frontiers | Blog table places Kimi **close but not uniformly above** GPT-5.2 / Claude / Gemini on coding rows; SWE eval is **non-standard harness** per footnote — label as vendor-reported. |
| GLM-4.7-Flash “frontier” | Strong **efficiency tier** story (MoE, long context per CF model page); self-reported SWE-bench Verified **59.2** — useful default for volume, not automatic replacement for largest closed models on hardest tickets. |
| Image: Flux vs Leonardo pricing | Workers AI **pricing table** shows very different unit economics (FLUX Klein 9B MP-based vs Leonardo tile/step). Lead with **cost model + API shape**, not aesthetic claims. |

## Deliberate omissions

- No single “winner” model for all of codegen, debugger, and image — the request asked for **comparative** analysis, not a leaderboard pronouncement.
- No dependency on unverified blog posts for primary benchmark numbers where a model card or official doc exists.

## Completeness self-check (pre-submit)

- [x] All four requested sections present in `analysis.md`.
- [x] `citation.yaml` lists Cloudflare pages user supplied + primary model sources.
- [x] Benchmarks labeled with **source + harness caveat** where non-obvious.
- [x] Additional `@cf` models drawn from **current** Workers AI catalog (pricing/models index), not hallucinated IDs.
