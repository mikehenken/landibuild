# Path comparison matrix — Phase 2 (`p2-architect-paths`)

**Purpose:** Single scan-friendly matrix for Phase 3 (`p3-feasibility-crosscheck`) and review (`p4b-review-planning`).  
**Detail:** `architecture-paths.md` — prose, tradeoffs, **preferred composite 2 + 5** (optional **+7** for immutable bundles).

**Legend — migration band:** S = small (days–few weeks), M = medium (weeks), L = large (multi-sprint), XL = very large (program-level).

**SSRF note:** Today `ModelProvidersController` **create/update/delete** return **503**, but **`testProvider`** may `fetch` user `baseUrl` + `/models` without application allowlist/DNS-IP validation or explicit redirect policy (bundle §I.3). Any path that re-enables custom URLs or widens probes must assume **OWASP-class SSRF** design work.

**Ask mode note:** No durable `ask` | `agent` flag; `user_suggestion` has no `mode`; idle `handleUserInput` can invoke **`generateAllFiles()`** (bundle §F). **G6** requires server choke point + state migration — not delivered by Path 5 alone.

---

## Goals 1–6 (plan scope)

| Path | Short name | G1 dynamic config | G2 admin / compat providers | G3 cross-action mix | G4 preset bundles | G5 canvas / AG-UI / A2UI | G6 ask mode |
|------|------------|-------------------|----------------------------|---------------------|-------------------|--------------------------|-------------|
| **1** | Worker/env only | Partial (deploy-bound) | Weak | Partial (code fixes only) | Weak | — (not primary) | Partial (needs state+choke) |
| **2** | D1 catalog + resolve | Strong | Strong **if** SSRF + RBAC designed | Strong **if** inference unified | Strong | — (combine **5**) | Strong **if** mode in DO/API |
| **3** | External gateway | Via gateway SoT | Strong (gateway feature set) | Via gateway policy | Via gateway profiles | — (orthogonal) | Strong **if** app + gateway agree on mode |
| **4** | Control + data plane | Strong | Strong (admin isolated) | Strong (snapshot discipline) | Strong | — (orthogonal) | Strong **if** data plane enforces mode |
| **5** | AG-UI + PartySocket | — | — | — | — | Strong (phased S1–S7) | — (combine **2** or **1**+state) |
| **6** | Hybrid external graph | Varies | Varies | **Drift risk** | **Drift risk** | Medium (demo / dual stream) | **Risky** (split enforcement) |
| **7** | R2/KV bundle artifacts | Neutral alone | Neutral | Neutral | **Very strong** (immutable) | — | Neutral |

---

## Non-functional requirements (NFRs)

| Path | Worker / D1 / DO fit | Ops complexity | Observability | Audit / compliance | Coupling to vendors | Reversible? |
|------|----------------------|----------------|-----------------|-------------------|---------------------|-------------|
| **1** | Excellent / minimal D1 | Low | Single binary | Env + deploy logs | Low | High |
| **2** | Excellent (cache in DO) | Medium–High | Unified Worker traces | **D1 audit rows** | Low (protocols yours) | Medium |
| **3** | Good (`fetch` client) | High (gateway SRE) | **Split** Worker + gateway | Gateway + app logs | Medium–High | Medium |
| **4** | Good–Medium | High (two deployables) | Two surfaces | Strong if CP owns admin | Low–Medium | Low–Medium |
| **5** | Excellent (WS + DO) | Medium | WS + adapter metrics | Event log / envelope version | Medium (optional CopilotKit) | Medium |
| **6** | Split | **Highest** | **Hardest** (two runtimes) | Fragmented unless unified | High (graph stack) | Low |
| **7** | Good (R2 + D1 pointers) | Medium (+ publish pipeline) | Artifact hash + assignment | **Strong** (immutable history) | Low (CF storage) | Medium |

---

## SSRF / outbound URL safety (explicit)

