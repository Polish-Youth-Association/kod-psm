# Repo layout

This repo is a pnpm workspace monorepo with apps and shared libraries.

## Top-level folders
- `apps/` deployable services (Cloud Run)
- `libs/` shared code used by apps
- `infra/` deployment configuration and infra helpers
- `scripts/` repo automation (scaffolding, helpers)
- `docs/` documentation

## Key files
- `pnpm-workspace.yaml` workspace boundaries
- `package.json` root scripts and dev tooling
- `tsconfig.base.json` shared TypeScript defaults
- `tsconfig.json` repo-wide TS config (mostly for tooling)
- `infra/apps.yaml` app registry used by CI/CD
- `.github/workflows/*.yaml` CI/CD pipelines

## Apps
Each app should include:
- `src/` source
- `package.json` with build/start scripts
- `tsconfig.json`
- optional `iam.yaml`

## Libraries
Each library should include:
- `src/` source
- `package.json` with build script
- `tsconfig.json` with `declaration: true`
