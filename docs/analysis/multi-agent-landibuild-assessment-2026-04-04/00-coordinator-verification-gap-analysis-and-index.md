# Multi-agent assessment: coordinator verification, gap analysis, and index

**Workspace:** `c:\Users\mikeh\Projects\landi\landibuild`  
**Date:** 2026-04-04  
**Orchestration:** Subagents executed: `research-analyst`, `search-specialist`, `architect-reviewer`, `ai-engineer`, `refactoring-specialist`, `context-manager`. This document is the **coordinator’s independent verification**; subagent self-reviews were **not** treated as sufficient.

---

## Navigate this folder (markdown links)

| Doc | Link |
|-----|------|
| **This index** | [00-coordinator-verification-gap-analysis-and-index.md](./00-coordinator-verification-gap-analysis-and-index.md) |
| Research analyst | [01-research-analyst-report.md](./01-research-analyst-report.md) |
| Search specialist | [02-search-specialist-report.md](./02-search-specialist-report.md) |
| Architect reviewer | [03-architect-reviewer-report.md](./03-architect-reviewer-report.md) |
| AI engineer | [04-ai-engineer-report.md](./04-ai-engineer-report.md) |
| Refactoring specialist | [05-refactoring-specialist-report.md](./05-refactoring-specialist-report.md) |
| Context manager | [06-context-manager-report.md](./06-context-manager-report.md) |
| **Follow-up clarifications** (BYOK docs, deep research scope, CopilotKit, Workers AI, Gemini Live concept) | [07-follow-up-clarifications.md](./07-follow-up-clarifications.md) |

---

## Index of deliverables (full text, untruncated)

| Document | Contents |
|----------|----------|
| [01-research-analyst-report.md](./01-research-analyst-report.md) | Architecture, structure, routing, bindings, agents, inferutils, auth, UI tabs/features |
| [02-search-specialist-report.md](./02-search-specialist-report.md) | AI Gateway decoupling (docs + repo), Workers AI vs Gateway, CopilotKit + Vite/Worker |
| [03-architect-reviewer-report.md](./03-architect-reviewer-report.md) | UI/worker separation, shell reuse, routes/modes, CF lock-in, KMP comparison |
| [04-ai-engineer-report.md](./04-ai-engineer-report.md) | Gateway URL, headers, BYOK/runtime overrides, replacing gateway, Workers AI path |
| [05-refactoring-specialist-report.md](./05-refactoring-specialist-report.md) | New orchestrations, tabs, deep research, gating, complexity, dependency chains |
| [06-context-manager-report.md](./06-context-manager-report.md) | KMP unified plan vs landibuild; orchestrator role; agency/extensions context |

---

## User questions → where answered

| Question | Primary sources | Coordinator notes |
|----------|-----------------|-------------------|
| How is the app **architected**? | [01](./01-research-analyst-report.md), [03](./03-architect-reviewer-report.md), [04](./04-ai-engineer-report.md) | Worker entry + hostname routing + Hono API + DO agent + Vite SPA is consistent across agents. |
| How is it **structured**? | [01](./01-research-analyst-report.md), [03](./03-architect-reviewer-report.md) | `src/` SPA, `worker/` monolith, `shared/` minimal; `src/api-types.ts` re-exports worker types. |
| How hard to **separate from Cloudflare AI Gateway**? | [02](./02-search-specialist-report.md), [04](./04-ai-engineer-report.md) | **Medium-low** single-tenant (env `CLOUDFLARE_AI_GATEWAY_URL`, `directOverride`, custom base URL); **medium** multi-tenant. Code touchpoints are concentrated in `worker/agents/inferutils/core.ts` and proxy. |
| How hard **user BYOK** (UI seems blocked)? | [04](./04-ai-engineer-report.md), [05](./05-refactoring-specialist-report.md), [07](./07-follow-up-clarifications.md) | **Cloudflare’s model:** gateway auth + **vendor key** are separate headers (`cf-aig-authorization` vs `Authorization`)—see [07](./07-follow-up-clarifications.md) for doc links. **This app:** `getUserProviderStatus` stub + `getApiKey` ignores `userId`; session `credentials` path still works. |
| **Orchestrations/workflows, new tabs** (deep research, landing-editor-style builder, gating web components / agency extensions)? | [01](./01-research-analyst-report.md), [03](./03-architect-reviewer-report.md), [05](./05-refactoring-specialist-report.md), [07](./07-follow-up-clarifications.md) | **Deep research in *this* repo:** no `worker/api/routes/*` HTTP route named for deep research; UI is sidebar → `/?mode=research` (currently mismatched to `ProjectType`). Research-like behavior today is mainly **agent `web_search` tool** (SerpAPI). If your deep-research **HTTP API** lives in **landing-editor** or **landi-ai-orchestrator**, this assessment did not trace that repo—wire via **proxy route** from Worker. See [07](./07-follow-up-clarifications.md). **Site builder chat:** **M** prompt/template/agent paths. **Gating:** **L**. |
| **Reuse UI** as basis for other apps? | [03](./03-architect-reviewer-report.md) | **Low–medium** for shell primitives; **high** to extract a clean package—sidebar is product-specific; `api-types` couples to entire worker. |
| **CopilotKit** tighten-up? | [02](./02-search-specialist-report.md), [07](./07-follow-up-clarifications.md) | **No CopilotKit in repo.** Why it’s hard: Node-centric runtime vs Worker `fetch`—detail in [07](./07-follow-up-clarifications.md). |
| **Workers AI** vs **AI Gateway** | [02](./02-search-specialist-report.md), [04](./04-ai-engineer-report.md), [07](./07-follow-up-clarifications.md) | **Not the same thing.** Plain-English distinction and why the earlier note confused “credits”—[07](./07-follow-up-clarifications.md). |
| **KMP unified plan** (concept: **Gemini Live + multi-agent build**, not Kotlin) | [06](./06-context-manager-report.md), [07](./07-follow-up-clarifications.md), excerpt below | Reframed in [07](./07-follow-up-clarifications.md): voice/live + orchestration **without** KMP. |

