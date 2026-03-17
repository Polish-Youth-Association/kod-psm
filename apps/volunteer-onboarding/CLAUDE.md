# volunteer-onboarding

Express backend that provisions new volunteers across Google Workspace, Gmail, and Slack. Called by psm-portal via its `/api/onboarding/volunteer` proxy route.

## Stack

- Express, googleapis, `@kod-psm/http-helpers`, TypeScript

## Dev

```bash
pnpm --filter @kod-psm/volunteer-onboarding run dev   # http://localhost:8080
```

Requires a `.env` file with Google Workspace service account credentials and SMTP config.

## API Endpoints

### `GET /`
Health check: `{ ok: true, service: 'volunteer-onboarding' }`.

### `POST /v1/onboarding/volunteers`

Provisions a new volunteer. Performs these steps in order:
1. Creates a Google Workspace user (`primaryEmail`, temp password, recovery email, org unit, phone, title, birthday)
2. Waits for the user to propagate (polls up to 30s)
3. Sets a Gmail signature for the new account
4. Sends an onboarding email to the volunteer's personal email
5. Sends a second onboarding email to the new PSM inbox
6. Triggers a Slack/DocuSign workflow

Steps 3–6 are non-fatal — if they fail, the response still returns `ok: true` with per-step error details.

**Request body:**
```typescript
{
  firstName: string        // required
  lastName: string         // required
  personalEmail: string    // required
  team: string             // required
  title?: string
  startDate?: string       // YYYY-MM-DD
  notes?: string
  suggestedPrimaryEmail?: string  // used as primaryEmail if it contains '@'
  phoneNumber?: string
  birthday?: string        // YYYY-MM-DD
}
```

**Response:**
```typescript
{
  ok: true,
  requestId: string,
  status: 'Provisioned',
  user: { id, primaryEmail },
  email: { status: 'Sent' | 'Failed', error? },
  docusign: { status: 'Sent' | 'Failed', error? },
  signature: { status: 'Set' | 'Failed', error? }
}
```

Returns `409` if a Workspace user with that email already exists.

## Environment Variables

```bash
WORKSPACE_DOMAIN=polishyouth.org          # email domain for new accounts
DEFAULT_ORG_UNIT=/                         # Google Workspace org unit path
WORKSPACE_TEMP_PASSWORD_PREFIX=Psm!       # prefix for generated temp passwords
SLACK_INVITE_LINK=https://...             # included in onboarding email
```

Plus whatever credentials googleapis needs (service account key or ADC).

## Email Generation

`suggestedPrimaryEmail` from the form is used as the Workspace email if it contains `@`. Otherwise it is derived from `firstName.lastName@WORKSPACE_DOMAIN` with accent stripping and special-char removal.
