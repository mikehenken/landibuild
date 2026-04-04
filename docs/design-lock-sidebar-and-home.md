# Design lock: sidebar and home main content

**Status:** Locked as of 2026-04-04. Do not change layout, colors, or closed/open sidebar behavior without an explicit product or design decision.

## Scope

- **Sidebar:** `AppSidebar`, shadcn `Sidebar` shell, `collapsed-sidebar-trigger`, `sidebar-overrides.css`.
- **Home main area:** `/` route hero, prompt card, background (no dotted pattern).

## Sidebar (reference)

- **Width (expanded):** `240px` (`--sidebar-width` in `app-layout.tsx`).
- **Background:** `rgb(22, 23, 23)` / `#161817` (inner surface + mobile sheet).
- **Closed (desktop):** `collapsible="offcanvas"` — no visible rail; only `CollapsedSidebarTrigger` (top-left). No `icon` strip.
- **Logo (expanded):** `public/logo-red.png`, centered in header; toggle remains usable (e.g. absolute right).
- **Menu text:** Base menu sizing uses `calc(1em + 0.15em)` where specified; “New Chat” label is 15% smaller than that (`calc((1em + 0.15em) * 0.85)`).
- **Guests:** Sidebar renders when logged out; chat history empty state + `AuthButton`; settings gear only when authenticated.

## Home main content (reference)

- **Page background:** Solid `#121212` (no dot/grid overlay on the hero shell).
- **Prompt form:** Fill `#1f1f1f`, border `rgba(255, 255, 255, 0.84)`.
- **Hero mark:** Logo image (`landibuild-logo.png` or as specified in code), not the old headline string.

## Key files

| Area | Files |
|------|--------|
| Layout | `src/components/layout/app-layout.tsx`, `app-sidebar.tsx`, `collapsed-sidebar-trigger.tsx`, `sidebar-overrides.css` |
| Shell primitives | `src/components/ui/sidebar.tsx` |
| Home | `src/routes/home.tsx` |
| Auth in sidebar | `src/components/auth/auth-button.tsx` |
| Assets | `public/logo-red.png`, `public/landibuild-logo.png` |

## Mockups (repo)

Reference JPEGs under `public/` (e.g. `landi.build-sidebar-closed.jpeg`, `landi.build-sidebar-.jpeg`) — use for regression checks, not as runtime assets unless imported in code.
