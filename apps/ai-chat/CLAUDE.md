# ai-chat

Express backend that manages persistent AI assistant sessions for PSM staff and volunteers. Combines Gemini for language model responses with Firestore for durable session storage, replacing the stateless `gemini` service for all session-based chat.

## Stack

- Express, `@google/generative-ai`, `@kod-psm/http-helpers`, `@kod-psm/gcp-helpers`, `firebase-admin`, dotenv, TypeScript

## Dev

```bash
pnpm --filter @kod-psm/ai-chat run dev   # http://localhost:8080
```

Requires a `.env` file:
```bash
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

Firestore uses Application Default Credentials — run once before starting:
```bash
gcloud auth application-default login
```

The service connects to the `psm-chat-sessions` named Firestore database declared in `infra/db.yaml`. To use the Firebase emulator instead, set `FIRESTORE_EMULATOR_HOST=localhost:8090` in your `.env`.

Get a Gemini API key at: https://aistudio.google.com/apikey

## API Endpoints

All endpoints return `{ ok: true, ... }` on success or `{ ok: false, error: string }` on failure.

### `GET /`
Health check: `{ ok: true, service: 'ai-chat' }`.

---

### `GET /v1/sessions?userEmail=<email>`

Lists the 20 most recently updated sessions for a user.

**Query params:**
- `userEmail` — required

**Response:**
```typescript
{
  ok: true,
  sessions: {
    sessionId: string,
    title: string,       // first 60 chars of the opening message
    createdAt: Timestamp,
    updatedAt: Timestamp,
  }[]
}
```

Requires a composite Firestore index: `userEmail ASC, updatedAt DESC`. See `infra/db.yaml`. Firestore will return a link to create it on first use if missing.

---

### `GET /v1/sessions/:sessionId?userEmail=<email>`

Returns a single session with its full message history.

**Query params:**
- `userEmail` — required (enforced against session owner; returns 403 if mismatch)

**Response:**
```typescript
{
  ok: true,
  session: {
    sessionId: string,
    userEmail: string,
    title: string,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    messages: { role: 'user' | 'model', text: string, createdAt: Timestamp }[]
  }
}
```

---

### `POST /v1/sessions`

Creates a new session and sends the opening message to Gemini in one call.

**Request body:**
```typescript
{
  userEmail: string,
  message: string,
}
```

**Response (201):**
```typescript
{
  ok: true,
  sessionId: string,
  title: string,   // first 60 chars of message
  reply: string,   // Gemini's response
}
```

---

### `POST /v1/sessions/:sessionId/messages`

Sends a follow-up message in an existing session. Loads the full message history from Firestore, passes it to Gemini as context, appends both the user message and model reply to the session document.

**Request body:**
```typescript
{
  userEmail: string,
  message: string,
}
```

**Response:**
```typescript
{
  ok: true,
  reply: string,
}
```

---

### `DELETE /v1/sessions/:sessionId`

Permanently deletes a session.

**Request body:**
```typescript
{
  userEmail: string,
}
```

**Response:**
```typescript
{ ok: true }
```

---

## Firestore

- **Database:** `psm-chat-sessions` (named database, declared in `infra/db.yaml`)
- **Collection:** `sessions`

### Session document schema

```
sessions/{sessionId}
  userEmail:  string        — IAP-authenticated user email
  title:      string        — first 60 chars of the opening user message
  createdAt:  Timestamp     — server timestamp set on creation
  updatedAt:  Timestamp     — server timestamp updated on every new message
  messages:   array
    role:     'user' | 'model'
    text:     string
    createdAt: Timestamp    — client-side Timestamp.now() (server timestamps
                              cannot be used inside array elements)
```

### Why client timestamps for message.createdAt

Firestore does not support `FieldValue.serverTimestamp()` inside array fields — it can only be used on document-level fields. Message-level timestamps use `Timestamp.now()` (client clock) instead. Document-level `createdAt` and `updatedAt` use `FieldValue.serverTimestamp()` and are authoritative for ordering.

### Authorization

Every write and read endpoint verifies that `userEmail` in the request matches `userEmail` stored on the session document. Mismatches return 403. This is a service-level check — the primary auth boundary is IAP at the Cloud Run level.

## Model

Uses `gemini-2.5-flash` with Google Search grounding enabled. Do not switch to `gemini-2.0-flash` or any `*-lite` variant — those return 404 "not available to new users" for this GCP project.

The system prompt identifies the assistant as an internal PSM tool. Edit `SYSTEM_PROMPT` in `src/index.ts` to adjust persona or scope.

## Session design

Sessions are stateful on the server. Each `POST /v1/sessions/:id/messages` call:
1. Reads the full message history from Firestore
2. Passes it to Gemini as conversation context
3. Appends both the user message and model reply back to Firestore

The client only needs to track the active `sessionId` — it does not maintain or send history itself (unlike the old stateless `gemini` service).

## How psm-portal integrates

`psm-portal` proxies to this service via its `/api/chat` API routes using Google ID tokens for service-to-service auth (same pattern as all other backend services). The IAP-authenticated user email is read from the `x-goog-authenticated-user-email` header in the portal's API route and forwarded as `userEmail` in the request body to this service.

Auth is automatically skipped when `AI_CHAT_BASE` points to localhost.

## IAM

The service account (`ai-chat-svc`) needs the following roles beyond `roles/run.invoker`:
- `roles/datastore.user` — read/write access to the `psm-chat-sessions` Firestore database

Update `iam.yaml` with these once the service account is provisioned in GCP.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Gemini API key from AI Studio |
| `PORT` | No | Server port, defaults to `8080` |
| `FIRESTORE_EMULATOR_HOST` | No | Set to `localhost:8090` to use the Firebase emulator locally |

In production, `GEMINI_API_KEY` is stored in GCP Secret Manager and mounted as an env var on the Cloud Run service.

## Production

Deployed to Cloud Run. Registered in `infra/apps.yaml` under id `ai-chat`. Deployment is triggered automatically on push to `dev` (staging) or `prod` (production) branches when files under `apps/ai-chat/` change.
