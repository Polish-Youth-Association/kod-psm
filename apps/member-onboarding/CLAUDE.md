# member-onboarding

Express backend that sends welcome emails to new PSM members. The frontend lives in `apps/psm-portal` (`/member-onboarding` page) — this service is API-only.

## Stack

- Express, Nodemailer, Multer, TypeScript
- No frontend (was migrated to psm-portal)

## Dev

```bash
pnpm --filter @kod-psm/member-onboarding run dev   # http://localhost:8080
```

Requires a `.env` file:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-app-password   # Google App Password, NOT your regular password
EMAIL_FROM=your-address@gmail.com
```

Or as a single JSON blob: `APP_CONFIG_JSON={"SMTP_HOST":...}` (takes precedence).

## API Endpoints

### `GET /api/health`
Returns `{ ok: true, service: 'member-onboarding-app' }`.

### `POST /api/onboard`
Sends a welcome email to a new member. Accepts `multipart/form-data`.

**Fields:**
| Field | Type | Required |
|-------|------|----------|
| `firstNamePolish` | string | yes |
| `firstNameEnglish` | string | yes |
| `email` | string (email) | yes |
| `memberId` | string | yes |
| `certificate` | PDF file | no |

**Response:** `{ ok: true, message: 'Onboarding email sent.' }`

Email is sent to `email`, CC'd to `records@polishyouth.org`, with subject `Welcome to Polish Youth Association! (ID: {memberId})`. If a certificate PDF is uploaded it is attached.

## Email Template

HTML template lives at `templates/NewMembersEmailTemplate.html`. Placeholders: `{{firstNamePolish}}`, `{{firstNameEnglish}}`, `{{memberId}}`. Legacy bracket-style placeholders are also supported.

## SMTP Notes

Gmail requires an **App Password** (not your regular account password). To generate one:
1. Enable 2-Step Verification on the sending account
2. Go to myaccount.google.com/apppasswords
3. Generate a password and store it as `SMTP_PASS`

Plain password auth (`AUTH PLAIN`) will return `535 5.7.8` and fail.

## Build

```bash
pnpm --filter @kod-psm/member-onboarding run build  # tsc -p tsconfig.server.json → dist/server.js
```

Entry point: `dist/server.js`
