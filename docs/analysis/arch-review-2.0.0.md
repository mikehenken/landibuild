# LandiBuild pre-release architecture & code quality gate — v2.0.0

**Workspace:** `c:\Users\mikeh\Projects\landi\landibuild`  
**Review date:** 2026-04-04  
**Scope:** Git-modified paths per pre-release request (Worker + Vite SPA, auth, nav, preview, model config, deploy, wrangler, vite).

---

## Executive summary

Automated gates **passed** (`npm run typecheck`, `npm run lint`). The Supabase browser client + Worker bridge (`POST /api/auth/supabase`), Lit `landi-header` integration, WebSocket origin relaxation for localhost, and preview iframe sandbox updates are **architecturally coherent** with the existing Hono + cookie session model.

**Blocking / severe issues** are concentrated in **`scripts/deploy.ts`**: the ESM entry guard does not match Bun’s `process.argv[1]` / `import.meta.url` on Windows (verified locally), so **`bun scripts/deploy.ts` exits successfully without running deployment**. Additional deploy-step risks include **`db:generate` during deploy**, **secret material printed to stdout** when not in CI, and **Unix-only shell assumptions** (`rm -rf`, `find`, `chmod`).

Committed **`wrangler.jsonc` `vars.ALLOWED_EMAIL`** embeds a specific mailbox—operational and privacy risk for forks and shared repos.

**Gate verdict: PASS_WITH_FIXES** — ship only after addressing **CRITICAL** deploy entry and **HIGH** migration/secret/config items (or explicitly documenting exceptions).

---

## Typecheck output (full)

```
> landibuild@1.5.0 typecheck
> tsc -b --incremental --noEmit

```

Exit code: **0**

---

## Lint output (full)

```
> landibuild@1.5.0 lint
> eslint .

```

Exit code: **0**

---

## Issue list

| Severity | Location | Description | Recommended fix |
|----------|----------|-------------|-----------------|
| **CRITICAL** | `scripts/deploy.ts` ~2121–2126 | Entry guard `import.meta.url === \`file://${process.argv[1]}\`` does not hold on Windows (and generally mismatches absolute `file:///...` URL vs `argv` path). **Verified:** `import.meta.url` was `file:///C:/.../scripts/_argv-test.ts` while `process.argv[1]` was `C:\...\scripts\_argv-test.ts` → **match false**. Invoking `bun scripts/deploy.ts` can exit **0** with **no deployment** and little/no output. | Use a standard pattern, e.g. `import { pathToFileURL } from 'url'; import path from 'path';` then compare `import.meta.url` to `pathToFileURL(path.resolve(process.argv[1])).href`, or use `import.meta.main` if supported by your runtime, or invoke an explicit exported `main()` from `package.json` without a fragile string equality. Add a log line at startup so “no-op” exits are obvious. |
| **HIGH** | `scripts/deploy.ts` ~1933–1946 (`runDatabaseMigrations`) | Runs `bun run db:generate && bun run db:migrate:local && bun run db:migrate:remote` **after** deploy. `db:generate` can create or alter migration artifacts during CI/production—non-deterministic and risky. Ordering (local then remote) may not match your intended release process. | Split migration policy: generate only in dev/PR; deploy should apply **known** migrations (`db:migrate:remote` only) or use a dedicated migration job. Document and enforce in runbooks. |
| **HIGH** | `scripts/deploy.ts` ~536–540 | When AI Gateway token is created and `CI` is not set, the **raw token value is printed** to the console. | Never print full secrets; print only token id + instructions to rotate/store. Prefer secret manager or `wrangler secret` without echoing value. |
| **HIGH** | `wrangler.jsonc` ~156 (`vars.ALLOWED_EMAIL`) | Committed allowlist email in repo config propagates to all clones; easy to forget to override in production; privacy concern. | Move to secret or account-specific non-committed vars; default empty with explicit opt-in in docs. |
| **HIGH** | `scripts/deploy.ts` (multiple) | **Unix-only** commands: `rm -rf .wrangler`, `find dist ...`, `chmod +x deploy_templates.sh`. On Windows hosts these steps fail or no-op unpredictably. | Use `fs.rmSync` / `fs.readdir`+unlink, `fs.chmod` where needed, or shell through Git Bash with documented requirement; detect platform and branch. |
| **MEDIUM** | `AGENTS.md` vs `worker/database/services/AuthService.ts` | Project rule: services return `null`/`boolean` on error; **AuthService** throws `SecurityError` extensively; controllers catch and map to HTTP. This is consistent internally but **contradicts the documented rule**. | Either narrow the rule (“throw `SecurityError`, catch in controllers”) or refactor services to result types—pick one platform convention and align `AGENTS.md`. |
| **MEDIUM** | `src/routes/chat/components/preview-iframe.tsx` ~73–74 | `console.log` of full `Response` and **every response header** during availability tests—noisy and can leak implementation details in client consoles. | Remove or guard behind `import.meta.env.DEV`; log only status and `X-Preview-Type`. |
| **MEDIUM** | `wrangler.jsonc` ~21–24 | `observability.head_sampling_rate: 1` implies **100%** trace sampling—fine for early GA, costly at scale. | Tune per environment (lower in production) or document cost expectation. |
| **MEDIUM** | `worker/middleware/security/websocket.ts` ~39–44 | Missing `Origin` is allowed when `Authorization: Bearer` present—appropriate for server SDKs; ensure **browser** paths cannot omit Origin while impersonating a user token in unintended contexts. | Keep; add a short ADR comment that browser clients must send Origin and server clients use Bearer only over TLS. |
| **MEDIUM** | `src/routes/login.tsx` ~43–51 | `login(provider, '/')` forces intended redirect to `/`, losing deep-link return for users who bookmark `/login`. | Omit second arg so `login` uses current path, or pass `document.referrer` / stored return path consistently with `landi-header`. |
| **MEDIUM** | `src/routes/auth/supabase-callback.tsx` ~7 vs `src/contexts/auth-context.tsx` ~72 | Duplicate `INTENDED_URL_KEY` string—risk of drift if one changes. | Export a single constant from a small `auth-storage-keys` module. |
| **MEDIUM** | `scripts/deploy.ts` ~1148–1158, ~1327 | Uses `any` for route comparison and `userAppInstanceType`. Violates stated “no any” policy for scripts (eslint may not flag). | Define narrow interfaces for wrangler route entries and instance_type union (`string \| { vcpu; memory_mib; disk_mb? }`). |
| **LOW** | `src/contexts/auth-context.tsx` ~151, ~246, ~285 | `as AuthUser` assertions—acceptable if API types are trusted; slightly brittle if profile shape diverges. | Prefer zod/typed API response parsing shared with `api-types`. |
| **LOW** | `src/features/presentation/components/PresentationPreview.tsx` ~43–44 | `featureState[KEY] as boolean`—if keys are missing or wrong type, UI state can be wrong silently. | Validate with a type guard or default with `typeof === 'boolean'`. |
| **LOW** | `worker/agents/inferutils/core.ts` / `infer.ts` | `ToolDefinition<any, any>[]` (generics)—pre-existing pattern for tools. | Gradually parameterize tools or use `unknown` + narrowing at registration. |
| **LOW** | `vite.config.ts` ~30–42 | Disables containers on Win32 for Cloudflare Vite plugin—correct tradeoff; dev parity with Linux/WSL reduced. | Document in `docs/setup.md` that full container dev requires WSL. |

