# gemini

Express backend that provides a Gemini-powered chat API for the PSM Assistant. Called by psm-portal via its `/api/chat` proxy route.

## Stack

- Express, `@google/generative-ai`, `@kod-psm/http-helpers`, dotenv, TypeScript

## Dev

```bash
pnpm --filter @kod-psm/gemini run dev   # http://localhost:8080
```

Requires a `.env` file:
```bash
GEMINI_API_KEY=your-key-from-aistudio.google.com
```

Get a key at: https://aistudio.google.com/apikey

## API Endpoints

### `GET /`
Health check: `{ ok: true, service: 'gemini' }`.

### `POST /v1/chat`

Sends a message to Gemini and returns a reply. Conversation history is maintained client-side and sent with each request.

**Request body:**
```typescript
{
  message: string                              // required — the new user message
  history?: { role: 'user' | 'model', text: string }[]  // prior turns
}
```

**Response:**
```typescript
{ ok: true, reply: string }
```

## Model

Uses `gemini-2.5-flash`. Do not change to `gemini-2.0-flash` or any `*-lite` variant — those return 404 "not available to new users" for this GCP project.

## Session Design

Sessions are stateless on the server. The client (psm-portal `/chat` page) maintains the full conversation history in React state and sends it with every request. Gemini receives the full history each time, giving it conversation context.

## System Prompt

The model is initialised with a system instruction identifying it as an internal PSM assistant. Edit `SYSTEM_PROMPT` in `src/index.ts` to adjust its persona or scope.

## Production

`GEMINI_API_KEY` should be stored in GCP Secret Manager and mounted as an env var on the Cloud Run service. The psm-portal IAM setup does not apply here — this service uses an API key, not a GCP service account, for Gemini access.
