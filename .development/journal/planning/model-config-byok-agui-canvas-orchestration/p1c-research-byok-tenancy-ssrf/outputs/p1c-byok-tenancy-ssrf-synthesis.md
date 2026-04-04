# Phase 1C — BYOK, tenancy, and SSRF (research synthesis)

**task_id:** `p1c-research-byok-tenancy-ssrf`  
**Date:** 2026-04-04  
**Scope:** Controls and industry patterns for BYOK, platform vs future tenant precedence, and SSRF when OpenAI-compatible base URLs are user- or admin-supplied.

**Citations:** `../citation.yaml` (ids: `owasp-ssrf`, `litellm-virtual-keys`, `openrouter-byok`, `cloudflare-workers-fetch`, plus codebase refs).

---

## 1. BYOK as implemented (repository)

- **Storage:** Per-user **User Secrets** Durable Object (`env.UserSecretsStore`, stub from `idFromName(userId)`). Reads use `requestSecret({ provider, envVarName })` in `loadByokKeysFromUserVault` and `getUserProviderStatus` (`worker/api/controllers/modelConfig/byokHelper.ts`).
- **Template surface:** `getBYOKTemplates()` returns only templates with `category === 'byok'` (`worker/types/secretsTemplates.ts`). As of trace date: **openai**, **anthropic**, **google-ai-studio**, **cerebras**, **workers-ai** (Cloudflare token). Providers present in broader `getTemplatesData()` but **not** in the BYOK subset (e.g. some non-byok AI entries) are **outside** the vault loop used for BYOK key loading—alignment with inference and UI must be checked when adding providers.
- **Runtime precedence:** User D1 overrides and vault keys participate in `executeInference` / `runtimeOverrides` (see Phase 1A digest **§I.1** in the canonical bundle). **Gap:** not all code paths use `executeInference` (e.g. `realtimeCodeFixer`); BYOK parity there is a separate engineering item.

## 2. Tenancy model (today vs product direction)

- **Today:** Model policy and vault are **user-scoped**. No `agency`, `super_admin`, or `tenant` symbols appeared in `worker/**/*.ts` at Phase 1A/1C grep time—**no first-class org/agency layer** in the Worker tree for model routing.
- **Industry pattern (LiteLLM):** Virtual keys and access groups model **team vs user** budgets and model allowlists (`litellm-virtual-keys`). Useful reference if Landi adds **agency-admin** catalogs: assign bundles or gateways at org scope, then user or session scope underneath.
- **OpenRouter BYOK:** Documents coexistence of platform routing and customer-supplied keys (`openrouter-byok`)—product and support copy should state **which key pays** and **which retention/logging regime** applies.

## 3. SSRF: `testProvider` and future custom base URLs

- **Live surface:** `ModelProvidersController.testProvider` accepts **`baseUrl` + `apiKey`** and performs `fetch(\`${baseUrl}/models\`)` with `Authorization: Bearer` (`worker/api/controllers/modelProviders/controller.ts`, approx. 219–228). **Stored** provider testing by `providerId` returns **503**; the **direct URL** path remains callable.
- **CRUD:** `createProvider` / `updateProvider` / `deleteProvider` return **503** (direct users to BYOK)—so arbitrary **persistent** custom endpoints are disabled, but **probing** arbitrary URLs via `testProvider` is still possible for authenticated clients that reach this route.
- **Hardening themes (OWASP):** Prefer **allowlists** of hostnames or URL patterns; resolve hostnames and validate resolved IPs against **private/link-local** ranges; control **redirects** (deny or cap hops); apply **least privilege** headers and timeouts (`owasp-ssrf`).
- **Workers runtime:** Outbound `fetch` is standard Fetch API (`cloudflare-workers-fetch`); SSRF is not eliminated by the edge—**application policy** must restrict destinations.

## 4. Key hierarchy and audit (vault)

- Platform docs in-repo describe **User Secrets** encryption (MEK → UMK → DEK, XChaCha20-Poly1305, SQLite in DO). **Do not** log raw secrets or full keys in provider test responses; align admin audit events with **metadata only** (provider id, success/failure, latency).

## 5. UX consistency (cross-reference)

- **config-modal** and related strings: primary “Manage Keys” / BYOK entry may be disabled while other flows mention vault—bundle **§B** and Phase 3 feasibility note **503 / modal** tension; product should align copy with **actual** vault and `testProvider` behavior.

---

## Sources summary

| Topic | Primary refs |
|--------|----------------|
| SSRF prevention | `owasp-ssrf` |
| Multi-tenant keys / groups | `litellm-virtual-keys` |
| Customer BYOK routing | `openrouter-byok` |
| Worker outbound fetch | `cloudflare-workers-fetch` |
| Repo BYOK + test | `SRC-BYOK-VAULT`, `SRC-BYOK-TEMPLATES`, `SRC-PROVIDERS-TEST` |
