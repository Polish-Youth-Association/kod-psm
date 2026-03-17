# psm-portal

Next.js 16 (App Router) frontend that serves as the main UI hub for PSM internal tools. All user-facing pages live here. Backend services are never called directly from the browser — psm-portal proxies to them via API routes using Google ID tokens.

## Stack

- Next.js 16, React 19, Tailwind CSS, TypeScript
- `google-auth-library` for minting GCP ID tokens in API routes

## Dev

```bash
pnpm --filter @kod-psm/psm-portal run dev   # http://localhost:3000
pnpm --filter @kod-psm/psm-portal run build
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — tool cards linking to each feature |
| `/volunteer-onboarding` | Form to onboard a new volunteer (creates Google Workspace account, Slack, groups) |
| `/member-onboarding` | Form to send a welcome email to a new member with optional certificate attachment |
| `/chat` | Gemini-powered PSM assistant (session-based, history sent with each request) |

## API Routes

All routes proxy to downstream Cloud Run services. They mint a Google ID token (via `GoogleAuth.getIdTokenClient`) for service-to-service auth. Auth is skipped when `*_BASE` points to localhost.

| Route | Proxies to | Env var |
|-------|-----------|---------|
| `POST /api/onboarding/volunteer` | `VOLUNTEER_ONBOARDING_BASE/v1/onboarding/volunteers` | `VOLUNTEER_ONBOARDING_BASE` |
| `POST /api/onboarding/member` | `MEMBER_ONBOARDING_BASE/api/onboard` | `MEMBER_ONBOARDING_BASE` |
| `POST /api/chat` | `GEMINI_BASE/v1/chat` | `GEMINI_BASE` |
| `GET /api/ping` | `API_BASE` | `API_BASE` |

The member onboarding proxy forwards `multipart/form-data` (file upload). Do NOT set `content-type` manually — let fetch set it with the multipart boundary.

## Environment Variables

```bash
VOLUNTEER_ONBOARDING_BASE=https://volunteer-onboarding-xxx.run.app
MEMBER_ONBOARDING_BASE=https://member-onboarding-xxx.run.app
GEMINI_BASE=https://gemini-xxx.run.app
API_BASE=https://some-service-xxx.run.app
```

For local dev, set `*_BASE` to `http://localhost:<port>` and auth is automatically skipped.

## Styling

Tailwind CSS with PSM brand tokens defined in `tailwind.config.ts`:

| Token | Value | Usage |
|-------|-------|-------|
| `brand-red` | `#C8102E` | Primary buttons, active nav, accents |
| `brand-red-dark` | `#A00D24` | Button hover |
| `brand-red-light` | `#FEF2F4` | Icon backgrounds, active nav bg |
| `brand-dark` | `#111827` | Body text |
| `brand-gray` | `#6B7280` | Secondary text |
| `brand-border` | `#E5E7EB` | Card and input borders |

## Key Constraints

- **PostCSS config must be `postcss.config.js` (CJS)** — never `.mjs`. Next.js build workers load it via `require()`.
- **`turbopack.root`** is set to the monorepo root in `next.config.ts` — do not remove this.
- The `postinstall` script runs `scripts/patch-next-node22.js` to fix Node.js 22 + Next.js 16 incompatibilities. Do not remove this hook.
- All API routes need `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`.
