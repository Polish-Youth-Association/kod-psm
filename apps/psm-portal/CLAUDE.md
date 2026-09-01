# psm-portal

Next.js 16 (App Router) frontend, built as a **static export** (`output: "export"`) and hosted on
**GitHub Pages**. It is the UI hub for PSM internal tools. There is no server: the browser calls the
**Wix Velo** backend directly via `src/lib/wixApi.ts` (the `/_functions` HTTP endpoints), attaching a
**Google Sign-In** ID token that the Velo `assertPsmStaff` gate verifies (`@polishyouth.org` only).

## Stack

- Next.js 16 (static export), React 19, Tailwind CSS, TypeScript
- Google Identity Services for sign-in (`src/lib/googleAuth.ts`); no server-side auth/deps

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

## Backend calls

No API routes. `src/lib/wixApi.ts` calls the Wix Velo `/_functions` endpoints (`chat`, `queue`,
`approve`, `member`, `volunteer`, `volunteerFinish`) with the Google ID token as a Bearer header.
The Velo backend source lives in `wix-velo/` at the repo root.

## Environment Variables

Build-time public vars (set as GitHub Actions repo *variables* for the Pages build):

```bash
NEXT_PUBLIC_WIX_FUNCTIONS_BASE=https://<your-wix-site>/_functions
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-oauth-web-client-id>   # must equal Velo secret GOOGLE_OAUTH_CLIENT_ID
```

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
- **Static export only** — no API routes, no Server Components doing data fetch, no `next/headers`.
  `next/image` is unusable (optimizer doesn't run); use plain `<img>`.
