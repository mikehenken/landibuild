# Context manager report (subagent: context-manager)

**← [Back to index](./00-coordinator-verification-gap-analysis-and-index.md)** · [01](./01-research-analyst-report.md) · [02](./02-search-specialist-report.md) · [03](./03-architect-reviewer-report.md) · [04](./04-ai-engineer-report.md) · [05](./05-refactoring-specialist-report.md) · [07](./07-follow-up-clarifications.md)

Source: Cursor Task subagent `context-manager`. **Full subagent output** below (untruncated).

---

Here is a concise synthesis based on the files that were actually opened in this session.

---

## Cross-repo context: KMP unified plan vs landibuild

### Sources explicitly read

| Source | What was read |
|--------|----------------|
| `landing-editor\.cursor\plans\unified_kmp_ai_agent_chat_system_with_dig_mode_f2b04445.plan.md` | **~320 lines** from the top (YAML frontmatter through the A2UI `A2uiForm` snippet). The file is large (~7500+ lines total); nothing below that cutoff was read. |
| `landibuild\AGENTS.md` | **Entire file** (developer workflow, stack pointers, patterns). |
| `landibuild\README.md` | **First ~80 lines** (product positioning and “Built on Cloudflare” stack summary). |

### Sources inferred (not read end-to-end in this pass)

- Remaining sections of the KMP plan (later phases, migration steps, detailed APIs).
- `landibuild` worker implementation (`worker/agents/*`, routes) beyond what README/AGENTS imply.
- `landi-ai-orchestrator` codebase and its current CopilotKit/AG-UI readiness.
- Parent `landi\AGENTS.md` / ecosystem-registry docs (referenced in workspace rules, not opened here).

---

### 1) What the KMP plan aims to build (modes, AG-UI, orchestrator role)

**Product / scope (from plan header and executive summary)**  
- **Project:** `landi-studio-kmp` — Kotlin Multiplatform + **Compose Multiplatform**, targets **Web (Wasm), Android, Desktop**.  
- **Unified AI agent chat** combining earlier “AI Agent Chat” work with **Dig Mode** (knowledge expansion / deep research).

**Modes**  
- **Build mode (“Site Builder”):** AI-assisted creation; **V1** focuses on **`site`** (landing/full subtypes). A **plugin-style build-type system** is described for future types (`mobile_app`, `documentation`, `email_template`, `micro_app`, `custom`) with prompts, tool whitelists, guards, validation, UI config, etc.  
- **Dig mode:** Knowledge expansion and research; session types such as person, project, concept, landi-resource, objective (per the plan’s mode table).

**AG-UI (and related UI stack)**  
- **Replaces** the original stack’s **CopilotKit React SDK** with **AG-UI via Kotlin** (`com.agui:kotlin-client`, version cited as `0.2.1` in the excerpt).  
- AG-UI is the **agent ↔ UI protocol**: streaming text, thinking telemetry, tool progress, **state snapshot/delta**, and **CUSTOM** events. The plan lists **17 standard event types** and maps them to Compose panels (preview, chat, tool progress).  
- **Generative UI:** **AG-UI** as transport; **A2UI** (Google) as the preferred **declarative spec** inside chat; also mentions Open-JSON-UI, MCP-UI, and custom Landi events (`preview_update`, `knowledge_graph`, etc.).

**Orchestrator role**  
- **`landi-ai-orchestrator` (Python/FastAPI)** sits behind HTTP/WebSocket as the **AG-UI-compatible backend**, with endpoints sketched as e.g. `POST /agent/chat`, `/agent/build`, `/agent/dig`, `GET /agent/tools`, plus **Gemini Live WebSocket proxy**, **LangGraph/LangChain**-style orchestration, and **Supabase auth validation**.  
- External services in the diagram: **Supabase**, **Gemini Live**, **Cloudflare Gateway**.

**Other plan pillars (from frontmatter todos, not deeply expanded in the lines read)**  
Phases include: KMP foundation, Build mode streaming/preview, **user-defined rules + context manager**, Dig data model and markdown output, Gemini Live audio, knowledge graph viz, MCP/distribution (Play Store, MSI, Cloudflare Pages for Wasm).

---

### 2) How that relates or conflicts with landibuild’s current React + Worker architecture

**Alignment (shared ideas)**  
- Both care about **chat-driven building**, **live preview**, and **multi-step AI workflows**.  
- Both can conceptually sit on **shared platform services** the plan names (**Supabase**, **Cloudflare AI Gateway** in the orchestrator diagram).  
- **AG-UI as a protocol** is **UI-framework-agnostic** in principle: a React app could consume similar event streams if the backend speaks AG-UI (the plan’s stack is Kotlin-first, not “AG-UI only on KMP”).

**Tension / divergence**  
- **Runtime split:** The plan’s **canonical client** is **KMP/Compose/Wasm**, not **React/Vite**. Landibuild is explicitly **React + Vite** with **Workers + Durable Objects** as the **primary backend for agents** (README: agents on DO, D1, R2, containers). The plan’s **brain** is **`landi-ai-orchestrator`**, not the Cloudflare Worker agent monolith described in landibuild docs.  
- **Frontend component strategy:** The plan states a **major shift away from Next.js/React** and says **`landi-ui` (Lit) is eliminated from this frontend** in favor of Compose. Landibuild is **React + shadcn-style UI** per repo conventions, not Lit/KMP.  
- **Original vs KMP stack in the plan:** The document itself contrasts **CopilotKit (React)** with **AG-UI Kotlin SDK** — landibuild today is **not** described in AGENTS.md as using CopilotKit; it uses **in-repo `worker/agents`** patterns instead (inferred from AGENTS.md + README, consistent with `docs/llm.md` grep hits).  
- **Duplication risk:** Two “agent surfaces” (landibuild Worker agents vs orchestrator LangGraph endpoints) unless you **intentionally unify** on one control plane and one streaming protocol.

