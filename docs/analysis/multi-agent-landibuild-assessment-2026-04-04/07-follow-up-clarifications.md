# Follow-up clarifications (2026-04-04)

**← [Back to index](./00-coordinator-verification-gap-analysis-and-index.md)**

This file answers questions raised after the initial multi-agent assessment: BYOK vs Cloudflare docs, what “deep research” exists **in this repo**, CopilotKit difficulty, Workers AI vs AI Gateway (plain English), and the **Gemini Live + multi-agent site build** concept without focusing on Kotlin.

---

## 1. Why the index did not link files before

The first pass used plain filenames in tables instead of **relative markdown links** (`[label](./file.md)`). That was an oversight. The index file [00](./00-coordinator-verification-gap-analysis-and-index.md) now has a **Navigate this folder** section and linked rows.

**Sibling reports:** each of [01](./01-research-analyst-report.md)–[06](./06-context-manager-report.md) includes a back-link to the index at the top.

---

## 2. BYOK and Cloudflare AI Gateway — provider key vs Cloudflare token

**Yes.** On AI Gateway, the **upstream provider** (OpenAI, etc.) is typically authenticated with the **normal `Authorization: Bearer <PROVIDER_API_KEY>`** header. When **Authenticated Gateway** is enabled on the gateway, Cloudflare additionally expects **`cf-aig-authorization: Bearer <CF_AIG_TOKEN>`** so only your account can use that gateway instance.

Official documentation (Cloudflare):

