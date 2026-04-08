# Landibuild: VibeSDK stack, CopilotKit / AG-UI / A2UI, and target alignment

**Created:** 2026-04-05  
**Scope:** `landibuild` (VibeSDK-derived Workers app).  
**Sources:** In-repo code and plans; CopilotKit monorepo/npm (research pass); Context7 `/copilotkit/copilotkit`; Cloudflare Agents SDK docs (MCP search); internal assessment docs under `docs/analysis/multi-agent-landibuild-assessment-2026-04-04/`.

---

## 1. Outline — what we are doing (brief, complete)

- **Product / UX:** Homepage and sidebar drive **build focus** (landing pages, sites, slides, vibe code, dig) via URL and UI; **Websites** lands in-app with `buildFocus` + copy; **Ask / Auto** and **agentic plan strip** (`ThinkingStageCards`) improve chat clarity; landing flow skips auto `generate_all` and routes blueprint/template selection models through **OpenRouter** where configured.
- **Protocol / architecture (planned):** **Agent Wire v2 (AW2)** — versioned envelope, **channels** (`session`, `conversation`, `workspace`, `catalog`, `vault_signal`), monotonic `seq`, `runId`, **dual-emit** with legacy WebSocket types, client **reducers** instead of a monolithic handler, eventual collapse of **`conversation_response` + `agent_ui_event` duplication**, optional **AW2 → AG-UI** adapter for third-party UI.
- **Integration (planned / contested):** **CopilotKit** is **not** in-tree today; spike is **after** a stable **conversation** channel or **parallel** on landing-only surfaces. **CopilotKit fetch-based runtime** (Workers-capable) exists upstream; **Cloudflare Agents SDK** (`agents` package) is **not** what landibuild uses today — custom **`CodeGeneratorAgent`** Durable Object + **PartySocket**-style client.
- **Quality / ops:** OpenRouter slug verification, Playwright smoke, `buildFocus` docs, optional URL cleanup (`from=websites`), home URL vs dropdown hardening.
- **Honest scope line:** This doc **does not** claim CopilotKit is already shipping for landing in **landibuild**; it maps **intent vs repo** and lists **gaps**.

---

## 2. Tale — now, planned, and how the new plan changes it

**Once upon a line of repo history:** Landibuild inherited **Cloudflare VibeSDK** patterns — a **Durable Object** per chat (**`CodeGeneratorAgent`**), **SQLite** state, **WebSocket** streaming, **sandbox** DO, **git** in SQLite, long **type unions** in `worker/api/websocketTypes.ts`, and a very large **`handle-websocket-message.ts`** on the client. Landing-specific behavior was **bolted on** with **`buildFocus`**, model overrides, and **skip initial generate** — still the **same** agent and wire.

**What we planned (homepage / chat journey plan):** Checklist **A–F** for URLs, sidebar, landing OpenRouter path, Ask/Auto, presentation iframe fix, agentic journey UI, E2E/docs. Checklist **G** added **AW2** as a **first-class** track: spec, negotiation, dual emit, reducers, dedupe streams, AG-UI adapter, workspace channel, sunset legacy.

**How the new plan changes the story:** Execution is no longer “only polish the existing demo UX.” **G** makes **wire protocol and client architecture** explicit deliverables **alongside** homepage/chat items, so CopilotKit (or any AG-UI consumer) can attach to a **defined** event stream instead of forking `conversation_response`. **C7** in the plan file may still say CopilotKit is “not in repo”; **strategic intent** in conversation was **landing creator on CopilotKit** — this doc **reconciles** that by treating **CopilotKit as a target consumer** of **AG-UI-shaped** output, not as the **authority** for Landi’s DO agent unless you **migrate** orchestration into **`@copilotkit/runtime`** + LangGraph (major fork).

---

## 3. CopilotKit / AG-UI ecosystem — capability matrix (exhaustive research pass)

**Legend — columns:**