| Path | User-controlled `baseUrl` on Worker? | SSRF responsibility | Pre-req to widen `testProvider` / CRUD |
|------|--------------------------------------|---------------------|----------------------------------------|
| **1** | Avoid / stay 503 | Minimal if no custom URLs | N/A until URLs enabled |
| **2** | **Yes** if custom providers in D1 | **Worker** must implement allowlist, DNS+IP, redirects, timeouts | Security design + implementation **before** GA |
| **3** | Often **no** (gateway endpoint only) | **Gateway** + Worker token handling | Gateway hardening + contract tests |
| **4** | Data plane may mirror Path 2 or 3 | **Split** — define which tier fetches | Explicit boundary in threat model |
| **5** | N/A (protocol projection) | Generative UI / XSS separate from SSRF | A2UI allowlist / iframe sandbox |
| **6** | **Risk** if graph runtime probes URLs | **Two** surfaces to review | Unified policy export or single fetch tier |
| **7** | N/A for artifacts (read signed/config blobs) | Low for bundle **read**; assignments still follow Path 2 rules | Same as paired path (2/4) |

---

## Ask mode (G6) enforcement

| Path | Server-enforced mode feasible? | Notes |
|------|-------------------------------|--------|
| **1** | Partial | Code-only: choke `handleUserInput` + minimal `AgentState` — no full policy without D1 |
| **2** | **Strong** | D1/DO: mode flag, tool allowlists per mode, snapshot with resolved policy |
| **3** | Strong **if** gateway honors mode headers/tokens | Avoid dual truth: Worker must still block codegen when ask-only |
| **4** | Strong | Data plane enforces; control plane may own mode policy templates |
| **5** | **Weak alone** | UI streams do not replace server gate; **must pair** with 2 or 1+DO state |
| **6** | **Risky** | External ask runtime vs DO codegen — require **single authority** for “can mutate repo” |
| **7** | Neutral | Bundle pointers do not implement ask; pairs with **2** |

---

## Orchestration, migration, dual-stack

| Path | Orchestration maturity (typical) | Migration cost | Dual-stack: legacy + new feasibility |
|------|----------------------------------|----------------|--------------------------------------|
| **1** | Current env/code only | **S** | High short-term; debt if 2/5 deferred |
| **2** | Strong in-Worker + DO snapshot | **L** | Good: single deployable; phased D1 + inference unify |
| **3** | Gateway-owned routing | **L–XL** | Medium: sync gateway ↔ app until cutover |
| **4** | Split admin vs data plane | **L–XL** | Medium: invalidation + two deployables |
| **5** | DO + WS core; AG-UI projection | **M–L** | Good: legacy `websocketTypes` ∥ AG-UI envelope |
| **6** | Spike-dependent (LangGraph / CopilotKit server) | **XL** | Low–Medium without **session hierarchy** + strangler |
| **7** | Publish pipeline + Path 2 resolver | **M–L** | Good if paired with 2 (additive artifact store) |

*Path 6 “maturity” = ecosystem may be high; **landi integration** maturity low until hierarchy specified.*

---

## Combination shortcuts

| Combo | Use when |
|-------|----------|
| **2 + 5** | **Preferred default** — platform SoT; AG-UI/A2UI as DO projection. |
| **2 + 5 + 7** | **G4** needs immutable rollback/SKU pipeline without full Path 4. |
| **2 + 3** | Tenant arbitrary URLs unacceptable on Worker; gateway enterprise-standard. |
| **4 + 2** | Admin scale / multi-product catalog; landibuild consumes snapshots. |
| **1 + 5** | Time-box policy; spike canvas — **debt** if 2 slips. |

---

## Phase 3 prompt hook

For each row **1–7**, return **feasible / needs spike / blocked** with **Worker / D1 / DO** reasoning. Explicitly tension-check: **`ModelProvidersController` 503** vs **`testProvider`** UX honesty; recursive **`runtimeOverrides`**; **`SESSION_INIT`** disabled; **`realtimeCodeFixer`** bypass; idle **codegen** on chat messages.

---

*Companion to `architecture-paths.md` (refreshed 2026-04-05; Path 7 + Phase 3 hook aligned across both files).*
