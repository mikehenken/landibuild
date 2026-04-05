# Phase 1D refresh — Open-canvas UX, AG-UI, A2UI on Workers + PartySocket + Durable Objects

**Workspace:** `landibuild`  
**Scope:** Protocol depth, viability, and spike ordering. **Open-canvas** here means **split-pane / artifact-canvas UX patterns** (chat stream + secondary surface for rich or structural content), not a mandate to adopt any particular third-party product beyond **reference patterns**. **CopilotKit** is a **secondary cross-check** (docs, demos, client behavior), not a default stack decision.

**Verdict (path to yes):** **Yes, with adapter work.** AG-UI maps cleanly onto a **WebSocket-first** session already backed by a **Durable Object** as session authority. A2UI maps onto the **right-hand / canvas pane** as **declarative payloads** inside AG-UI `CUSTOM` / app-defined channels or parallel typed envelopes, with **catalog + validation** as the security gate. Official AG-UI documentation currently lists **[Cloudflare Agents](https://developers.cloudflare.com/agents/)** under **Agent Framework integrations as “In Progress”** — which is **encouraging for the platform** but implies **no turnkey first-party bridge** to a **custom** `CodeGeneratorAgent` DO today; the **first spike** should prove **envelope + event mapping** on your existing wire protocol, not assume a drop-in SDK.

---

## 1. Executive summary

| Question | Answer |
| --- | --- |
| Can AG-UI run over PartySocket? | **Yes.** AG-UI is **transport-agnostic**; events are a **typed stream**. WebSockets are a first-class fit (SSE is the common HTTP pattern in docs). |
| Can A2UI coexist with AG-UI? | **Yes by design.** AG-UI is the **runtime agent↔user protocol**; A2UI is a **generative UI spec** (declarative JSON) that AG-UI can **carry** ([generative UI specs](https://docs.ag-ui.com/concepts/generative-ui-specs)). |
| Is CopilotKit required? | **No.** Useful to **validate event shapes**, **shared-state patterns**, and **open-canvas layout** references; adopt **thinly** (client components, samples) or **not at all** if native React + `@ag-ui/core` suffices. |
| Biggest technical risks? | **State authority** (DO vs client vs protocol mirror), **patch ordering** (JSON Patch conflicts), **canvas security** (catalog boundaries), **message volume** (streaming UI + codegen events). |
| Recommended first spike? | **AG-UI event envelope on the existing PartySocket** with **one** lifecycle + **one** text stream + **optional** `STATE_SNAPSHOT` derived from DO — **no** full A2UI renderer until the envelope is stable. |

---

## 2. Protocol stack — how the pieces relate

AG-UI documentation positions three **complementary** “agentic protocol” layers ([agentic protocols](https://docs.ag-ui.com/agentic-protocols)):

| Layer | Example | Role for landibuild |
| --- | --- | --- |
| Agent ↔ User | **AG-UI** | Standardize **what crosses the PartySocket** for **runs**, **messages**, **tools**, **shared state**, **errors** — **open-canvas** consumes the same stream or a **partitioned sub-stream**. |
| Agent ↔ Tools / data | **MCP** | Already a separate concern (tools, context); **do not conflate** with canvas UI. |
| Agent ↔ Agent | **A2A** | Optional for **multi-agent meshes**; A2UI has a **stable A2A extension** ([v0.8 A2A extension](https://a2ui.org/specification/v0.8-a2a-extension/)) if you ever route UI through agent-to-agent hops — **not required** for single-DO session UX. |

**Naming trap (resolved):** **A2UI** (generative UI) is **not** **AG-UI** (interaction protocol). CopilotKit’s explainer matches AG-UI docs ([CopilotKit AG-UI + A2UI](https://copilotkit.ai/ag-ui-and-a2ui)).

---

## 3. AG-UI — maximum practical depth

### 3.1 Design principles (normative)

From [core architecture](https://docs.ag-ui.com/concepts/architecture):

| Principle | Implication for Workers / DO |
| --- | --- |
| **Event-driven** | DO emits **ordered sequences** per `runId`; client applies events idempotently where possible. |
| **Bidirectional** | User actions and **frontend tool** results must **return** on the same channel (or paired RPC) — matches WebSocket **full-duplex**. |
| **Middleware-friendly** | Events need not be byte-identical to reference SDKs; **adapt** from internal codegen messages → **AG-UI-compatible** stream. |
| **Transport-agnostic** | **You choose** framing: JSON lines inside WS frames, protobuf side-channel, or multiplexed `type` field on existing messages. |

### 3.2 Architectural shape

The documented model is **Application ↔ AG-UI Client ↔ Agent** (with optional secure proxy). Your mapping:

| Doc component | landibuild analogue |
| --- | --- |
| Application | React app (chat route + canvas pane) |
| AG-UI Client | Thin client: either **CopilotKit** / **@ag-ui** client or **custom** subscriber on PartySocket |
| Agent | **Durable Object** (`CodeGeneratorAgent` / session DO) — **authoritative** run and state |
| Secure proxy | Worker entry / auth / rate limits **in front of** DO upgrade |

The protocol’s abstract execution shape is **`run(input: RunAgentInput) -> Observable<BaseEvent>`** ([architecture](https://docs.ag-ui.com/concepts/architecture)) — in a DO, implement as **async iterator** or **push** into WebSocket, preserving **per-run** correlation.

### 3.3 Event taxonomy (condensed)

Full detail: [Events](https://docs.ag-ui.com/concepts/events). Categories:

| Category | Purpose | Representative types |
| --- | --- | --- |
| **Lifecycle** | Bound a single agent run | `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`; optional `STEP_STARTED` / `STEP_FINISHED` |
| **Text** | Streaming assistant/user text | `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END`; convenience `TEXT_MESSAGE_CHUNK` |
| **Tool** | Tool call streaming + results | `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT`; convenience `TOOL_CALL_CHUNK` |
| **State** | Shared app/agent state | `STATE_SNAPSHOT`, `STATE_DELTA` (JSON Patch, RFC 6902), `MESSAGES_SNAPSHOT` |
| **Activity** | Long-running progress | Activity / progress events (see full events doc) |
| **Special** | Escape hatches | `RAW`, `CUSTOM` |
| **Draft** | Forward evolution | Draft events under specification change |

**Run correlation:** `RunStarted` carries **`threadId`** and **`runId`**; optional **`parentRunId`** supports branching / time-travel style logs ([events](https://docs.ag-ui.com/concepts/events)) — useful if open-canvas **forks** a run or ties **artifact revisions** to **run lineage**.

### 3.4 State synchronization — operational detail

From [State management](https://docs.ag-ui.com/concepts/state):

| Mechanism | When to use on DO | Client rule |
| --- | --- | --- |
| `STATE_SNAPSHOT` | Reconnect, post-error resync, major phase change (`PHASE_IMPLEMENTING` → `REVIEWING`) | **Replace** local mirror entirely |
| `STATE_DELTA` | Frequent small updates (cursor, file tree diff, canvas selection) | Apply JSON Patch **in order**; on failure, **request snapshot** |
| `MESSAGES_SNAPSHOT` | Chat history restore (aligns with your deduplication story) | Merge with dedupe policy already in product |

**Conflict handling:** Docs recommend explicit strategies when **both** user and agent mutate shared state. For codegen, **bias** toward **DO wins** for file maps and phase machine; **client wins** for **ephemeral** UI (scroll, selection) unless you promote those fields into shared state intentionally.

### 3.5 Server / encoder expectations

The [server quickstart](https://docs.ag-ui.com/quickstart/server) shows **POST + SSE** with `EventEncoder` and `RunAgentInput` — illustrative pattern. For Workers:

| SSE pattern in docs | WebSocket adaptation |
| --- | --- |
| Chunked `text/event-stream` | One WS message per event **or** batched JSON array with **sequence numbers** |
| `Accept` header driven encoder | Fix **one** encoding per deployment (JSON + optional compression) for simplicity |

**OpenAPI:** [openapi.json](https://docs.ag-ui.com/api-reference/openapi.json) helps if you expose **HTTP fallback** or **debug** endpoints alongside WS.

### 3.6 Generative UI placement

AG-UI explicitly **natively supports** multiple generative UI specs **including A2UI** ([generative UI specs](https://docs.ag-ui.com/concepts/generative-ui-specs)):

| Spec | Maintainer (per AG-UI doc) | Canvas relevance |
| --- | --- | --- |
| **A2UI** | Google | **Primary** candidate for **declarative** canvas widgets (forms, lists, charts) with **native** renderers |
| **Open-JSON-UI** | OpenAI | Alternative declarative shape; evaluate only if model/tooling favors it |
| **MCP-UI** | Microsoft + Shopify | **Iframe**-oriented; different trust model — optional for **sandboxed** rich content |

---

## 4. A2UI — maximum practical depth

### 4.1 Problem statement

A2UI answers: **how agents send rich UI across trust boundaries without arbitrary code execution** ([a2ui.org](https://a2ui.org/)) — **declarative** data, **client-owned** component catalog, **LLM-friendly** streaming JSON.

### 4.2 Spec versions

| Version | Status | Notes |
| --- | --- | --- |
| [v0.8](https://a2ui.org/specification/v0.8-a2ui/) | **Stable** | Production baseline: surfaces, components, data binding, adjacency list |
| [v0.9](https://a2ui.org/specification/v0.9-a2ui/) | **Draft** | `createSurface`, client-side functions, custom catalogs, extensions; **version** field on messages ([evolution](https://a2ui.org/specification/v0.9-evolution-guide/)) |

**Recommendation for spikes:** Target **v0.8** for **stability**; track v0.9 for **surface lifecycle** improvements.

### 4.3 Core concepts ([overview](https://a2ui.org/concepts/overview/))

| Concept | Meaning for implementation |
| --- | --- |
| **Streaming messages** | Canvas can **progressive render** as JSON lines arrive — matches codegen streaming mental model |
| **Declarative components** | Agent emits **data**; React maps **type** → **component** from **allowlist** |
| **Data binding** | UI structure references state via **JSON Pointer** paths — **separates** layout from **values** (good for partial updates) |
| **Adjacency list model** | **Flat** component list vs deep nested trees — easier for **incremental** patches and LLM incremental generation |

### 4.4 Message types (v0.8 vs v0.9)

Per [overview](https://a2ui.org/concepts/overview/) / [message reference](https://a2ui.org/reference/messages/):

| v0.8 (stable) | v0.9 (draft) |
| --- | --- |
| `surfaceUpdate`, `dataModelUpdate`, `beginRendering`, `deleteSurface` | `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface` |

**Integration note:** v0.9 **replaces** implicit surface creation patterns — plan a **version pin** in transport metadata.

### 4.5 Transports ([transports](https://a2ui.org/concepts/transports/))

| Transport | Status (per A2UI site) | landibuild read |
| --- | --- | --- |
| **A2A** | Stable | Future **multi-agent** backplane; not needed for **single-session** canvas v1 |
| **AG UI** | Stable (React stacks) | **Conceptual alignment**: A2UI messages **inside** AG-UI **CUSTOM** or spec-defined extension |
| **REST** | Planned | Optional **artifact fetch** for large surfaces |
| **WebSockets** | **Proposed** | **You still should use them** — “proposed” means **spec transport matrix**, not “disallowed” |
| **SSE** | Proposed | Possible **secondary** channel; WS already exists |

**Bottom line:** A2UI is **intentionally transport-agnostic** (“any method that can send JSON”). PartySocket **qualifies** as a **custom transport**; document your **envelope** in internal ADR.

### 4.6 Security posture (canvas)

| Property | Mitigation |
| --- | --- |
| No arbitrary code in spec | **Renderer maps** known `componentType` → React component |
| Catalog boundary | **Deny unknown types** by default; **strict JSON schema** validation in Worker before echo to client |
| Data exfiltration via bindings | **Sanitize** JSON Pointer targets against **allowed** state subtrees |
| Progressive stream abuse | **Rate-limit** surface updates per run; **max component count** |

---

## 5. Fit — Cloudflare Workers + PartySocket + Durable Objects

### 5.1 Platform alignment

| Platform capability | AG-UI need | A2UI need |
| --- | --- | --- |
| **WebSocket (PartySocket)** | Bidirectional **event stream** | JSON **lines** or framed objects |
| **Durable Object** | **Single-threaded** session authority; SQLite state | Store **latest surface** + **data model** for reconnect |
| **Worker** | Auth, routing, upgrade | Validation, size limits, feature flags |
| **Hibernation / reconnect** | Must emit **`STATE_SNAPSHOT` + `MESSAGES_SNAPSHOT`** on resume | Resend **beginRendering** / **surface** baseline (v0.8) or **`createSurface`** (v0.9) |

### 5.2 Relationship to Cloudflare Agents SDK

[Cloudflare Agents](https://developers.cloudflare.com/agents/) is a **productized** DO + `AIChatAgent` + hooks path with **built-in** chat persistence and streaming. **landibuild** already has a **custom** codegen DO and PartySocket bridge — **convergence options**:

| Approach | Pros | Cons |
| --- | --- | --- |
| **A. Stay on custom DO, add AG-UI adapter** | Preserves **CodeGenState** machine; lowest **behavioral** risk | You maintain mapping code |
| **B. Gradually reuse Agents SDK patterns** | Less custom WS code over time | **Migration** cost; may not fit **phase codegen** |
| **C. Dual stack (not recommended early)** | — | **Split brain** unless strict session hierarchy |

**Path to yes favors A** until spikes prove **pain** in state mapping.

### 5.3 Codebase seams (from planning traces)

| Location | Role |
| --- | --- |
| `worker/agents/core/websocket.ts` | Server-side **emit** point for wrapped AG-UI events |
| `src/routes/chat/utils/handle-websocket-message.ts` | Client **consume**, dedupe, route to chat vs **canvas store** |

---

## 6. CopilotKit — secondary cross-check only

Use CopilotKit to **compare behavior**, not as **source of truth** for the spec.

| Cross-check target | Where | Use |
| --- | --- | --- |
| AG-UI vs A2UI teaching | [copilotkit.ai/ag-ui-and-a2ui](https://copilotkit.ai/ag-ui-and-a2ui) | Onboarding engineers; **external** talks |
| Shared state mental model | [AG-UI state doc](https://docs.ag-ui.com/concepts/state) cites **useCoAgent** patterns | Compare to your **DO mirror** design |
| Open-canvas / multi-pane UX | [open-multi-agent-canvas](https://github.com/CopilotKit/open-multi-agent-canvas) | **Layout**, **pane** responsibilities, **MCP** patterns — **strip** what does not apply to codegen |
| A2UI experiments | [A2UI Widget Builder](https://go.copilotkit.ai/A2UI-widget-builder) | **Prompt / widget** iteration for **catalog** design |
| Framework integrations | [docs.copilotkit.ai](https://docs.copilotkit.ai/) | **LangGraph-first** examples — **do not** assume same server shape as DO |

**Inversion test:** If CopilotKit disappeared tomorrow, **AG-UI + A2UI specs + @ag-ui SDK** remain sufficient to implement — **dependency on CopilotKit is optional**.

---

## 7. Open-canvas UX patterns (only)

This section **does not** prescribe product features beyond **layout and data-flow patterns** useful for **agentic coding + artifacts**.

| Pattern | Description | AG-UI hook | A2UI hook |
| --- | --- | --- | --- |
| **Split pane** | Left: **conversation**; right: **artifact / spec / preview** | Left: `TEXT_MESSAGE_*`, `TOOL_CALL_*`; Right: `CUSTOM` carrying A2UI or file-focused `STATE_*` | Right pane: **renderer** for `surfaceUpdate` stream |
| **Single thread, dual surface** | One `threadId`, multiple **visual** surfaces (chat vs canvas) | Same `threadId`; **orthogonal** `runId` or **sub-channel** field | Multiple surfaces only if v0.9 **`createSurface`** or v0.8 multi-surface pattern |
| **Progressive disclosure** | Canvas **fills in** as agent streams plan → fields → chart | `STEP_*` + A2UI streaming | `dataModelUpdate` after structure |
| **Human-in-the-loop** | Approve **tool** or **UI action** before DO continues | Align with **interrupt** drafts in AG-UI roadmap + tool result loop | User actions **round-trip** as messages ([A2UI flow on a2ui.org](https://a2ui.org/)) |
| **Reconnect continuity** | User refreshes; canvas **snaps back** | `STATE_SNAPSHOT` + `MESSAGES_SNAPSHOT` | Re-emit last **surface** + **data model** baseline |

---

## 8. Ranked integration options

| Rank | Option | Summary | Best when | Main cost |
| --- | --- | --- | --- | --- |
| **1** | **Native AG-UI envelope on PartySocket + DO authority** | Map internal events → AG-UI; optional `@ag-ui/core` types on client | **Default path to yes**; preserve codegen DO | Engineering time for **mapping + tests** |
| **2** | **AG-UI + A2UI in canvas (v0.8)** | `CUSTOM` or namespaced payload carries A2UI JSONL; React **Lit or official renderer** exploration | Need **structured** generative UI **without** HTML soup | **Catalog** + **validation** + **renderer** package choice |
| **3** | **HTTP SSE AG-UI endpoint (parallel)** | `HttpAgent`-style POST for **debug**, **CLI**, or **non-WS** clients | Ops wants **curl**-able runs | Second transport to **keep consistent** with WS |
| **4** | **CopilotKit-heavy (client + hosted patterns)** | Embed CopilotKit React **shell** | **Extreme** velocity on **generic** agent chat **and** you accept bundle + model coupling | **State alignment** with `CodeGenState` |
| **5** | **MCP-UI / iframe canvas** | Sandboxed **web** components | Untrusted **HTML** from tools | **Iframe** UX + **performance** |

**Recommended first spike:** **Option 1** only — prove **one** full **RUN_*** lifecycle and **TEXT_MESSAGE_*** stream **without** rewriting the DO.

---

## 9. Risks and mitigations

| Risk | Why it hurts | Mitigation |
| --- | --- | --- |
| **Dual state truth** | Client AG-UI mirror diverges from DO `CodeGenState` | **DO is canonical**; AG-UI state is **derived** or **explicitly partitioned** (ephemeral vs authoritative fields) |
| **JSON Patch failures** | Out-of-order or conflicting `STATE_DELTA` | **Monotonic sequence** per connection; **snapshot fallback**; **single writer** (DO) for authoritative fields |
| **Event volume** | Codegen + canvas streams **multiply** WS traffic | **Batch** events; **delta** for file maps; **suppress** redundant tool events (aligns with existing dedupe narrative) |
| **A2UI catalog escape** | Malformed or hostile **component** requests | **Schema validate**; **allowlist** types; **cap** nodes; **no** `dangerouslySetInnerHTML` paths |
| **Spec drift (v0.8 vs v0.9)** | Client/renderer mismatch | **Pin** spec version in **envelope metadata**; single **upgrader** in Worker |
| **Upstream “In Progress”** | Cloudflare Agents × AG-UI not finished on official matrix | Treat **community** samples ([ag-ui-cloudflare](https://github.com/klammertime/ag-ui-cloudflare)) as **non-normative**; contribute or fork patterns |
| **CopilotKit lock-in** | Business logic leaks into **their** abstractions | **CopilotKit = lab**; **specs = contract** |

---

## 10. Recommended first spike and ordered spike list

### 10.1 Recommended first spike (single choice)

**“AG-UI event envelope on PartySocket”** — implement a **versioned outer wrapper** on existing messages:

- `aguiVersion`, `threadId`, `runId`, `seq`, `payload` (AG-UI event object)
- Emit **synthetic** `RUN_STARTED` / `RUN_FINISHED` around an existing **codegen turn** (even if internal steps are coarse)
- Map **one** assistant reply to `TEXT_MESSAGE_START` / `TEXT_MESSAGE_CONTENT`* / `TEXT_MESSAGE_END`

**Success criteria:** Frontend can **subscribe** with a **small** reducer; reconnect receives **either** wrapped history replay or a **MESSAGES_SNAPSHOT** + `STATE_SNAPSHOT` **synthesized** from DO.

### 10.2 Ordered spike list (after first spike)

| Order | Spike | Outcome |
| --- | --- | --- |
| **S1** | Envelope + lifecycle + text streaming | **Protocol viability** |
| **S2** | `STATE_SNAPSHOT` / `STATE_DELTA` from **read-only** `CodeGenState` projection | **Canvas file tree / phase** without A2UI |
| **S3** | Reconnect: snapshot + seq **gap detection** | **Production hardening** |
| **S4** | Tool events: map **one** internal tool to `TOOL_CALL_*` + `TOOL_CALL_RESULT` | **Parity** with chat tooling UI |
| **S5** | A2UI v0.8: **single** surface, **static** catalog (e.g. form + text) | **Generative UI** proof |
| **S6** | A2UI streaming + **dataModelUpdate** binding | **Progressive** canvas |
| **S7** | `CUSTOM` channel for **non-A2UI** artifacts (e.g. code diff summary) | **Escape hatch** without polluting A2UI |
| **S8** | Optional HTTP **debug** endpoint with **OpenAPI**-aligned POST | **Interop** with `HttpAgent` clients |
| **S9** | Evaluate v0.9 **`createSurface`** vs v0.8 **`beginRendering`** | **Spec upgrade** decision |
| **S10** | CopilotKit **side-by-side** prototype (isolated branch) | **Velocity** vs **fit** **quantified** |

---

## 11. Viability gates (path to yes)

| Gate | Pass condition |
| --- | --- |
| **G1** | Wrapped events **parse** on client with **<N ms** reducer overhead (pick N in implementation) |
| **G2** | **No** double authority: file list **matches** DO after reconnect |
| **G3** | A2UI payload **rejected** when **unknown** `componentType` |
| **G4** | **CopilotKit optional:** branch without CopilotKit **still** renders chat + canvas MVP |

---

## 12. Deliverable paths (this phase)

| Artifact | Path |
| --- | --- |
| This synthesis | `.development/journal/planning/model-config-byok-agui-canvas-orchestration/p1d-open-canvas-agui-a2ui/p1d-synthesis.md` |
| Citations | `.development/journal/planning/model-config-byok-agui-canvas-orchestration/p1d-open-canvas-agui-a2ui/citation.yaml` |

---

## 13. Revision note

**2026-04-04 refresh:** Replaced incorrect **AG2** documentation links with **canonical** [docs.ag-ui.com](https://docs.ag-ui.com/) and [a2ui.org](https://a2ui.org/) sources; expanded **protocol** depth (events, state, transports, spec versions); grounded **Cloudflare Agents** and **A2UI transport** status from primary pages; clarified **CopilotKit** as **cross-check**; removed unverified **latency** claims about CopilotKit edge adapters — treat performance as **measurement** in a later spike.
