# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Overview

This is a **pnpm workspaces** repo for the Polish Youth Association (PSM) staff portal.

- `apps/psm-portal` — the only app: Next.js static export, deployed to **GitHub Pages**
- `wix-velo/` — version-controlled source for the **Wix Velo** backend (data in **Wix CMS**)
- `wix-velo/reference/` — email/signature HTML and delegation codes kept from the retired Cloud Run
  services; source material for `wix-velo/backend/templates.js` and `email.js`

The old Cloud Run services (`apps/*` other than the portal) and `libs/*` were removed — nothing
deployed or called them after the cutover to Wix. See `wix-velo/CUTOVER.md` and git history.

## Common Commands

```bash
pnpm install
pnpm --filter @kod-psm/psm-portal run dev
pnpm --filter @kod-psm/psm-portal run build   # static export -> apps/psm-portal/out
pnpm --filter @kod-psm/psm-portal run lint
```

## Architecture

### psm-portal — the user-facing hub

All user-facing UI lives in psm-portal. It is a static export with no API routes: pages call the
Wix Velo backend directly via `src/lib/wixApi.ts` (`NEXT_PUBLIC_WIX_FUNCTIONS_BASE`), sending the
Google Sign-In ID token as a bearer token.

Pages:
- `/` — home with tool cards
- `/volunteer-onboarding` — volunteer onboarding form
- `/member-onboarding` — member welcome email form
- `/onboarding-queue` — pending member queue (approve / delete)
- `/chat` — AI assistant (Groq via Velo)

See `apps/psm-portal/CLAUDE.md` for full details.

### wix-velo — the backend

`wix-velo/backend/http-functions.js` is the browser-facing surface (`/_functions/<name>`). Every
handler must call `assertPsmStaff` (`backend/auth.js`) first — it is the only security boundary.
The code is synced into the Wix site separately (`wix dev`/`wix push` or Studio↔GitHub); merging to
`main` does not deploy it. See `wix-velo/README.md`.

### psm-portal specifics

- Uses **Next.js App Router** (`src/app/`).
- Tailwind CSS with PSM brand tokens (`brand-red: #C8102E`, etc.) defined in `tailwind.config.ts`.
- PostCSS config must stay as **`postcss.config.js` (CJS)** — Next.js build workers use `require()` to load it; `.mjs` breaks the build.
- `output: "export"` (static export for GitHub Pages).
- `turbopack.root` is set to the monorepo root in `next.config.ts` to fix Turbopack's workspace root detection.

### Node.js 22 + Next.js 16 Compatibility Patch

`apps/psm-portal/scripts/patch-next-node22.js` runs as a `postinstall` hook and applies three fixes:
1. Adds `"type":"commonjs"` to all `next/dist/compiled/*/package.json` files.
2. Creates `@opentelemetry/api/build/esm/package.json` with `{"type":"module"}`.
3. Clears `.next/cache/turbopack` to prevent stale cache entries.

### Deployment

- **Merge to `main` → auto-deploy.** `.github/workflows/pages.yaml` builds the `psm-portal`
  static export and publishes it to **GitHub Pages**.
- Backend runs on **Wix Velo** (functions + Secrets Manager); data in **Wix CMS**. No Cloud Run,
  Artifact Registry, Cloud Build, WIF, or Terraform.
- `security.yaml` runs report-only security scans on push to `main`.

### Environment / Secrets

- Portal: `NEXT_PUBLIC_WIX_FUNCTIONS_BASE` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (repo Actions vars in CI).
- Backend: Wix Secrets Manager (see `wix-velo/README.md`).
- Never commit `.env` files.
