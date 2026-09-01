# wix-velo — PSM backend on Wix Velo

This directory is the **version-controlled source** for the Wix Velo backend that replaces the GCP
Cloud Run services (see `/Users/mozarella/.claude/plans/first-let-s-figure-out-cheerful-pascal.md`).

It is authored here so the migration is reviewable in git. You then sync it into the Wix site with
the **Wix CLI** (`wix dev` / `wix push`) or the Wix Studio ↔ GitHub integration. File layout mirrors
what Wix expects under a site's `src/backend/`.

## Layout

```
wix-velo/
  backend/
    config.js            # constants: allowed domain, secret names
    auth.js              # assertPsmStaff(idToken) — Google Sign-In gate (used by every entrypoint)
    cors.js              # CORS helper for http-functions
    http-functions.js    # browser-facing HTTP surface (called by the GitHub Pages frontend)
    llm.js               # chat(history, message) — Groq (open-weights model)
    counter.js           # assignMemberId(prefix), resolvePrefix(input)
    cert.js              # generateAndStore(memberId, first, last) -> Wix Media URL
    queue.js             # listPending(), deleteMember(docId)
    approve.js           # approveMember(docId, firstNamePolish)
    memberEmail.js       # sendWelcomeEmailManual(...) (legacy manual send)
    email.js             # SMTP/Wix email helper
    intake.js            # intake(submission)  — member-onboarding /api/intake flow
    signup.js            # signup(submission), markOnboardingDone(docId) — persist-member flow
    workspaceAuth.js     # getDelegatedAccessToken(scopes, subject) — local RS256 signing
    volunteer.js         # provisionVolunteer(payload), finishProvisioning(requestId)
    events.js            # Wix Forms/Automation submit -> intake()/signup()
    lib/
      geoPrefix.js       # canonical prefix resolver (ported from member-onboarding/geoPrefix.ts)
  assets/
    CertTemplate.pdf     # copy of apps/certificate-generator/templates/CertTemplate.pdf
    WixMadeforText-Bold.ttf
```

## Wix CMS collections to create (Content Manager)

- **Members** — see plan §"Wix CMS schema". Fields flattened; `email` + `memberId` indexed.
- **Counters** — `_id` = prefix, `next` (Number).
- **MemberIds** — `_id` = each assigned memberId (unique). The atomicity guard for ID assignment.
- **VolunteerRequests** — per-request status for the async volunteer flow.

## Secrets to add (Wix Secrets Manager)

`GROQ_API_KEY` (free key from console.groq.com — chat assistant),
`GOOGLE_OAUTH_CLIENT_ID` (the Google Sign-In web client id, for `aud` check),
`GOOGLE_SA_KEY_JSON` (full service-account JSON with domain-wide delegation),
`WORKSPACE_IMPERSONATE_ADMIN`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `WORKSPACE_DOMAIN`, `DEFAULT_ORG_UNIT`,
`WORKSPACE_TEMP_PASSWORD_PREFIX`, `ONBOARDING_FROM_EMAIL`, `SLACK_INVITE_LINK`,
`SLACK_DOCUSIGN_WORKFLOW_WEBHOOK_URL`, `SIGNATURE_*` (as needed),
and email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.

## npm packages to install in Velo (Package Manager)

`jsonwebtoken` (RS256 signing), `pdf-lib`, `@pdf-lib/fontkit`, `zipcodes`, and `nodemailer`
(only if keeping SMTP; otherwise use Wix `wix-crm-backend` triggered emails).

## Auth model

The GitHub Pages frontend obtains a Google ID token (Google Identity Services) and sends it as
`Authorization: Bearer <id_token>` on every request. Every `http-functions` handler and every
Wix event handler calls `assertPsmStaff()` before doing work. This is the entire security boundary
now that Cloud Run's domain-restricted invoker / IAP is gone — no handler may skip it.