- **AG-UI role:** How it participates in the AG-UI event/client protocol (agent ↔ UI).
- **A2UI role:** Google-style **declarative** agent-to-UI specs (Lit / middleware).
- **Gen-UI role:** **Generative UI** — tools, HITL, `renderAndWaitForResponse`, frontend tools, custom tool renderers.
- **Landibuild gap:** *None* = could map cleanly; *Partial* = needs adapter or duplicate path; *Missing* = not in repo today.

Research caveat: npm scopes **`@copilotkit/*`** vs **`@copilotkitnext/*`**, legacy **`@copilotkit/backend`**, **`@copilotkit/cloud`**, and doc URLs that **404** on fetch — **pin versions** and verify exports from **`dist`** for your chosen release.

| Capability / artifact | Layer | AG-UI role | A2UI role | Gen-UI role | Landibuild gap |
|------------------------|-------|------------|-----------|-------------|----------------|
| `@ag-ui/core` | Protocol | Types, event schemas | Indirect (middleware bridges) | Tool/message models | Missing — adopt if standardizing on AG-UI |
| `@ag-ui/proto` | Protocol | Binary encoding of AG-UI events | — | — | Missing |
| `@ag-ui/encoder` | Protocol | Event encoding helpers | — | — | Missing |
| `@ag-ui/client` | Client | Browser/client AG-UI consumer | — | — | Missing |
| `@ag-ui/langgraph` | Adapter | Run LangGraph as AG-UI server | — | HITL via graph interrupts | Missing — optional if moving graphs to LangGraph |
| `@ag-ui/mastra` | Adapter | Mastra ↔ AG-UI | — | — | Missing |
| `@ag-ui/crewai` | Adapter | CrewAI ↔ AG-UI | — | — | Missing |
| `@ag-ui/langchain` | Adapter | LangChain ↔ AG-UI | — | — | Missing |
| `@ag-ui/llamaindex` | Adapter | LlamaIndex ↔ AG-UI | — | — | Missing |
| `@ag-ui/spring-ai` | Adapter | Spring AI ↔ AG-UI | — | — | Missing |
| `@ag-ui/pydantic-ai` | Adapter | Pydantic AI ↔ AG-UI | — | — | Missing |
| `@ag-ui/agno` | Adapter | Agno ↔ AG-UI | — | — | Missing |
| `@ag-ui/ag2` | Adapter | AG2 / AutoGen-style ↔ AG-UI | — | — | Missing |
| `@ag-ui/a2ui-middleware` | Server | Bridges AG-UI ↔ A2UI stream | **Primary** server path for declarative UI | — | Missing |
| `@ag-ui/mcp-apps-middleware` | Server | MCP “Apps” / open JSON UI | — | **Primary** for MCP-driven UI | Missing |
| `@ag-ui/a2a` | Protocol bridge | Agent-to-agent ↔ AG-UI | — | — | Missing |
| `@ag-ui/a2a-middleware` | Server | A2A forwarding patterns | — | — | Missing |
| `create-ag-ui-app` | Tooling | Scaffold AG-UI apps | — | — | Missing |
| `@copilotkit/runtime` | Runtime | GraphQL Yoga API, AG-UI backends, streaming | Hosts A2UI middleware | Hosts Gen-UI + MCP Apps | **Missing** — not deployed in landibuild |
| `@copilotkit/runtime` `./v2/node` `./v2/express` `./v2/hono` | Runtime | Fetch/HTTP adapters for self-host | Same | Same | **Gap:** integrate with Worker `fetch` or sidecar |
| `@copilotkit/runtime` `./langgraph` | Runtime | LangGraph entry | — | Interrupt/HITL | Missing |
| `@copilotkit/runtime-client-gql` | Client | urql client to runtime | — | — | Missing |
| `@copilotkit/shared` | Lib | Shared types, license verifier | Uses `@ag-ui/client` | — | Missing |
| `@copilotkit/core` | Lib | “CopilotKit2” web utils, Zod↔JSON schema | AG-UI client deps | — | Missing |
| `@copilotkit/react-core` | React | `CopilotKit` provider, `useAgent`, `useCopilotChat`, contexts | Via `@ag-ui/client` | `useCopilotAction`, HITL hooks | Missing — entire UI is custom |
| `@copilotkit/react-core/v2` | React | Headless `useAgent` + `useCopilotKit`, tool renderers | **Primary** v2 path | A2UI helpers re-exported | Missing |
| `useAgent` | Hook | Messages, state, `isRunning`, `setState` | — | Co-agent UI binding | **Partial** — landibuild has agent state via WS restore, not AG-UI agent object |
| `useCopilotKit` | Hook | `runAgent`, runtime wiring | — | — | Missing |
| `useCopilotChat` | Hook | Imperative chat API | — | Suggestions, tools | **Partial** — custom chat + WS |
| `useCopilotChatHeadless_c` | Hook | Headless chat (API stability: verify `_c`) | — | — | Missing |
| `useCopilotAction` | Hook | Agent-invokable actions + **render** | — | **Core Gen-UI** | **Partial** — tools exist server-side; no CK action render |
| `useCoAgent` / `useCoAgentStateRender` | Hook | Render from agent state snapshots | State sync surface | **Gen-UI** | **Partial** — `projectStages` / `ThinkingStageCards` are manual |
| `useCopilotReadable` / document readable | Hook | Expose app context to agent | Context channel | — | **Partial** — context embedded in prompts / state, not CK readables |
| `useLangGraphInterrupt` | Hook | HITL for LangGraph | Interrupt events | **HITL** | Missing |
| `useHumanInTheLoop` | Hook | Generic HITL | — | **HITL** | Missing |
| `useRenderToolCall` / `useDefaultTool` / `useLazyToolRenderer` | Hook | Tool call UI | Tool messages | **Gen-UI** | **Partial** — tool rows in `conversation_response` |
| `useCopilotChatSuggestions` | Hook | Suggested prompts | — | **Gen-UI** | Missing |
| `useFrontendTool` | Hook | Frontend-executed tools | — | **Gen-UI** | Missing |
| `useCopilotAdditionalInstructions` | Hook | Extra system text | — | — | **Partial** — server prompts |
| `useCopilotAuthenticatedAction_c` | Hook | Auth-gated actions | — | — | Missing (verify docs) |
| `createA2UIMessageRenderer` / `A2UITheme` | API | — | **A2UI** message rendering | — | Missing |
| `@copilotkit/a2ui-renderer` | React | — | **Renders A2UI via `@a2ui/lit`** | — | Missing |
| `@copilotkit/react-ui` | UI | Chat/sidebar/popup chrome | — | Markdown, suggestions list | Missing |
| `CopilotChat` / `CopilotSidebar` / `CopilotPopup` | Component | Prebuilt surfaces | — | **Gen-UI** host | Missing |
| `@copilotkit/react-textarea` | UI | Rich textarea (Slate/MUI/Radix) | — | Inline assist | **Partial** — custom `chat-input` |
| `@copilotkit/voice` | Add-on | Voice / TTS / STT paths | — | — | Missing |
| `@copilotkit/web-inspector` | DevX | Debug widget | — | — | Missing |
| `@copilotkit/sdk-js` (+ langgraph/langchain subpaths) | SDK | Agent helpers | — | — | Missing |
| `@copilotkit/sqlite-runner` | Runtime | SQLite-backed runner (CK2) | — | — | **Note:** landibuild already has DO SQLite — different product |
| MCP via `@modelcontextprotocol/sdk` + `@ai-sdk/mcp` | Runtime | Tools from MCP servers | — | MCP Apps middleware | **Partial** — custom tools, not MCP Apps |
| Copilot Cloud (hosted) | SaaS | Hosted runtime / keys / connectors | — | — | Missing |
| **Vercel AI SDK + `@ai-sdk/*` inside runtime** | Runtime | Multi-model routing | — | Streaming | **Partial** — landibuild uses custom `inferutils` + OpenRouter |
| **Google ADK** | — | No dedicated `@ag-ui/*` package found in research pass | — | — | **Gap** — verify if via Google AI SDK only |

