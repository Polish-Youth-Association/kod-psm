# Repo layout

This repo is a pnpm workspace with a single app plus the Wix Velo backend source.

## Top-level folders
- `apps/psm-portal/` staff portal (Next.js static export)
- `wix-velo/` Wix Velo backend source; `wix-velo/reference/` holds template HTML kept from the retired services
- `docs/` documentation

## Key files
- `pnpm-workspace.yaml` workspace boundaries
- `package.json` root scripts and dev tooling
- `tsconfig.base.json` shared TypeScript defaults
- `.github/workflows/*.yaml` CI/CD pipelines
- `wix-velo/CUTOVER.md` GCP → GitHub Pages + Wix cutover runbook
