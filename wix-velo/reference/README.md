# reference

Files kept from the retired Cloud Run services (`apps/volunteer-onboarding`, `apps/member-onboarding`)
when those were removed. They are the source for the HTML that `backend/templates.js` and
`backend/email.js` expect to be pasted in. Nothing imports these files.

- `onboardingTemplate.ts` — volunteer welcome email (personal inbox, includes temp password)
- `onboardingTemplatePsmInbox.ts` — volunteer welcome email (new PSM inbox)
- `gmailSignature.ts` — `buildPolishYouthSignatureHtml` (Gmail signature markup)
- `NewMembersEmailTemplate.html` — member welcome email
- `geo_code.json` — delegation prefix codes and their meanings