**Net:** The plans are **cousins in product language** (build + research, streaming, preview) but **different in default architecture**: **landibuild = React + CF Workers/DO-first**; **KMP plan = Compose clients + Python orchestrator-first + AG-UI Kotlin**.

---

### 3) Feasibility of “something like the KMP plan inside landibuild” vs forking paths

**“Something like it inside landibuild” (feasible directions)**  
- **Protocol-level adoption:** Implement or proxy **AG-UI-shaped** (or NDJSON) **event streams** from the **existing Worker** to the **React** client, mapping events to React state (mirror of “AG-UI → Compose state” in the plan). This reuses the **idea** without KMP. *(Feasibility of exact SDK parity depends on AG-UI clients for TS/React — not verified in files read.)*  
- **Feature parity (partial):** **Build** is already the core of landibuild; **Dig-like** flows could be new routes/sessions/tools in the Worker, **or** delegated HTTP to `landi-ai-orchestrator` if you want one orchestration brain.  
- **Rules + context manager:** The plan’s Phase 3 is a **product concept** implementable in **any** stack (stored rules, RAG/context APIs, evaluation hooks).

**Costs / risks**  
- **Engineering cost:** Composing **preview + generative UI + tool telemetry** to the polish level described (A2UI renderers, 17 event types) is **substantial** in React if not using a mature client.  
- **Operational split:** If landibuild keeps **heavy logic in Workers** while the KMP app uses **Python**, you maintain **two orchestration implementations** unless one calls the other as the single source of truth.

**Forking paths (strategic)**  
- **Path A — Landibuild stays source of truth for “open builder on Cloudflare”:** Evolve streaming/UI protocol **inside** this repo; optional **thin calls** to shared services (models, auth, even orchestrator) where it saves time.  
- **Path B — KMP Landi Studio is the long-term “studio” client:** Landibuild remains **distribution/shell** or **narrower** scope; shared work moves to **orchestrator + AG-UI** contracts consumed by KMP **and** optionally a slim web client later.  
- **Path C — Converge on backend contract:** Define **AG-UI (or equivalent) API** in `landi-ai-orchestrator`; landibuild Worker becomes **edge gateway**, **session host**, or **deprecated** for chat orchestration over time. (Requires explicit product decision; not stated in the excerpt.)

**Inference note:** Choosing A vs B vs C is **not** spelled out in the 300-line plan slice; the excerpt **assumes** KMP + orchestrator as the **new** canonical frontend path for this product.

---

### 4) Context for agency extensions / shared components as platform concepts

**From landibuild `AGENTS.md` (read):**  
- Positions this repo as **part of** `https://landi.build`.  
- States the **primary** Landi.build codebase lives in **`landing-editor`**; other repos named: **`landi-docs`, `landi-ui`, `landi-infra`, `landi-ai-orchestrator`**.  
- **No** mention of agencies, marketplace, ecosystem registry, or extension model in that file.

**From landibuild `README.md` (read, partial):**  
- **SaaS / platform** angle: customers extending products **without** learning your API; **custom integrations and workflows**.  
- **Companies** customizing **AI behavior**, **generated code patterns**, **component libraries**, **data residency** — this supports a **white-label / platform** reading but does **not** define “agency extensions” as a formal subsystem.

**Inferred from broader Landi platform context (not read from landibuild files here):**  
Workspace rules reference an **Ecosystem Registry / Integrations Marketplace**, **LRN**, and multi-repo patterns — useful **mental model** for **shared components** (`landi-ui`) and **registered capabilities**, but that detail is **not** in landibuild’s short AGENTS.md.

**Cross-link to KMP plan:** The KMP **build-type plugin** table is a **natural hook** for **registered build kinds** (similar in spirit to a registry of capabilities). Whether that maps to **agency-specific extensions** is **not** stated in the lines read; it is a **reasonable integration point** to explore when aligning roadmaps.

---

## Definition of Done (self-check) (subagent-original)

| Criterion | Status |
|-----------|--------|
| **1)** Modes, AG-UI role, orchestrator role explained | Yes — from plan excerpt (Build/Dig, AG-UI Kotlin, A2UI, orchestrator diagram/endpoints). |
| **2)** Relation/conflict with landibuild React + Worker | Yes — README + AGENTS.md for stack; comparison to plan’s KMP + Python orchestrator. |
| **3)** Feasibility inside landibuild vs fork paths | Yes — protocol-level, feature partial parity, strategic paths A/B/C; TS AG-UI client availability marked as unverified from reads. |
| **4)** Agency / shared components from AGENTS.md / platform docs | Yes — **limited** from landibuild AGENTS.md/README; explicit note that rich ecosystem/agency docs were **not** read from this repo. |
| **Explicit read vs inferred** | Yes — table at top + inference notes in sections 3–4. |
| **Full markdown structure** | Yes — headings and lists as requested. |

---

If you want the next increment of context, the highest-value read would be **later sections** of the same `.plan.md` (implementation phases and migration) and **`landibuild` `worker/api` agent routes** to compare concrete endpoints to the plan’s `/agent/*` sketch.
