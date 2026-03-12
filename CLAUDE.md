# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a **pnpm workspaces** monorepo for the Polish Youth Association (PSM) platform. There is no Turborepo — orchestration is done via pnpm workspace filters.

- `apps/` — 7 deployable services, each deployed independently to **Google Cloud Run**
- `libs/` — 2 shared TypeScript packages (`@kod-psm/http-helpers`, `@kod-psm/gcp-helpers`)
- All packages use the `@kod-psm/` namespace

## Common Commands

```bash
# Install all workspaces
pnpm install

# Run a specific app in dev mode
pnpm --filter @kod-psm/psm-portal run dev
pnpm --filter @kod-psm/member-onboarding run dev

# Build a specific app
pnpm --filter @kod-psm/psm-portal run build

# Build all apps and libs
pnpm build

# Lint / format (runs across all workspaces)
pnpm lint
pnpm format

# Tests
pnpm test

# Scaffold a new app
pnpm create:app
```

To run a single Jest test file:
```bash
pnpm --filter @kod-psm/<package> run test -- --testPathPattern=<file>
```

## Architecture

### Service Layout

| App | Role | Stack |
|-----|------|-------|
| `psm-portal` | Frontend hub / admin portal | Next.js 16, React 19, Tailwind CSS, App Router |
| `member-onboarding` | Full-stack onboarding form + email | Express, React 18, Vite, Nodemailer, Multer |
| `certificate-generator` | PDF certificate creation + storage | Express, pdf-lib, pdfkit, `@kod-psm/gcp-helpers` |
| `persist-member` | Write member data to Firestore | Express, Firebase Admin, Zod, `@kod-psm/http-helpers` |
| `volunteer-onboarding` | Provision Google Workspace, Slack, groups | Express, googleapis, `@kod-psm/http-helpers` |

All Express-based services use `@kod-psm/http-helpers` which wires `requestId`, `errorHandler`, `notFound` middleware and provides `createApp()` + `listen()` helpers. The library re-exports `Router`, `json`, and `urlencoded` from Express.

### psm-portal specifics

- Uses **Next.js App Router** (`src/app/`). API routes live alongside pages.
- Tailwind CSS with PSM brand tokens (`brand-red: #C8102E`, etc.) defined in `tailwind.config.ts`.
- PostCSS config must stay as **`postcss.config.js` (CJS)** — Next.js build workers use `require()` to load it; `.mjs` breaks the build.
- `output: "standalone"` for Docker deployment.
- `turbopack.root` is set to the monorepo root in `next.config.ts` to fix Turbopack's workspace root detection (it would otherwise pick the wrong root due to a `package-lock.json` in a parent directory).

### Node.js 22 + Next.js 16 Compatibility Patch

`apps/psm-portal/scripts/patch-next-node22.js` runs as a `postinstall` hook and applies three fixes:
1. Adds `"type":"commonjs"` to all `next/dist/compiled/*/package.json` files — Node.js 22's native `readPackageJSON` binding is stricter and rejects packages without a `"type"` field.
2. Creates `@opentelemetry/api/build/esm/package.json` with `{"type":"module"}` so Turbopack correctly parses ESM exports.
3. Clears `.next/cache/turbopack` to prevent stale module graph entries from re-triggering errors after patching.

This patch is needed because `@google-cloud/firestore` (a transitive dep in the monorepo) installs `@opentelemetry/api@1.9.0`, causing pnpm to create a `next@16_@opentelemetry+api@1.9.0_...` peer-dep variant. That variant's compiled packages lack the `"type"` field required by Node.js 22.

### Deployment

- Deployments are triggered on push to `prod` (production) and `dev` (staging) branches via GitHub Actions.
- Only apps with changed files are rebuilt and redeployed (diff-based detection).
- Images go to Google Artifact Registry; services run on Google Cloud Run.
- GitHub → GCP authentication uses Workload Identity Federation (no long-lived keys).
- App metadata (region, artifact repo, secrets) is centralized in `infra/apps.yaml`.
- IAP controls access at the Cloud Run level.

### Environment / Secrets

- Local: `.env` files per app (not committed).
- Production: GCP Secret Manager, mounted as env vars on Cloud Run.
- Some apps accept `APP_CONFIG_JSON` as a single structured JSON env var for batch config passing.
