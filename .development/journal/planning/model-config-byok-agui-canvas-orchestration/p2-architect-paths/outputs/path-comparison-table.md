# Path comparison matrix — Phase 2 (`p2-architect-paths`)

**Purpose:** Single scan-friendly matrix for Phase 3 (`p3-feasibility-crosscheck`) and independent review (`p4b-review-planning`).  
**Detail:** See `architecture-paths.md` for prose, tradeoffs, and the **preferred composite (2 + 5)**.

**Legend — migration band:** S = small (days–few weeks), M = medium (weeks), L = large (multi-sprint), XL = very large (program-level).

**Revision note (2026-04-04):** Added criteria **orchestration maturity**, **migration cost** (summary column), and **dual-stack (legacy + new) feasibility** so Path 6 and graph/CopilotKit options are comparable without “non-goal” framing.

---

## Goals coverage (1–6 from plan scope)

| Path | Short name | G1 dynamic config | G2 admin / compat providers | G3 cross-action model mix | G4 preset bundles | G5 canvas / AG-UI / A2UI | G6 ask mode |
|------|------------|-------------------|----------------------------|---------------------------|-----------------|--------------------------|-------------|
| **1** | Worker/env policy only | Partial (deploy-bound) | Weak | Partial (unchanged gaps) | Weak | — (not primary) | Partial (flags only) |
| **2** | D1 catalog + Worker resolve | Strong | Strong (with SSRF design) | Strong (if inference unified) | Strong | — (combine with 5) | Strong |
| **3** | External gateway SoT | Via gateway | Strong (gateway feature) | Via gateway policy | Via gateway profiles | — (orthogonal) | Via gateway + app gates |
| **4** | Control plane + data plane | Strong | Strong | Strong | Strong | — (orthogonal) | Strong |
| **5** | AG-UI adapter + PartySocket | — | — | — | — | Strong (phased) | — (combine with 2) |
| **6** | Hybrid external graph | Varies | Varies | Risk of drift | Risk of drift | Medium (demo risk) | Risky (split enforce.) |

---

## Non-functional attributes

| Path | Worker / D1 / DO fit | Ops complexity | Security surface (summary) | Coupling to vendors | Reversible? |
|------|----------------------|----------------|----------------------------|---------------------|-------------|
| **1** | Excellent / minimal D1 | Low | Smallest data plane | Low | High |
| **2** | Excellent | Medium–High | SSRF + admin API + audit | Low (protocols yours) | Medium (schema migrations) |
| **3** | Good (`fetch` client) | High (gateway SRE) | Shifts to gateway + token handling | Medium–High | Medium |
| **4** | Good–Medium | High (two deployables) | Two authn/z surfaces | Low–Medium | Low–Medium |
| **5** | Excellent (WS + DO) | Medium | Generative UI / XSS sandbox | Medium (optional CopilotKit) | Medium (adapter layer) |
| **6** | Split | Highest | Two runtimes + sync | High (graph stack) | Low |

---

## Orchestration, migration, and dual-stack (2026-04-04)

| Path | Orchestration maturity (typical) | Migration cost (band) | Dual-stack: legacy + new feasibility |
|------|----------------------------------|------------------------|-------------------------------------|
| **1** | Mature for **current** env/code policy only | **S** | High short-term (no second runtime); low if future path 2/5 piles on |
| **2** | Strong **in-Worker** resolution + DO session snapshot | **L** | Good: single deployable; phased D1 + inference unification |
| **3** | Gateway-owned routing/keys; Worker stays thin client | **L–XL** | Medium: gateway + app config must stay in sync until cutover |
| **4** | Split admin vs data plane; snapshots reduce hot-path coupling | **L–XL** | Medium: two deployables + invalidation discipline |
| **5** | DO + WS remains core; AG-UI/A2UI as **projection** | **M–L** (phased) | Good: adapter layer allows legacy `websocketTypes` + AG-UI envelope in parallel |
| **6** | **Hypothesis-dependent** (LangGraph / external graph / CopilotKit orchestration samples) | **XL** | **Low–Medium** unless **explicit session hierarchy** + strangler: parallel runtimes easy to demo, hard to merge without design |

*Path 6 “orchestration maturity” is intentionally **TBD by spike**: ecosystem maturity may be high; **landi integration** maturity starts low until hierarchy and config resolution are specified.*

---

## Combination shortcuts

| Combo | Use when |
|-------|----------|
| **2 + 5** | **Preferred default if viability holds** — platform SoT for policy; AG-UI/A2UI as projection over DO state. Does **not** preclude time-boxed **Path 6** evaluation or deeper CopilotKit use after spikes. |
| **2 + 3** | Tenant URLs unacceptable on Worker; gateway already enterprise-standard. |
| **4 + 2** | Admin scale / multi-product catalog; landibuild consumes snapshots only. |
| **1 + 5** | Time-box policy work; still spike canvas protocol—**debt** if 2 slips. |

---

## Phase 3 prompt hook

For each row **1–6**, Phase 3 should return **feasible / needs spike / blocked** with explicit **Worker / D1 / DO** reasoning, and call out tension with **`ModelProvidersController` 503** and **config-modal** BYOK UX per bundle **§B** / **§I.1**.

---

*Companion to `architecture-paths.md`.*
