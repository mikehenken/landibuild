# Phase 5 — Intent Checklist (Objective Review)

**Task:** `p5-objective-review`  
**Agent:** qa-expert  
**Date:** 2026-04-04  
**Depends on:** Phase 4A and 4B (Review phases)

This document maps each intent bullet from the plan's "Outcomes we want" (1-6) to evidence in the generated artifacts, and identifies backlog rows for anything still open.

### Planning revision (2026-04-04)

**Assumption change:** The **orchestration stack** (native DO vs LangGraph-class vs CopilotKit depth) is treated as an **open decision pending spikes**, not as settled. Authoritative deltas: `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` (orchestration evaluation criteria; Path **6** verdict **Needs spike** instead of **Blocked**; softened language on graph runtimes) and `spike-backlog.md` rows **18–21**.

**Scoring / prior conclusions:** Earlier text that read as **definitive exclusion** of hybrid or LangGraph-class paths should be read in light of the above. This revision **does not** throw out prior risk analysis (split brain, XL cost, modal/policy tension); it **reframes** default commitment as **evidence-gated** rather than **policy-forbidden**. Where this doc cites Path **6** as blocked, prefer **`feasibility-crosscheck.md`** as the updated source of truth.

---

## Intent Mapping & Evidence

### 1. Dynamic Provider/Model Configuration
**Intent:** Configure providers, models, and per-model settings in a more dynamic way than the current build-time split between `AGENT_CONFIG` and `PLATFORM_MODEL_PROVIDERS`.

**Evidence in Artifacts:**
- **Current State:** `p1a-codebase-model-config-byok/outputs/gaps-vs-goals-1-4.md` documents the existing static split based on `env.PLATFORM_MODEL_PROVIDERS` and the lack of a D1/runtime catalog.
- **Architecture:** `p2-architect-paths/outputs/architecture-paths.md` proposes Path 2 (D1-backed catalog and Worker resolution) to enable dynamic configuration.
- **Feasibility:** `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` confirms Path 2 is feasible but requires schema and migration work.

**Open Backlog Items:**
- **Spike #4:** D1 schema sketch + migration plan for catalog rows.
- **Spike #5:** Resolution service PoC.

### 2. Admin Registration & Security
**Intent:** Let super-admins and agency admins register OpenAI-compatible base URLs, attach models, and set related options, with proper security around outbound calls and secrets.

**Evidence in Artifacts:**
- **Current State:** `p1a-codebase-model-config-byok/outputs/gaps-vs-goals-1-4.md` notes that custom provider CRUD operations currently return 503s and there are no agency/super-admin roles.
- **Architecture:** `p2-architect-paths/outputs/architecture-paths.md` (Path 2 and 4) addresses this via D1 entities and RBAC.
- **Feasibility:** `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` highlights the tension between the 503 behavior and the config-modal UX, emphasizing the need for SSRF discipline before re-enabling custom base URLs.

**Open Backlog Items:**
- **Spike #2:** Worker SSRF policy design for user/tenant `fetch`.
- **Spike #3:** 503 / config-modal / API alignment.
- **Spike #8:** Agency / super-admin RBAC model.

### 3. Mixing Models & Policy Gaps
**Intent:** Confirm how far we already support mixing models from different providers across templates/agent actions, and document gaps at the D1/policy layer if any.

**Evidence in Artifacts:**
- **Current State:** `p1a-codebase-model-config-byok/outputs/gaps-vs-goals-1-4.md` confirms `user_model_configs` supports different models per `AgentActionKey`. However, it identifies policy gaps where `realtimeCodeFixer` and `PhaseGeneration` bypass user configs and runtime overrides.

**Open Backlog Items:**
- **Spike #7:** Inference path audit + unify bypasses (`realtimeCodeFixer`, `PhaseGeneration`).

### 4. Named Preset Bundles
**Intent:** Support named preset bundles (e.g. gemini- vs claude-centric) that can be applied at platform, agency, or user level, with an explicit precedence story.

