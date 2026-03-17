---
name: gemini_service
description: Gemini chatbot service setup - model, auth, API key location
type: project
---

`apps/gemini` is a live Gemini-powered chat service using `@google/generative-ai` (NOT `@google-cloud/vertexai`).

- Model: `gemini-2.5-flash` — this is the correct model for this API key; gemini-2.0-flash and all lite variants return 404 "not available to new users"
- Auth: API key via `GEMINI_API_KEY` env var (stored in `apps/gemini/.env` locally, GCP Secret Manager in prod)
- Endpoint: `POST /v1/chat` — accepts `{ history: [{role, text}], message }`, returns `{ ok, reply }`

**Why:** gemini-2.0-* models are deprecated for new GCP projects; gemini-2.5-flash is the earliest available stable model for this account.

**How to apply:** Always use `gemini-2.5-flash` as the default model for this project unless the user explicitly asks to change it.
