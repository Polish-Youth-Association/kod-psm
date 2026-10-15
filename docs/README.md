# kod-psm docs

This directory summarizes how the repo is organized and how to work with it.

## Overview
- `apps/psm-portal`: Next.js static export, deployed to GitHub Pages on merge to `main`.
- `wix-velo/`: Wix Velo backend source (data in Wix CMS), synced into the Wix site separately.
- TypeScript + pnpm workspaces.

## Structure
```
apps/psm-portal/   Staff portal (static export -> GitHub Pages)
wix-velo/          Wix Velo backend source + cutover runbook
docs/              Documentation (this folder)
```

## Deploy
- `.github/workflows/pages.yaml` builds `apps/psm-portal/out` and publishes it to GitHub Pages.
- `.github/workflows/security.yaml` runs report-only security scans on push to `main`.

## Secrets
- Portal build vars: `WIX_FUNCTIONS_BASE`, `GOOGLE_OAUTH_CLIENT_ID` (repo Actions variables).
- Backend secrets live in Wix Secrets Manager (see `wix-velo/README.md`).
- Local testing uses `.env` files (do not commit).

## More docs
- `docs/repo-layout.md` repo structure and key files
- `docs/development.md` local development workflow
- `docs/tooling.md` TypeScript, lint, format, and test notes
- `docs/portal.md` original portal design doc (written for the GCP era; architecture sections are outdated)
