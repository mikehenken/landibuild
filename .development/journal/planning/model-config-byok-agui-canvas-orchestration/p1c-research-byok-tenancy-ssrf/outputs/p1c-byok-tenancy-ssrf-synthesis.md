# Phase 1C — BYOK, tenancy, and SSRF (research synthesis)

**task_id:** `p1c-research-byok-tenancy-ssrf`  
**Date:** 2026-04-04 (refresh/expand)  
**Scope:** BYOK key hierarchy and storage, platform vs future tenant precedence, and **explicit SSRF** controls for OpenAI-compatible and other user-influenced base URLs (allowlist, DNS, redirects, Workers `fetch` behavior).

**Citations:** `../citation.yaml` (AMA-style ids: `OWASP-CSS-SSRF-Prevention`, `WHATWG-Fetch-RequestRedirect`, `Cloudflare-Docs-Workers-Fetch`, `Cloudflare-Docs-Workers-CompatFlags-GlobalFetchStrictlyPublic`, `LandiBuild-WORKER-ModelProvidersController`, etc.).

---

## 1. BYOK key hierarchy and repository implementation

### 1.1 Storage and isolation

- **Durable Object:** Per-user **User Secrets** store (`env.UserSecretsStore`). The Worker obtains a stub with `ns.get(ns.idFromName(userId))` so **cryptographic scope is per user id**, not per session (`LandiBuild-WORKER-ByokHelper`).
- **Read path:** `loadByokKeysFromUserVault` and `getUserProviderStatus` iterate `getBYOKTemplates()` and call `stub.requestSecret({ provider, envVarName })` for each template. Values pass `looksLikeApiKey` (length, non-placeholder) before being treated as usable keys (`LandiBuild-WORKER-ByokHelper`).

### 1.2 Template / provider surface (BYOK subset)

- **`getBYOKTemplates()`** returns only templates with `category === 'byok'` (`LandiBuild-WORKER-SecretsTemplates-BYOK`). Current BYOK rows: **openai**, **anthropic**, **google-ai-studio**, **cerebras**, **workers** (Workers AI token; `provider` string is `workers`, not `workers-ai`).
- Templates under **`category: 'ai'`** (non-BYOK) are **not** loaded by this vault loop. Any new provider must align **secrets template category**, **inference key resolution**, and UI, or BYOK and chat will disagree on availability.

### 1.3 Encryption hierarchy (documented elsewhere)

- **CLAUDE.md** (repo root) describes **User Secrets** encryption: **MEK → UMK → DEK**, **XChaCha20-Poly1305**, SQLite inside the DO. **Tests:** `LandiBuild-TEST-Secrets` exercise store contracts.
- **Operational implication:** BYOK material never belongs in application logs, `testProvider` error bodies, or analytics events—only success/failure metadata and latency.

### 1.4 Runtime precedence (inference)

- User D1 model config and vault keys feed **`executeInference` / `runtimeOverrides`** (Phase 1A digest §I.1; see `LandiBuild-WORKER-ByokHelper` and infer stack in p1a citations).
- **Gap (unchanged):** Not every caller uses `executeInference` (e.g. `realtimeCodeFixer.ts` per p1a); BYOK parity on those paths is an engineering follow-up, not solved by vault alone.

### 1.5 Two different “test provider” concepts

| Mechanism | User-controlled base URL? | Location |
|-----------|---------------------------|----------|
| **HTTP `testProvider`** | **Yes** — `baseUrl` optional in body, concatenated to `/models` | `LandiBuild-WORKER-ModelProvidersController` |
| **`ModelTestService.testProviderKey`** | **No** — fixed `infer()` model per provider string | `LandiBuild-WORKER-ModelTestService` |

Do not conflate these when threat-modeling SSRF: only the **controller** path issues `fetch` to an arbitrary URL-shaped input.

---

## 2. Tenancy model (today vs product direction)

### 2.1 Today: user-scoped only

- Model policy APIs and vault access are **authenticated user** scoped (`LandiBuild-WORKER-ModelProviderRoutes` uses `AuthConfig.authenticated` for all `/api/user/providers*` routes).
- **Ripgrep** on `worker/**/*.ts` for `agency`, `superAdmin`, `super_admin`, `tenant`: **no matches** (2026-04-04; see `inferred` in `citation.yaml`). There is **no first-class org/agency layer** in the Worker tree for model routing under those names.

### 2.2 Industry patterns (future agency / multi-tenant admin)

- **LiteLLM virtual keys** — team budgets, model allowlists, and grouped access (`LiteLLM-Docs-VirtualKeys`). Useful analogy if Landi adds **agency-admin** catalogs: org-level gateway or bundle, then user or session scope beneath.
- **OpenRouter BYOK** — coexistence of platform routing and customer keys; product copy should clarify **which key is billed** and **logging/retention** (`OpenRouter-Docs-BYOK`).

---

## 3. SSRF: `testProvider`, OpenAI-compatible URLs, and Workers `fetch`

### 3.1 Ground truth in `modelProviders/controller.ts`

**Validation**

- `testProviderSchema`: optional `providerId`, optional `baseUrl` (must be URL if present), optional `apiKey`; **refine** requires either `providerId` or **both** `baseUrl` and `apiKey` (`LandiBuild-WORKER-ModelProvidersController`, lines 37–44).

