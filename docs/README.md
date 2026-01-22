# kod-psm docs

This directory summarizes how the monorepo is organized and how to work with it.

## Overview
- Monorepo of deployable apps (`apps/*`) and shared libraries (`libs/*`).
- TypeScript + pnpm workspaces.
- Deployments target Google Cloud Run via GitHub Actions.

## Structure
```
apps/           Deployable services (Cloud Run)
libs/           Shared libraries
infra/          Deployment config and infra helpers
scripts/        Repo automation (e.g., app scaffolding)
docs/           Documentation (this folder)
```

## Workspaces
`pnpm-workspace.yaml` includes:
- `apps/*`
- `libs/*`

Root scripts:
- `pnpm build` runs builds across all packages.
- `pnpm lint` and `pnpm format` run repo-wide tooling.
- `pnpm test` runs Jest (if configured in packages).

## Apps
Each app typically contains:
- `src/` source
- `tsconfig.json`
- `package.json`
- optional `iam.yaml` for IAM requirements

App creation:
- See `docs/create-an-app.md` or run `pnpm create:app`.

## Libraries
Shared code lives under `libs/*`, built with `tsc` and consumed via `workspace:*`.

## Infra + Deploy
- `infra/apps.yaml` lists apps and metadata used by CI/CD.
- `infra/cloudbuild.docker.yaml` drives Cloud Build image creation.
- GitHub Actions:
  - `deploy.yaml` builds and deploys changed apps on `main`.
  - `infra-check.yaml` ensures required infra for changed apps on PRs.

## Secrets
Secrets are stored in GCP Secret Manager.
- Local testing uses app-level `.env` files (do not commit).
- Details: `docs/secrets.md`.

## IAM
Apps can declare IAM needs in `apps/<app>/iam.yaml`.
- Details and format: `docs/iam-manifests.md`.

## Where to start
1) Read `README.md` in the repo root for a quick overview.  
2) Use `docs/create-an-app.md` to scaffold a new service.  
3) Check `infra/apps.yaml` for the current deployment inventory.

## More docs
- `docs/repo-layout.md` repo structure and key files
- `docs/development.md` local development workflow
- `docs/tooling.md` TypeScript, lint, format, and test notes
- `docs/libs.md` guidelines for shared libraries
