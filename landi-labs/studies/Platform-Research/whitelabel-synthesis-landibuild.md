---
doc_type: study
title: LANDiBUILD whitelabel and agency branding synthesis
description: >-
  Implementer-oriented phased checklist for immediate LANDiBUILD shell branding,
  deferred agency-driven config aligned with landing-editor, community signals from
  parallel-cli research, and risk inventory (vault, WebAuthn, package strings).
created_at: 2026-04-03
artifact_type: synthesis-guide
study_id: landibuild-whitelabel-platform-research
workflow_name: landibuild-coordinator-whitelabel-research
tags:
  - whitelabel
  - landibuild
  - vibesdk
  - landing-editor
related_docs:
  - landi-labs/studies/Platform-Research/vibesdk-whitelabel-search-1.json
  - landi-labs/studies/Platform-Research/vibesdk-saas-branding-search-2.json
  - landi-labs/studies/Platform-Research/vibesdk-github-fork-search-3.json
  - landi-labs/studies/Platform-Research/vibesdk-github-extract.json
  - landi-labs/studies/Platform-Research/vibesdk-readme-extract.json
---

# LANDiBUILD whitelabel and agency branding synthesis

This document consolidates **parallel-cli** web research (Windows `cmd.exe /c` + `PYTHONUTF8=1`), **read-only** reconnaissance of **landing-editor**, and **landibuild** code touchpoints so a future implementer can execute Phase 1 shell changes and Phase 2+ agency pull without thrash.

## 1. User goals (traceability)

| Goal | Scope |
|------|--------|
| **Immediate LANDiBUILD shell** | Top-left branding → `public/logobuild.png`; remove fork/deploy banner (top right); centered logo at top of left sidebar; document title → `LANDiBUILD`. |
| **Future agency white label** | landing-editor **App Configuration** / agency settings supplies branding; landibuild **pulls** that config (sub-branding), not a second source of truth. |
| **Fork context** | landibuild remains a **VibeSDK fork**; rebranding is product UX, not a claim to upstream ownership. |

## 2. Community and primary sources (Gap A)

**Method:** `parallel-cli search` (three queries, 12 results each) and `parallel-cli extract` on GitHub; outputs under `landi-labs/studies/Platform-Research/`.

**Artifacts:**

- `vibesdk-whitelabel-search-1.json`
- `vibesdk-saas-branding-search-2.json`
- `vibesdk-github-fork-search-3.json`
- `vibesdk-github-extract.json`
- `vibesdk-readme-extract.json`

**What people actually say (synthesis):**

