# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a **pnpm workspaces** monorepo for the Polish Youth Association (PSM) platform. There is no Turborepo — orchestration is done via pnpm workspace filters.

- `apps/` — 8 deployable services, each deployed independently to **Google Cloud Run**
- `libs/` — 2 shared TypeScript packages (`@kod-psm/http-helpers`, `@kod-psm/gcp-helpers`)
- All packages use the `@kod-psm/` namespace

## Common Commands

```bash
# Install all workspaces
pnpm install

# Run a specific app in dev mode
pnpm --filter @kod-psm/psm-portal run dev
pnpm --filter @kod-psm/gemini run dev

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
| `member-onboarding` | Welcome email sender (backend only) | Express, Nodemailer, Multer |
| `volunteer-onboarding` | Provision Google Workspace, Slack, groups | Express, googleapis, `@kod-psm/http-helpers` |
| `certificate-generator` | PDF certificate creation + GCS storage | Express, pdf-lib, pdfkit, `@kod-psm/gcp-helpers` |
| `persist-member` | Write member data to Firestore | Express, Firebase Admin, Zod, `@kod-psm/http-helpers` |
| `gemini` | Gemini-powered chat API | Express, `@google/generative-ai`, `@kod-psm/http-helpers` |
| `example` | Scaffold/reference service | Express |

### psm-portal — the user-facing hub

All user-facing UI lives in psm-portal. It proxies to backend services via Next.js API routes using Google ID tokens for service-to-service auth. Backend services are never called directly from the browser.

Pages:
- `/` — home with tool cards
- `/volunteer-onboarding` — volunteer onboarding form
- `/member-onboarding` — member welcome email form
- `/chat` — Gemini-powered assistant

API proxy routes:
- `/api/onboarding/volunteer` → `VOLUNTEER_ONBOARDING_BASE`
- `/api/onboarding/member` → `MEMBER_ONBOARDING_BASE`
- `/api/chat` → `GEMINI_BASE`
- `/api/ping` → `API_BASE`

See `apps/psm-portal/CLAUDE.md` for full details.

### Express services — shared conventions

All Express-based services use `@kod-psm/http-helpers` which wires `requestId`, `errorHandler`, `notFound` middleware and provides `createApp()` + `listen()` helpers.

```typescript
// Standard pattern — createApp receives the Express Application, not a Router
const app = createApp((router) => {
  router.get('/', (_req, res) => res.json({ ok: true, service: 'my-service' }));
  router.post('/v1/something', async (req, res) => { ... });
});
listen(app, PORT, () => console.log('running on port ' + PORT));
```

Do NOT import `Request`/`Response` types from express — let TypeScript infer from the `RegisterRoutes` callback signature.

### Dockerfiles — standard monorepo pattern

All service Dockerfiles follow the same pattern (see `apps/volunteer-onboarding/Dockerfile` as the reference):

```dockerfile
FROM node:22-slim AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./   # needed for libs/* tsconfig extends
COPY libs ./libs
COPY apps/<service> ./apps/<service>
RUN pnpm install --frozen-lockfile --filter "@kod-psm/<service>..."
RUN pnpm -r --filter "@kod-psm/<service>..." run build
RUN pnpm --filter "@kod-psm/<service>" deploy --prod --legacy /out
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
COPY --from=builder /out ./
CMD ["node", "dist/index.js"]
```

Never use the root `pnpm run build` in a service Dockerfile — it builds all 9 apps and will fail on unrelated errors.

### psm-portal specifics

- Uses **Next.js App Router** (`src/app/`). API routes live alongside pages.
- Tailwind CSS with PSM brand tokens (`brand-red: #C8102E`, etc.) defined in `tailwind.config.ts`.
- PostCSS config must stay as **`postcss.config.js` (CJS)** — Next.js build workers use `require()` to load it; `.mjs` breaks the build.
- `output: "standalone"` for Docker deployment.
- `turbopack.root` is set to the monorepo root in `next.config.ts` to fix Turbopack's workspace root detection.

### Node.js 22 + Next.js 16 Compatibility Patch

`apps/psm-portal/scripts/patch-next-node22.js` runs as a `postinstall` hook and applies three fixes:
1. Adds `"type":"commonjs"` to all `next/dist/compiled/*/package.json` files.
2. Creates `@opentelemetry/api/build/esm/package.json` with `{"type":"module"}`.
3. Clears `.next/cache/turbopack` to prevent stale cache entries.

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
