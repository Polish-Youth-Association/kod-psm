# persist-member

Express backend that ingests member signups from Wix webhooks, assigns unique member IDs, and persists records to Firestore.

## Stack

- Express, Firebase Admin SDK, Zod, `@kod-psm/http-helpers`, TypeScript

## Dev

```bash
pnpm --filter @kod-psm/persist-member run dev   # http://localhost:8080
```

Requires a `.env` file:
```bash
WIX_WEBHOOK_SECRET=your-secret
# Firebase uses Application Default Credentials (ADC) — run:
# gcloud auth application-default login
```

## API Endpoints

### `GET /`
Health check: `{ ok: true, service: 'persist-member' }`.

### `POST /wix/signup`

Ingests a member signup from Wix. Validates the request, assigns a member ID, and writes to Firestore.

**Request body (validated by Zod `WixSignupSchema`):**
```typescript
{
  secret: string          // must match WIX_WEBHOOK_SECRET
  email: string           // required
  firstName?: string
  lastName?: string
  phone?: string
  location?: string       // US ZIP code or country name — determines member ID prefix
  wixSubmissionId?: string
}
```

**Response:**
```typescript
{
  ok: true,
  docId: string,
  memberId: string,       // e.g. "DNY00042"
  alreadyExisted: boolean
}
```

If a member with the same email already exists, returns their existing record (`alreadyExisted: true`).

### `POST /members/:docId/onboarding/done`

Marks a member's onboarding as complete in Firestore.

**Response:** `{ ok: true }`

## Firestore

- **Database:** `psm-member-platform`
- **Collections:**
  - `members` — one document per member
  - `counters` — one document per prefix (e.g. `counters/DNY`), holds `next` counter

Member ID format: `{prefix}{zero-padded-number}` (e.g. `DNY00042`). Prefix is derived from `location`:
- US ZIP code → state → delegation prefix (e.g. NY → `DNY`, NJ → `DNJ`)
- Country name → international prefix
- Falls back to a default prefix

Counter increments are atomic (Firestore transactions).

## Authentication

Webhook requests are authenticated via a `secret` field in the request body matched against `WIX_WEBHOOK_SECRET`. This is a simple shared-secret pattern suitable for Wix webhook integrations.
