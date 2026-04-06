# Local D1 migrations stamp + model catalog revision resilience (06 Apr 2026)

## Symptom

Local dev could hit D1 errors such as missing table `model_config_global_revision`, cascading into agent/worker failures.

## Model catalog revision service

`worker/services/model-catalog/ModelCatalogRevisionService.ts`

- `getRevision` (or equivalent read path): tolerate missing `model_config_global_revision` table with a warning and revision `0` so cold local DBs do not hard-fail.
- `bumpRevision` and other writes should still surface clear errors if schema is missing.

## Local migration ensure script

`scripts/ensure-local-d1-migrations.ts` (untracked/new in branch)

- Computes a checksum of `migrations/*.sql` and stores a stamp under `.wrangler/state/`.
- Skips `wrangler d1 migrations apply` when checksum matches and local D1 dir exists.
- `FORCE_D1_MIGRATE=1` forces apply.

## npm / setup wiring

- `package.json`: `predev` runs `tsx scripts/ensure-local-d1-migrations.ts`; `db:ensure-local` alias.
- `db:migrate:local` uses `CI=true` for non-interactive apply.
- `scripts/setup.ts`: local DB step can invoke `db:ensure-local` with `FORCE_D1_MIGRATE=1` where appropriate.

## Migrations

Schema fixes live under `migrations/` (e.g. `0005_model_catalog_revision.sql`, `0006_user_model_config_presets.sql`). Remote/production still requires explicit remote migrate/deploy.

## Verification

- Fresh clone: `npm run dev` or `npm run db:ensure-local` should apply migrations when needed; revision reads should not crash on empty local schema.
- Second run: ensure script should skip when stamp matches (unless forced).