**Gen-UI “specs” triad (CopilotKit docs positioning):** **AG-UI** (event stream), **A2UI** (declarative UI tree), **Open JSON / MCP Apps** (open-ended UI from MCP). Landibuild today is closest to **ad hoc AG-UI-like** (`agent_ui_event`) without full protocol compliance.

---

## 4. Research methodology (for audit trail)

- **Subagent (generalPurpose):** Enumerated npm packages, `react-core` / `react-ui` / `runtime` barrels, integrations, Cloud vs self-hosted, legacy packages, doc 404s.
- **MCP Context7:** Queried `/copilotkit/copilotkit` for `useAgent`, headless v2, `useCopilotAction` / `renderAndWaitForResponse`, tool rendering.
- **MCP Cloudflare docs search:** Confirmed **Agents SDK** = `Agent` extends **partyserver `Server`** extends **Durable Object**; WebSocket + `@callable` RPC; client **`useAgent`** from `agents/react` — **distinct** from landibuild’s custom DO class.
- **Repo grep:** No `@cloudflare/agents` / `from "agents"` in application code path for codegen agent; **Durable Objects** used: `CodeGeneratorAgent`, `UserAppSandboxService`, `UserSecretsStore`, `DORateLimitStore`.

---

## 5. Incrementalism vs “rip the demo” + what is *not* special sauce