1. **Official narrative** is **self-host / “your own platform”**, not “white label” wording. Cloudflare’s launch post explicitly mentions **internal use**, **website builder** embedding, and **SaaS companies** letting customers customize—i.e. commercial reuse is part of the story, but branding/attribution policy is **not** spelled out in search snippets. Primary reference: [Deploy your own AI vibe coding platform — in one click!](https://blog.cloudflare.com/deploy-your-own-ai-vibe-coding-platform/).
2. **Third-party tutorials** (e.g. Sabrina.dev, Medium) emphasize **MIT License**, **monetize without restriction**, **custom domain**, and **Deploy to Cloudflare**—again, not a thread on “how to remove upstream UI.”
3. **GitHub / README extract:** **MIT** referenced; **“Deploy to Cloudflare”** / **fork-via-deploy** flow is prominent; **CUSTOM_DOMAIN** and customization of AI/components appear; **no** “white label” phrase in extracted excerpts. Treat **LICENSE** in `cloudflare/vibesdk` as the legal source of truth for attribution; UI fork banner removal is a **product** decision, not something parallel-cli result sets document.
4. **Reddit/Product Hunt:** Mix of excitement, **reliability complaints**, and **cost/plan** friction—not a curated answer on rebranding compliance.

**Gap (explicit):** There is **no dense public corpus** answering “must we keep a fork banner?” Implementers should **read upstream LICENSE + CONTRIBUTING** and record any notice requirements in their own compliance notes. Community search supports **“fork and run your own”** as the norm, not **“white-label SaaS playbook.”**

## 3. landing-editor alignment (Gap B)

**Path verified:** `C:\Users\mikeh\Projects\landi\landing-editor` exists.

**Existing patterns landibuild should mirror when pulling agency config:**

| Area | landing-editor reality |
|------|-------------------------|
| **Settings UI** | `src/app/agency/settings/page.tsx` — tabs include **branding**, domain (**whitelabel** copy), billing, team, etc.; updates **`agencies`** via Supabase client. |
| **Tenant resolution** | `src/proxy.ts` — host-based lookup; RPC **`lookup_agency_branding`**; headers **`x-agency-id`**, **`x-agency-branding`**, **`x-agency-name`**; uses **`NEXT_PUBLIC_ROOT_DOMAIN`**. |
| **Branding shape** | `src/types/agency.ts` — **`Agency['branding']`** (logo, colors, favicon, css, `company_name`, `landing_page_url`, `enable_prompt_branding`, etc.); **`email_branding`** column in migrations. |
| **Client merge** | `BrandingProvider.tsx` + `src/lib/branding.ts` — **platform_settings.branding** defaults merged with **agency** overrides. |
| **Upload API** | `src/app/api/agency/branding/upload/route.ts` — multipart to storage, returns public URL. |
| **Domain verify** | `src/app/actions/verify-domain.ts` — **`verifyAgencyCNAME`**; aligns with **`settings.custom_domain`** / verification flags. |

**Gaps in landing-editor (for roadmap, not blockers here):** No single REST **`GET/PATCH /api/agency/branding`** documented as canonical; many reads/writes are **direct Supabase** from pages. landibuild may need a **small BFF** or shared package if it cannot hold Supabase credentials.

**Contract ideas for landibuild “pull” later:**

1. **DTO:** Match **`Agency['branding']`** (+ optional **`email_branding`**) as the JSON shape.
2. **Resolution:** Reuse **`lookup_agency_branding(check_domain, check_slug)`** semantics or the same header injection pattern behind a gateway.
3. **Optional HTTP:** Introduce or consume **`GET /api/agency/branding`** (session + membership) so landibuild does not duplicate Supabase policy logic.

## 4. landibuild today (no tenant model)

- Branding is **static** (components, `index.html`, strings).
- **Extension points** called out in prior exploration still apply: **capabilities API**, **global-header**, **`index.html` / meta**, **CSS tokens**, **wrangler vars**, **FeatureProvider** bootstrap.

## 5. Phased implementer checklist

### Phase 0 — Compliance snapshot (short)

- [ ] Read upstream **`LICENSE`** (and any **NOTICE** files) in the fork baseline; record whether MIT notice must be preserved in **distributed** artifacts (e.g. `NOTICE`, about screen, footer). *Not a substitute for legal review.*

### Phase 1 — Immediate LANDiBUILD shell (static / build-time)

**Intent:** No agency API yet; ship **`public/logobuild.png`**, title, and remove upstream promo chrome.

| Task | Likely files / notes |
|------|----------------------|
| Document title + default meta | `index.html` — today `<title>Build</title>`; set to **LANDiBUILD** (and optionally meta description). |
| Top-left logo (authenticated header) | `src/components/layout/global-header.tsx` — replace **`CloudflareLogo`** beside **`SidebarTrigger`** with `<img src="/logobuild.png" … />` or a small `LandiBuildLogo` component. |
| Fork / deploy banner | `global-header.tsx` — remove or gate the block with **“Deploy your own vibe-coding platform”** and Deploy/Fork buttons (lines ~90–99 in current tree). |
| Sidebar top-centered logo | `src/components/layout/app-sidebar.tsx` — add a **header row** inside **`SidebarContent`** (above “Build” / first group), centered when expanded, icon-safe when collapsed (tooltip). |
| Favicon (optional but cohesive) | `index.html` `<link rel="icon">` if `logobuild.png` should also drive favicon (may need `favicon.ico` regeneration). |

**Deferred in Phase 1 (do not block shell):** Monaco theme ids `'vibesdk'` / `'vibesdk-dark'` are **internal editor theme names**, not user-facing product name—rename only if you want consistency across logs/docs.

### Phase 2 — Static env / wrangler (single-tenant fork)

| Task | Notes |
|------|--------|
| **Branding vars** | Add e.g. `VITE_PUBLIC_APP_NAME`, `VITE_PUBLIC_LOGO_URL` (or project’s existing Vite env convention) and wire header/sidebar/title from env for **one deployment = one brand**. |
| **Worker vars** | Mirror any user-visible strings returned from worker (error messages, capability copy) if applicable. |

### Phase 3 — Runtime API pull (agency sub-brand)

| Task | Notes |
|------|--------|
| **AuthN/Z** | landibuild must know **which agency** the user belongs to (session JWT claims, cookie, or gateway headers). |
| **Fetch branding** | Call landing-editor **BFF** or **Supabase** read-only path; cache at edge (KV) with TTL if needed. |
| **Apply** | Single **`BrandingContext`** (or extend **FeatureProvider**) feeding header, sidebar, `document.title`, and CSS variables—mirror **BrandingProvider** precedence: platform default → agency override. |

### Phase 4 — D1 / multi-tenant (only if product requires it)

- If landibuild introduces **per-tenant rows** in **D1**, treat that as a **separate** decision from landing-editor’s **Postgres/Supabase** agencies table; avoid two masters. Prefer **landing-editor as SoT** unless landibuild must run fully disconnected.

## 6. Risk register

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Vault HKDF label** | `src/lib/vault-crypto.ts` uses HKDF **info** string **`vibesdk-vault-vmk`**. Changing it **derives different keys** → existing vaults **break**. | Keep label until a **migration** plan exists (re-wrap keys), or version the vault schema. |
| **WebAuthn `rp.name`** | `src/contexts/vault-context.tsx` sets **`rp: { name: 'vibesdk', id: hostname }`**. Changing **`rp.id`** breaks existing credentials; changing **`name`** is mostly UX but should match shipped product name for user trust. | Plan **LANDiBUILD** (or agency name) carefully; avoid **`rp.id`** changes without migration. |
| **User-facing “VibeSDK” strings** | e.g. `src/routes/settings/index.tsx` (“VibeSDK API Keys”), Monaco theme labels, chat `theme: 'vibesdk'`. | Triage: **marketing** vs **internal** vs **breaking** (vault). |
| **Package rename** | `package.json` name and publish scope affect **imports**, **CI**, **Workers** metadata. | Scoped change; not required for Phase 1 UI. |
| **Capabilities / bootstrap** | Any hard-coded **Cloudflare** / **VibeSDK** in **FeatureProvider** or API responses should be audited in the same pass as header. | Grep `src`, `worker`, `docs`. |

## 7. File lists

### Phase 1 — LANDiBUILD shell (high confidence)

- `public/logobuild.png` (asset; already tracked in git status as untracked — ensure committed when implementing)
- `index.html`
- `src/components/layout/global-header.tsx`
- `src/components/layout/app-sidebar.tsx`

### Phase 2+ — strings / infra (sample; non-exhaustive — grep before shipping)

- `src/routes/settings/index.tsx`
- `src/lib/vault-crypto.ts`
- `src/contexts/vault-context.tsx`
- `src/components/monaco-editor/monaco-editor.tsx`
- `src/routes/chat/components/main-content-panel.tsx`, `src/routes/app/index.tsx` (Sandpack/theme)
- `package.json`, `wrangler.toml` / `wrangler.jsonc`, worker entrypoints, `README.md` / docs

### landing-editor — read-only reference (no edits in this study)

- `src/app/agency/settings/page.tsx`
- `src/proxy.ts`
- `src/types/agency.ts`
- `src/components/BrandingProvider.tsx`
- `src/lib/branding.ts`
- `src/app/api/agency/branding/upload/route.ts`
- `src/app/actions/verify-domain.ts`
- `supabase/migrations/*lookup_agency_branding*`, `*email_branding*`

## 8. Remaining uncertainties

1. **Legal notice:** Whether MIT requires **visible** attribution in the **UI** for your distribution model—**not** answered by parallel-cli; verify against **LICENSE** and counsel if needed.
2. **Agency API surface:** landing-editor may need a **stable read API** for landibuild; today much is **Supabase-direct**.
3. **Existing passkeys:** Any production users with **`rp.name: 'vibesdk'`** credentials need a **communication** if passkey labels change.

---

*Generated by coordinator-led research (shell + explore subagents); product code intentionally not modified in this pass.*
