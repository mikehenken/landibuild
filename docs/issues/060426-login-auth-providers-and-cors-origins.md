# Login: auth providers vs server and CORS www/apex (06 Apr 2026)

## Symptoms

- Sign-in appeared broken: email/password failed with 403 while the UI still offered email, or browser showed CORS/network errors on API calls.

## Root causes

1. **`GET /api/auth/providers` mismatch** — The payload always set `providers.email: true` and `requiresEmailAuth: !hasOAuth`, while `POST /api/auth/login` rejects email/password whenever **any** OAuth/Supabase config is present (`hasOAuthProviders`). Users on Supabase-or-OAuth-only deployments could still see an email form or inconsistent flags.

2. **CORS origin list** — Only `https://${CUSTOM_DOMAIN}` was allowed. Visiting the same app on **`www.` vs apex** (or the inverse) is a different browser origin, so credentialed `fetch` to `/api/*` could be blocked.

## Fixes

| Area | Change |
|------|--------|
| `worker/api/controllers/auth/controller.ts` (`getAuthProviders`) | `providers.email` and `requiresEmailAuth` follow `!hasOAuthProviders(env)` so they match login/register. |
| `worker/config/security.ts` (`getAllowedOrigins`) | For `CUSTOM_DOMAIN`, allow both `https://host` and `https://www.host` (and apex when host is `www.`). |

## Operational notes

- **Supabase OAuth**: Redirect URL (e.g. `https://<your-host>/auth/callback`) must be allowlisted in the Supabase dashboard.
- **Bridge**: `POST /api/auth/supabase` skips CSRF when `Authorization: Bearer` is present (see `CsrfService.validateToken`).
