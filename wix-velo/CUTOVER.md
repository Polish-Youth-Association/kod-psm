# Cutover Runbook — GCP → GitHub Pages + Wix

Repo-side code is authored. The steps below are the console/CLI work only you can do, in order.
Nothing destructive to the live GCP system is done until the Wix backend is verified.

## Status

**Done in-repo (this branch):**
- `wix-velo/backend/**` — full Velo backend (auth gate, gemini, counter, cert, queue, approve,
  member email, intake, signup, Wix contact, workspace auth, google workspace, volunteer, events).
- `scripts/export-firestore-to-wix.ts` — read-only Firestore → CSV export.
- `apps/psm-portal/src/lib/{wixApi,googleAuth}.ts` — frontend client + Google Sign-In (additive; not
  yet wired into pages).
- `.github/workflows/pages.yaml` — GitHub Pages deploy (disabled until P5).

**Deferred on purpose (destructive / phase-gated) — do AFTER Wix backend verified:**
- P5: flip `next.config.ts` to `output:"export"` + `images.unoptimized`, delete `src/app/api/**`,
  remove `google-auth-library`, drop the IAP `headers()` read in `layout.tsx`, replace `next/image`,
  wire each page to `wixApi`, mount the Google Sign-In gate.
- P6: delete `infra/**` and the GCP GitHub Actions workflows; tear down GCP resources.

## P0 — Stand up Wix (console)
1. Content Manager → create collections **Members, Counters, MemberIds, VolunteerRequests**
   (fields per plan §schema). Add a **unique index on `MemberIds._id`** and index `Members.email`,
   `Members.memberId`.
2. Secrets Manager → add all secrets listed in `wix-velo/README.md`.
3. Package Manager → install `jsonwebtoken`, `pdf-lib`, `@pdf-lib/fontkit`, `zipcodes`, `nodemailer`.
4. Upload `apps/certificate-generator/templates/CertTemplate.pdf` and
   `templates/fonts/WixMadeforText-Bold.ttf` to Wix Media; set `TEMPLATE_URL`/`FONT_URL` in `cert.js`.
5. Paste the email/signature HTML into `email.js` (`TEMPLATE_HTML`) and `templates.js`.
6. Create a Google OAuth 2.0 **Web client id**; put it in both `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   (frontend) and the Velo secret `GOOGLE_OAUTH_CLIENT_ID`.
7. Sync `wix-velo/backend/**` into the site (`wix dev`/`wix push` or Studio↔GitHub).
   Set `FRONTEND_ORIGIN` in `cors.js` to your Pages domain.
8. Verify: `GET /_functions/queue` with a non-`@polishyouth.org` token → 403; with a valid token → 200.

## P1 — Read + Gemini
- `pnpm ts-node scripts/export-firestore-to-wix.ts` → import CSVs into the collections (dry run).
- Test `chat` and `queue` via `_functions`; compare queue output to the live Cloud Run response.

## P2 — Cert + approve/delete
- Test `POST /_functions/approve` on a test member: cert renders (name/id placement identical),
  email arrives CC'd to records@, status flips to ONBOARDED; `DELETE /_functions/queue` removes a row.

## P3 — Ingestion cutover
- Fill `INTAKE_FORM_ID`/`SIGNUP_FORM_ID` + field mapping in `events.js` (or wire Automations).
- Re-run the export for a final sync, then point the Wix forms at the handlers. Verify unique
  sequential member IDs and idempotent dedup by email.

## P4 — Volunteer
- Move the SA JSON key into `GOOGLE_SA_KEY_JSON`; confirm domain-wide delegation scopes in Admin.
- Test on a throwaway account: `provisionVolunteer` returns creds fast; call `volunteerFinish`
  (or schedule it) → signature set, 2 emails, Slack fired; statuses in VolunteerRequests. 409 on dup.

## P5 — Frontend to GitHub Pages
- Apply the deferred frontend changes above; set repo Pages vars `WIX_FUNCTIONS_BASE`,
  `GOOGLE_OAUTH_CLIENT_ID`; enable `pages.yaml`; add `CNAME`; point DNS at GitHub Pages.
- Verify every page end-to-end from the public URL; confirm CORS preflight succeeds.

## P6 — Teardown (see plan §GCP teardown for exact order)
- Delete GCP deploy workflows + `infra/**`, then Cloud Run, IAP, Artifact Registry, Cloud Build,
  WIF, GCS bucket, Firestore (keep a final export), Secret Manager. Keep Workspace, the SA key
  (now in Wix), the Gemini key, and the domain.