**On “don’t do too much at once”:** For a **production** Landi line, parallel **(a)** user-visible fixes and **(b)** **AW2 + optional CopilotKit** is still sane — but **you are correct** that treating VibeSDK as an **immutable cathedral** is wrong if the **protocol and UI glue** are the pain. Swapping **presentation** of chat for **CopilotKit components** while keeping the **same DO** is a **medium** change; swapping **orchestration** into **LangGraph + `@copilotkit/runtime`** is **large**.

**What is easily reproducible *without* hand-rolling (industry / OSS):**

| Area | “Buy” / reuse | Landibuild today |
|------|----------------|------------------|
| **Agent UI protocol + chat chrome** | CopilotKit React + AG-UI client, or assistant-ui | Custom WS handler + components |
| **Tool + HITL generative UI** | `useCopilotAction` + `renderAndWaitForResponse`, LangGraph interrupt | Custom `conversation_response.tool` + pending inputs |
| **Declarative generative panels** | A2UI renderer + middleware | `artifact_preview` / custom |
| **MCP-exposed tools with UI** | MCP Apps middleware | Custom toolkit |
| **HTTP streaming runtime** | `@copilotkit/runtime` v2 fetch handler | Worker routes + DO |
| **Callable typed RPC from browser** | Cloudflare **Agents SDK** `@callable` over WS | Custom message types |

**Are we using Cloudflare “Agents” / agent endpoint?** **No** — not the **`agents` npm** `Agent` class. Landibuild uses **`DurableObject` from `cloudflare:workers`** (and **PartySocket** on the client). Migrating to **`agents`** would replace **boilerplate** for WebSocket RPC, scheduling, and optional **`useAgent`** React — but **does not** replace **codegen** logic; it’s a **framework swap** on the **same** Durable Object primitive.

**“Specific stuff outside manual logic” worth knowing:** **Open-source** codegen quality comes from **models + prompts + tool design + evals**, not from a hidden Cloudflare API. What *is* packaged well elsewhere: **AG-UI event shapes**, **CopilotKit’s runtime + MCP**, **LangGraph interrupts**, **A2UI render pipeline**. None of those remove your need for **sandbox**, **git**, and **deploy** — those stay **Landi/CF infra**.

---