**Disabled paths**

- **`providerId` only:** returns **503** with message to supply `baseUrl` and `apiKey` directly (lines 209–213).
- **CRUD:** `createProvider`, `updateProvider`, `deleteProvider` return **503** and direct users to BYOK / vault (lines 117–120, 156–159, 179–182). **Persistent** custom provider records with arbitrary `baseUrl` are not created through this API while disabled.

**Active SSRF-relevant path**

- When `baseUrl` + `apiKey` are supplied, the Worker runs:

```219:228:worker/api/controllers/modelProviders/controller.ts
            const startTime = Date.now();
            try {
                const testUrl = `${baseUrl.replace(/\/$/, '')}/models`;
                const response = await fetch(testUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
```

- **Observations**
  - **No** host allowlist, **no** resolved-IP checks, **no** `redirect: 'manual'` or `'error'` — default **`follow`** behavior applies unless the runtime changes it (`WHATWG-Fetch-RequestRedirect`).
  - **No** explicit timeout on `fetch` (hang risk and slowloris-style abuse).
  - **`z.string().url()`** accepts any syntactically valid URL the library allows (including schemes/hosts that point at metadata endpoints, redirectors, or internal hostnames if resolvable from the edge).
  - **Authenticated** callers only (`LandiBuild-WORKER-ModelProviderRoutes`), which limits exposure to **signed-in accounts** but does **not** remove SSRF class issues (server egress, scanning, chaining with redirects).

### 3.2 OWASP-aligned controls (application layer)

From **`OWASP-CSS-SSRF-Prevention`**, priorities for this pattern map cleanly:

1. **Allowlist** hostnames or URL prefixes for “OpenAI-compatible” bases (e.g. known gateways, self-hosted domains on contract).
2. **DNS resolution and IP validation** after parsing URL: block **private, link-local, loopback, CGNAT, cloud metadata** ranges as appropriate for your threat model (OWASP emphasizes validating the **resolved** address, not just the string).
3. **Redirects:** disable automatic following or cap hops; re-validate each hop’s host/IP (`OWASP-CSS-SSRF-Prevention`; `WHATWG-Fetch-RequestRedirect`).
4. **Network segmentation / egress** is a platform complement; on Workers, **policy in code** remains mandatory (`Cloudflare-Docs-Workers-Fetch`).

### 3.3 Cloudflare Workers `fetch` (constraints and non-constraints)

- Outbound requests use the **standard Fetch API** (`Cloudflare-Docs-Workers-Fetch`). Workers does not automatically “SSRF-proof” user-supplied URLs.
- **`global_fetch_strictly_public`:** affects how **global `fetch`** routes for certain same-zone URLs (public Internet vs zone origin). It is a **routing/behavior** flag, **not** an application allowlist (`Cloudflare-Docs-Workers-CompatFlags-GlobalFetchStrictlyPublic`). SSRF defenses still belong in validation logic before `fetch`.

### 3.4 Abuse and product notes

- **503 CRUD** reduces long-lived arbitrary endpoints in D1 but **does not** close the **probe** channel via `POST /api/user/providers/test` with `baseUrl` + `apiKey`.
- Frontend: `src/lib/api-client.ts` exposes `'/api/user/providers/test'` — any UI that calls it inherits the same trust boundary.
- **Error responses** currently may surface `response.text()` from the upstream on non-OK status (lines 238–241); consider **redacting** bodies in production to avoid leaking third-party error pages into client-visible messages.

---

## 4. Audit and logging

- Align provider **test** and **inference** audit events with **metadata only** (provider id or hashed host, success/failure, latency)—never raw `apiKey` or full upstream response bodies for arbitrary URLs.
- Vault operations remain governed by the User Secrets DO semantics (`LandiBuild-TEST-Secrets`, CLAUDE.md).

---

## 5. UX consistency (cross-reference)

- **503** on custom provider CRUD vs still-active **direct `baseUrl` test** can confuse users (“providers disabled” but URL test works). Product copy and modals should match **actual** routes (`Phase 3` / config-modal tension in planning bundle).

---

## Sources summary

| Topic | Citation id |
|--------|-------------|
| SSRF prevention (allowlist, DNS, redirects) | `OWASP-CSS-SSRF-Prevention` |
| Fetch redirect modes | `WHATWG-Fetch-RequestRedirect` |
| Multi-tenant keys / groups | `LiteLLM-Docs-VirtualKeys` |
| Customer BYOK routing | `OpenRouter-Docs-BYOK` |
| Worker outbound fetch | `Cloudflare-Docs-Workers-Fetch` |
| Same-zone fetch routing flag | `Cloudflare-Docs-Workers-CompatFlags-GlobalFetchStrictlyPublic` |
| BYOK vault + templates | `LandiBuild-WORKER-ByokHelper`, `LandiBuild-WORKER-SecretsTemplates-BYOK` |
| SSRF-surface controller + routes | `LandiBuild-WORKER-ModelProvidersController`, `LandiBuild-WORKER-ModelProviderRoutes` |
| infer()-based provider test (no arbitrary URL) | `LandiBuild-WORKER-ModelTestService` |
| Secrets tests / crypto story | `LandiBuild-TEST-Secrets` |
