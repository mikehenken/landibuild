# AGENTS.md

This will become part of landi platform https://landi.build
Primary landi.build codebase is in ~/Projects/landi/landing-editor 
The rest live in ~/Projects/landi/landi-docs, ~/Projects/landi/landi-ui, ~/Projects/landi/landi-infra, ~/Projects/landi/landi-ai-orchestrator


## Deployment
- **Production (this fork):** Cloudflare is **connected to the GitHub repository** (e.g. Workers Builds). Pushing/merging to the configured branch deploys the Worker; there is typically **no** deploy workflow under `.github/workflows/` for that path.
- **Manual / scripted:** `bun run deploy` uses `scripts/deploy.ts` and `.prod.vars` (see `README.md`). Prefer the Git-linked pipeline unless you are intentionally deploying locally or from CI that mirrors it.

## Build/Test/Lint Commands
- **Build:** `npm run build` (tsc + vite)
- **Typecheck:** `npm run typecheck`
- **Lint:** `npm run lint`
- **Test all:** `npm run test`
- **Test single file:** `npx vitest run path/to/file.test.ts`
- **Test watch:** `npm run test:watch`
- **Dev servers:** `npm run dev` (frontend), `npm run dev:worker` (backend)

## Code Style
- **No `any` type** - find or create proper types
- **Types:** Frontend imports from `@/api-types` (single source of truth)
- **Formatting:** Prettier with single quotes, tabs (see package.json)
- **Naming:** React components `PascalCase.tsx`, utilities/hooks `kebab-case.ts`, backend services `PascalCase.ts`
- **Comments:** Explain purpose, not narration. No verbose AI-like comments. No emojis.
- **DRY:** Search for existing code before creating new. Never copy-paste.
- **Imports:** Frontend APIs in `src/lib/api-client.ts`, types in `src/api-types.ts`

## Error Handling
- Backend services return `null`/`boolean` on error, never throw in RPC methods
- Use existing error classes from `worker/utils/ErrorHandling.ts`

## Key Patterns
- **Add API endpoint:** types in `src/api-types.ts` -> `src/lib/api-client.ts` -> service in `worker/database/services/` -> controller in `worker/api/controllers/` -> route in `worker/api/routes/`
- **Add LLM tool:** create in `worker/agents/tools/toolkit/` -> register in `worker/agents/tools/customTools.ts`