---

## Architecture assessment (concise)

### Worker / frontend separation

- **Auth:** Supabase PKCE in the browser (`supabase-browser-client.ts`) exchanges a short-lived access JWT for **httpOnly cookies** via `bridgeSupabaseSession` → `AuthController.bridgeSupabase` → `AuthService.exchangeSupabaseAccessToken` (JWT verify with `issuer` + `audience: 'authenticated'`). CSRF refresh after bridge matches existing cookie/CSRF patterns. **Sound.**

- **Platform nav:** `LandiPlatformNav` wraps `@landi/header` with env gate and route-based hide (`useLandiNavHidden`). Logout bridges `landi-header-sign-out` to `useAuth().logout`. **Sound**; watch for duplicate navigation on logout (header + app both navigating—likely OK).

### API / middleware

- `routeAuth.ts` ticket path + JWT path unchanged in structure; rate limit after standard auth remains.

### WebSocket security

- Localhost Origin bypass is **scoped** to HTTP + localhost hosts on both sides; production requests use real hostnames → **no broad origin relaxation**.

### Preview / presentation

- `allow-fullscreen` in iframe sandbox aligns with fullscreen presentation requirement; increases sandbox capability surface slightly—expected for slides.

### Model config / BYOK

- `byokHelper` uses `UserSecretsStore` with trimmed templates; failures degrade to empty keys / `hasValidKey: false`—**defensive**.

---

## Gate verdict

**PASS_WITH_FIXES**

**Justification:** Typecheck and lint are clean; auth bridge and UI integration are structurally sound. **The deploy script entry guard is a release blocker** if teams rely on `npm run deploy` / `bun scripts/deploy.ts` (silent no-op observed on Windows). Resolve CRITICAL/HIGH deploy and configuration issues—or explicitly remove/replace the deploy path before calling this a production gate **PASS**.

---

## Self-review notes

- Re-ran `npm run typecheck` and `npm run lint` successfully.
- Independently verified ESM `import.meta.url` vs `file://${process.argv[1]}` mismatch with a minimal Bun script under the same repo (`match false` on Windows).
- Did not exhaustively line-review every modified file; focused on architecture, auth, security boundaries, deploy, and wrangler/vite per mission.