---

## Coordinator independent verification (evidence)

Performed in the main session (not delegated):

1. **`ProjectType`** in `worker/agents/core/types.ts` is `'app' | 'workflow' | 'presentation' | 'general'` — **no `research`**.
2. **`app-sidebar.tsx`** navigates to `navigate('/?mode=research')` — **confirmed** mismatch with `ProjectType`.
3. **`byokHelper.ts`** `getUserProviderStatus` returns every template with **`hasValidKey: false`** — **confirmed** stub blocks BYOK-driven model availability in UI logic that depends on this function.

Subagent claims that were **not** independently re-read line-by-line but are **high confidence** from overlapping agents: Hono middleware order, `buildGatewayUrl` priority, `CredentialsPayload` → `runtimeOverrides`, workflow feature missing from `src/features/index.ts`.

---

## Gap analysis on subagent outputs (what was weak or incomplete)

| Agent | Issue | Resolution |
|-------|--------|------------|
| **context-manager** | Only ~300 lines of the KMP plan read (file is ~7500+ lines). | Acceptable for **executive architecture**; full phased migration not reproduced here. Coordinator added plan YAML/overview from main read. |
| **search-specialist** | CopilotKit `/guides/self-hosting` 404 noted. | Left as explicit gap; recommendation remains: prototype runtime on Worker or use Node sidecar. |
| **architect-reviewer** | `api-types.ts` circular import cited; should confirm current file. | **Follow-up:** remove `import { AuthUser } from './api-types'` if still present (architect flagged L5–6). |
| **ai-engineer** | Opening line said “concise” but body is detailed. | No content gap; wording only. |
| **refactoring-specialist** | No `landi-store-extension` in repo (expected). | Gating described as **new policy** work—correct. |

**No mandatory re-dispatch:** Critical blockers (BYOK stub, `research` type mismatch) were verified in-repo. Further subagent rounds would add marginal detail (e.g. every `executeInference` callsite).

---

## KMP plan excerpt (coordinator read, lines 1–~70 of body)

Source: `c:\Users\mikeh\Projects\landi\landing-editor\.cursor\plans\unified_kmp_ai_agent_chat_system_with_dig_mode_f2b04445.plan.md`

- **Product:** `landi-studio-kmp` — Kotlin Multiplatform, Compose Multiplatform, Web (Wasm), Android, Desktop.
- **Modes:** **Build** (site builder; plugin-style build types with prompts, tool whitelists, guards, validation, UI config) and **Dig** (knowledge expansion / research).
- **Stack shift in plan:** Original “Next.js + CopilotKit + Cloudflare AI Gateway” → **KMP + Ktor + AG-UI Kotlin SDK** + **`landi-ai-orchestrator`** (FastAPI) with AG-UI endpoints (`/agent/chat`, `/agent/build`, `/agent/dig`, etc.), LangGraph/LangChain, Supabase auth, Gemini Live proxy.
- **Implication for landibuild:** You can implement **analogous** capabilities (build + research sessions, event streaming, rules/context) **inside** the existing Worker + React stack without adopting KMP; duplicate orchestration should be a **deliberate** product decision.

---

## Definition of Done (coordinator)

| Criterion | Status |
|-----------|--------|
| Multiple subagents used with distinct roles | Met |
| Coordinator gap analysis independent of subagent self-review | Met |
| Critical claims spot-checked in repo | Met (`research`, `ProjectType`, `byokHelper`) |
| Answers mapped to user bullets | Met (table above) |
| Separate full documents, not summarized away | Met (files `01`–`06` contain full subagent markdown) |

---

## Suggested next engineering steps (if product priority)

1. Fix **`/?mode=research`** vs **`ProjectType`** (add `research` end-to-end or remove/replace sidebar entry).
2. Implement real **`getUserProviderStatus`** + wire **`getApiKey`** to per-user secrets (vault/`UserSecretsStore`) if BYOK is a release goal.
3. Align **`workflow`** across `wrangler.jsonc`, `CapabilitiesController`, and `src/features/index.ts` (register module or remove from defaults).
4. For **CopilotKit**: spike `@copilotkit/runtime` behind a Worker `fetch` shim or deploy a small Node runtime for `/api/copilotkit` only.
5. For **Workers AI**: add a provider branch in `infer` that calls `env.AI.run` and normalizes stream shape—keep OpenAI SDK path for everything else.