## 6. Current vibe-code–related features → power source → stay / replace

**“Singular” power column:** one primary backend per row (acknowledging helpers).

| Feature / function | Powered by (primary) | Source lineage | Stay (Y/N) | Replaced by (target) | Reasoning |
|--------------------|----------------------|----------------|------------|----------------------|-----------|
| Per-chat persistent agent | `CodeGeneratorAgent` DO + SQLite | VibeSDK / landibuild | **Y** | Same DO or CF **Agents SDK** `Agent` | Core session model |
| WebSocket chat transport | DO `broadcast` + client PartySocket | VibeSDK + landibuild | **N** (shape) | **AW2** frames + optional **GraphQL/SSE** to CopilotKit runtime | Reduce duplication / bugs |
| `conversation_response` (text, stream, tool) | Agent operations → WS | VibeSDK | **N** | `conversation.*` AW2 events + CK message model | God-message antipattern |
| `agent_ui_event` mirror | `emitAgentUiEvent` | landibuild | **N** | Fold into AW2 or AG-UI adapter | Duplicate semantics |
| Blueprint generation | LLM + blueprint ops | VibeSDK | **Y** | Same; surface via **readables** if CK | Domain logic |
| Template selection | LLM + template metadata | VibeSDK | **Y** | Same | |
| `buildFocus` landing routing | `controller.ts` + `inferutils` | landibuild | **Y** | Same + CK for **landing-only** UI optional | Product rule |
| Phasic codegen (phases / timeline) | Phase state machine + WS types | VibeSDK | **Y** (short term) | Optional **LangGraph** + `useLangGraphInterrupt` | Big migration |
| Agentic behavior + stages | `agentic.ts` + `projectStages` | landibuild | **Y** | `useCoAgent` / shared agent state | Align with AG-UI state |
| File generate / chunk / complete | WS + `FileManager` + git | VibeSDK | **Y** | `workspace.*` AW2 or parallel stream | Same behavior, cleaner wire |
| Preview / sandbox | `UserAppSandboxService` DO + containers SDK | Cloudflare + VibeSDK | **Y** | N/A | Infra |
| Debugger | `codeDebugger` + tools | VibeSDK / landibuild | **Y** | Optional second agent in runtime | Isolated concern |
| Static analysis / code review | Sandbox + review ops | VibeSDK | **Y** | Same | |
| Deploy / tunnel messages | Deployer + WS | VibeSDK / landibuild | **Y** | `workspace.deploy.*` | |
| GitHub export | Worker API + WS progress | VibeSDK | **Y** | Same | |
| Model config / presets / BYOK | D1 + `UserSecretsStore` | landibuild | **Y** | Runtime **or** keep parallel | Keys stay sensitive |
| Vault unlock / secrets | `UserSecretsStore` DO + WS signals | landibuild | **Y** | Same | |
| Rate limits | KV `VibecoderStore` | Cloudflare naming + VibeSDK patterns | **Y** | Same | |
| Auth to agent | Cookies + `connectToAgent` API | landibuild | **Y** | CK **or** keep | Must unify CORS if CK |
| Presentation / slides | iframe messaging + chat | landibuild | **Y** | Gen-UI components optional | |
| Thinking / plan strip UI | React + `projectStages` | landibuild | **Y** | CK co-agent renderers | |
| E2E / docs | — | — | **N** (missing) | Playwright + AGENTS.md | Quality |

---

## 7. Target state (aspirational)