**Evidence in Artifacts:**
- **Current State:** `p1a-codebase-model-config-byok/outputs/gaps-vs-goals-1-4.md` notes the absence of named bundles or precedence chains beyond implicit env-based configs.
- **Architecture:** `p2-architect-paths/outputs/architecture-paths.md` (Path 2) proposes versioned preset bundles in D1 with a Worker resolution service to merge precedence.

**Open Backlog Items:**
- **Spike #4:** D1 schema sketch for versioned bundles and assignments.
- **Spike #6:** DO session config snapshot + invalidation (handling bundle changes).

### 5. AG-UI / A2UI & Canvas UX Viability
**Intent:** **Viability and design** for a canvas-style right pane and for **AG-UI / A2UI** alongside `SimpleCodeGeneratorAgent` and the current WebSocket protocol. Use open-canvas for UX patterns. Use CopilotKit docs where they clarify AG-UI/A2UI behavior.

**Evidence in Artifacts:**
- **Research:** `p1d-open-canvas-agui-a2ui/p1d-synthesis.md` confirms high viability of AG-UI/A2UI over PartySocket + DO, recommending a native adapter approach. It references open-canvas for split-pane UX and CopilotKit for validation.
- **Architecture:** `p2-architect-paths/outputs/architecture-paths.md` includes Path 5 (AG-UI / A2UI adapter on PartySocket + phased generative UI), which forms part of the preferred composite architecture (Path 2 + Path 5).
- **Feasibility:** `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` confirms Path 5 is feasible but requires protocol mapping and XSS sandboxing spikes.

**Open Backlog Items:**
- **Spike #11:** AG-UI event envelope on PartySocket.
- **Spike #12:** `CodeGenState` ↔ AG-UI snapshot mapping + reconnect.
- **Spike #13:** Static A2UI spec from Worker + split-pane render.
- **Spike #14:** Streaming patch / deltas for artifacts.
- **Spike #15:** A2UI renderer sandbox strategy.
- **Spike #16:** CopilotKit vs hand-rolled client evaluation.

### 6. Ask Mode
**Intent:** Allow **ask mode** (general chat, optional use of platform capabilities) in any conversation thread without breaking the existing codegen agent path.

**Evidence in Artifacts:**
- **Current State:** `p1b-codebase-chat-ask-agent-ws/outputs/code-trace-chat-ws-ask-agent.md` traces the WebSocket handling and identifies insertion points for a per-thread mode (e.g., extending `AgentState`, branching `handleUserInput` to skip `generateAllFiles`, and modifying `buildTools`).
- **Architecture:** `p2-architect-paths/outputs/architecture-paths.md` evaluates Path 6 (Hybrid external graph). **Updated feasibility:** `p3-feasibility-crosscheck/outputs/feasibility-crosscheck.md` now rates Path **6** as **Needs spike** with orchestration stack open (LangGraph / CopilotKit / native DO spikes)—not a permanent block on graph runtimes.

**Open Backlog Items:**
- **Spike #17:** Ask mode — server-enforced mode flag, tool allowlist, and `user_suggestion` extension.
- **Spikes #18–21:** Hybrid mandate + integration; LangGraph/subgraph–DO boundary; CopilotKit full-stack vs adapter-only; dual-page/dual-mode orchestration feasibility.

---

## Definition of Done Self-Review

| Criterion | Met? | Notes |
|-----------|------|-------|
| Map each intent bullet (1-6) to evidence in artifacts | **Yes** | All 6 intents are explicitly mapped to research, architecture, and feasibility artifacts. |
| Backlog rows for anything still open | **Yes** | Relevant spikes from `p3-feasibility-crosscheck/outputs/spike-backlog.md` are linked to each intent. |
| Write outputs to `p5-objective-review/` | **Yes** | Output written to `.development/journal/planning/model-config-byok-agui-canvas-orchestration/p5-objective-review/objective-review.md`. |
| Self-review against DoD and quality gates | **Yes** | The mapping is grounded in the actual generated artifacts and accurately reflects the current state of the planning phase. |

*End of Phase 5 objective review.*