- **Authenticated Gateway** — describes both headers and shows OpenAI example with `OPENAI_TOKEN` + `CF_AIG_TOKEN`:  
  [https://developers.cloudflare.com/ai-gateway/configuration/authentication/](https://developers.cloudflare.com/ai-gateway/configuration/authentication/)

Example from that page (conceptually):

- `Authorization: Bearer OPENAI_TOKEN` — **provider’s** API key (your BYOK).
- `cf-aig-authorization: Bearer {CF_AIG_TOKEN}` — **Cloudflare AI Gateway** run token (when authenticated gateway is on).

**Worker binding note (same page):** if you use the **`env.AI.gateway(...)`** binding from a Worker, you often **do not** need to manually add `cf-aig-authorization` — binding requests are pre-authenticated to your account.

**How landibuild aligns:** `worker/agents/inferutils/core.ts` builds an OpenAI SDK client with `apiKey` as the provider key (or gateway token fallback) and, when the gateway token differs from the provider key, sets `defaultHeaders['cf-aig-authorization']` — the same “wholesaling” pattern as the docs. See [04-ai-engineer-report.md](./04-ai-engineer-report.md).

**Why the UI still felt “blocked”:** that is **application** wiring: `getUserProviderStatus` in `worker/api/controllers/modelConfig/byokHelper.ts` currently returns `hasValidKey: false` for every provider, and `getApiKey` does not load per-user secrets from D1/vault by `userId`. Cloudflare **allows** BYOK through the gateway; **this repo** does not fully expose persisted user keys in settings + inference yet.

---

## 3. “Deep research” — what exists **in landibuild** vs elsewhere

**Scoped to this repository** (`landibuild`):

- **No** dedicated HTTP route under `worker/api/routes/` was found for “deep research” (grep for `research` / `deep` in routes).
- **UI:** sidebar “Deep Research” calls `navigate('/?mode=research')`, but `ProjectType` in `worker/agents/core/types.ts` does **not** include `research`, so the mode is not type-aligned end-to-end.
- **Agent-side research-like capability:** the **`web_search`** tool (`worker/agents/tools/toolkit/web-search.ts`) uses **SerpAPI** (Google results) when configured — that is **not** the same as a full “deep research” pipeline (planning, multi-step retrieval, citations store, etc.).

If you already have a **deep research HTTP endpoint** in **landing-editor**, **landi-ai-orchestrator**, or another service, it was **outside the scope** of the original repo-only grep. Integrating it here is usually:

- Add **`POST /api/research/...`** (or similar) on the Worker that **proxies** to that service with auth, **or**
- Call the external API from the **agent** as a new tool.

**How hard: new prompt type + workflow + “interviewer” agent for deep search?**

Roughly:

| Piece | Effort | Notes |
|-------|--------|--------|
| New **`ProjectType`** / route (e.g. `research`) + fix sidebar | **S** | Types, `home.tsx`, `stateMigration`, capabilities |
| New **system prompt** + template branch (like other project types) | **M** | `prompts.ts`, `templateSelector`, feature module under `src/features/` if you want a distinct shell |
| **Sub-agent or phase** that only asks clarifying questions | **M** | New “planning” behavior: either a small loop in `UserConversationProcessor` / dedicated operation, or a second agent state; must define stop condition + handoff to “execute research” |
| **Call existing deep-research API** (if off Worker) | **S–M** | Env secret, `fetch` from Worker, map request/response; handle timeouts (Workers limits) |
| **Persist jobs + citations + UI** | **L** | D1 schema, polling or streaming, new React route |

So: **prompt + question-asking agent** is **medium** in this codebase because the agent/tool/plumbing already exists; **product-quality deep research** with storage and UI is **larger**.

---

## 4. CopilotKit — why “non-trivial” and what you would do

**Facts:**

- Landibuild has **no** `CopilotKit` / `copilotkit` dependency today.
- CopilotKit’s documented **self-hosted runtime** is built around **Node.js** handlers (`copilotRuntimeNextJSAppRouterEndpoint`, Express, raw `http`, NestJS). See the upstream snippet referenced in [02-search-specialist-report.md](./02-search-specialist-report.md) and [CopilotKit docs](https://docs.copilotkit.ai/).

**Why that clashes with Cloudflare Workers:**

1. **API surface:** Workers expose a **`fetch(Request) => Response`** model, not Node’s `IncomingMessage` / `ServerResponse`. The runtime package expects Node-style adapters unless you wrap it.
2. **Streaming:** CopilotKit assumes long-lived **SSE/streaming** responses. Workers *can* stream, but you must ensure your adapter forwards the stream correctly and stays within **CPU/time limits**.
3. **`nodejs_compat`:** Landibuild enables it, but many npm packages still assume a full Node runtime (filesystem, some `http` internals). **Compatibility is prove-by-spiking**, not guaranteed.
4. **Auth / CSRF:** Landibuild’s Hono stack uses cookies + CSRF for APIs. CopilotKit’s `runtimeUrl` must sit behind the same rules or use a deliberate bypass + CORS strategy.

**Practical paths:**

- **A. Node sidecar** — Run `@copilotkit/runtime` on a small Node host (Fly, Railway, Cloud Run) at `/copilotkit`; Worker or Vite proxies to it. **Fastest** to “official” behavior.
- **B. Worker adapter** — Implement a thin `fetch` handler that translates Worker `Request` into whatever the runtime expects (if the runtime exposes a low-level API); **high engineering** risk.
- **C. Don’t use CopilotKit** — Keep the current custom WebSocket + NDJSON agent UX; only borrow **UX patterns** from CopilotKit docs.

---

## 5. Workers AI vs AI Gateway — plain English (what the earlier note meant)

Sorry for the confusion. Two different Cloudflare products:

| Name | What it is | Billing / “credits” mental model |
|------|------------|-----------------------------------|
| **AI Gateway** | A **proxy** in front of **external** APIs (OpenAI, Anthropic, Google AI Studio, etc.). Unified URL, logging, caching, rate limits. | You still pay **OpenAI/Google/etc.** for tokens. Cloudflare may charge for **extra** gateway features (e.g. log push at scale)—see [AI Gateway pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/). |
| **Workers AI** | Cloudflare runs **certain models** **on their stack** via the **`AI` binding** (e.g. `env.AI.run(...)`). | Billed in **Neurons** (Workers AI pricing), **not** the same as “OpenAI credits.” |

**What landibuild does today:** it uses `env.AI` mainly to call **`env.AI.gateway(...).getUrl()`** to get the **AI Gateway base URL**, then uses the **OpenAI SDK** over HTTP. It does **not** use **`env.AI.run`** for chat completions.

So: **“low AI Gateway credits”** is ambiguous. If you mean **low balance on OpenAI/Google**, that’s the **provider**, not “AI Gateway credits.” If you mean **Cloudflare billing**, read the two pricing pages above separately.

**If the goal is cheaper inference:** Workers AI **free daily Neurons** can help for **supported models**, but you must **implement a second code path** (different model IDs, streaming shape, tools support) — it is not a drop-in replacement for your current OpenAI-SDK-through-gateway path.

---

## 6. KMP plan — the **concept** (Gemini Live + agents building a site)

Ignoring Kotlin: the **idea** in the unified plan is:

- **Multimodal / live** channel (e.g. **Gemini Live**) for natural voice or continuous session.
- **Orchestration** so that live session **coordinates** with **other agents** (planner, codegen, tools) to **build or update a site** with streaming preview.

**Feasibility in landibuild (concept only):**

- **Multi-agent orchestration:** You already have a **Durable Object** codegen agent, phasic vs agentic behaviors, tools, WebSockets — a **second** “conductor” or “interviewer” loop can be added in the Worker or delegated to `landi-ai-orchestrator`.
- **Gemini Live:** Browsers should not hold **raw API keys**. You typically add a **Worker WebSocket proxy** that authenticates the user, attaches server-side credentials, and forwards audio/events to Google’s Live API — same security model as the plan’s “proxy” language.
- **“Works with other agents”:** Define a **state machine**: Live session → extracted intent → `POST /api/agent` or internal `initialize()` with structured args → existing codegen pipeline. Effort is **integration + UX**, not the programming language of the client.

So the **concept** maps cleanly to **React + Worker**; the KMP document is one **possible** client stack, not the only way to get Live + multi-agent site building.

---

## Related reports

- [04-ai-engineer-report.md](./04-ai-engineer-report.md) — `cf-aig-authorization`, `getApiKey`, gateway URL construction  
- [02-search-specialist-report.md](./02-search-specialist-report.md) — Workers AI vs Gateway, CopilotKit pointers  
- [05-refactoring-specialist-report.md](./05-refactoring-specialist-report.md) — routes, `ProjectType`, tool lists  