| Feature / function | Powered by (target) | Source |
|--------------------|---------------------|--------|
| Chat UX (landing creator) | **CopilotKit** React (`@copilotkit/react-core` / `react-ui`) + optional **A2UI** for declarative panels | CopilotKit + AG-UI + Google A2UI spec |
| Agent orchestration (optional path) | **LangGraph** or keep custom ops | LangChain / landibuild |
| Runtime entry | **`@copilotkit/runtime`** on Worker `fetch` **or** small **Node sidecar** | CopilotKit |
| Event contract | **AW2** internal → **AG-UI** at boundary | Landi-defined + AG-UI |
| Stateful session | **CodeGeneratorAgent** DO **or** `agents` `Agent` class | Cloudflare |
| Sandbox / preview / deploy | **UserAppSandboxService** + deployer | Cloudflare + landibuild |
| Secrets / BYOK | **UserSecretsStore** + D1 presets | landibuild |
| Tools (read file, etc.) | Custom tools **or** **MCP** via runtime | landibuild / MCP |
| Phasic + agentic UX | **HITL hooks** + **co-agent state** from CK | CopilotKit |

---

## 8. CopilotKit capabilities × Landi audience × combined functionality

**Audience (Landi):** builders, agencies, internal operators — **low tolerance** for flaky codegen, **high** need for **trust** (secrets, preview, deploy), **multi-product** surface (landing vs full app vs slides).

**Effort key:** L = low (days), M = weeks, H = multi-sprint. **Value:** H/M/L for Landi aggregate.

| Feature | Purpose | Integration points (landibuild) | Value | Effort |
|---------|---------|----------------------------------|-------|--------|
| `CopilotKit` provider + `runtimeUrl` | Wire React to runtime | Vite app root; proxy `/api/copilotkit` or Worker route | H | M |
| `@copilotkit/runtime` fetch handler | HTTP/SSE/GraphQL API on edge or sidecar | `worker/index.ts` route or separate service | H | M–H |
| `useAgent` / v2 headless | AG-UI-native messages + state | Replace slice of `use-chat` / message list | H | H |
| `CopilotChat` / Sidebar / Popup | Drop-in chat UI | Landing-focused routes | M | L–M |
| `useCopilotAction` + Gen-UI | Tool-driven UI + HITL | Blueprint approval, template pick, deploy confirm | H | M |
| `useCopilotReadable` | App context to model | Editor selection, blueprint JSON, brand tokens | M | M |
| A2UI renderer + middleware | Declarative UI from model | Marketing blocks, dashboards | M | H |
| MCP Apps middleware | External tool servers with UI | Future integrations marketplace | M | H |
| LangGraph adapter | Graph-based agents + interrupts | Replace phasic state machine (optional) | H | H |
| Voice package | Voice input/output | Mobile / accessibility | L | M |
| Copilot Cloud | Hosted runtime / ops | If you want less Worker surface | M | L (vendor) |
| Web inspector | Debug agent traffic | Internal / staging | L | L |

---

## 9. Gap analysis summary

| Theme | Finding |
|-------|---------|
| **CopilotKit in landibuild** | **Zero** runtime/React dependency today — **full gap** for CK-specific features. |
| **AG-UI** | **Partial** — `agent_ui_event` names echo AG-UI; **not** full `@ag-ui/client` compliance. |
| **A2UI** | **Missing** — no `@copilotkit/a2ui-renderer` / Lit tree. |
| **Gen-UI** | **Partial** — tools + streaming exist; **no** `useCopilotAction` / `renderAndWaitForResponse` pattern. |
| **Cloudflare Agents SDK** | **Not used** for codegen agent — **optional migration** for WS/RPC ergonomics only. |
| **AW2 plan** | **Correct direction** if CopilotKit is a target — **adapter** is smaller than teaching CK your 60+ legacy types. |

---

## 10. Recommended next commits (non-binding)

1. Pin a **CopilotKit + `@ag-ui/*` semver** and generate **export tables** from `d.ts` (automated, not hand-maintained).  
2. **AW2-A:** Spec + fixtures in `sdk/` (plan **G1**).  
3. **Landing route spike:** smallest page with **`CopilotKit`** + **sidecar runtime** OR Worker **v2 fetch** handler — prove auth + streaming.  
4. Decide **per chat:** **dual UI** (landing CK + full-app legacy) vs **single** CK UI with **feature flags**.

---

*End of document.*
