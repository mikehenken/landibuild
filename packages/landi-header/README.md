# Vendored `@landi/header`

Cloudflare (and other CI) clones only this repo, so **`file:../landi-ui/...` is invalid**. This folder holds the **prebuilt ES bundle** from [landi-ui `packages/header`](https://github.com/mikehenken/landi-ui/tree/main/packages/header).

## Refresh after upstream changes

From `landi-ui/packages/header`:

```bash
bun install
bun run build
```

Then copy `dist/index.js` and `dist/index.js.map` into this directory’s `dist/`, bump `version` in `package.json` if needed, commit, and push.

The bundle inlines Lit and Supabase client usage; **no npm dependencies** are required for consumers.
