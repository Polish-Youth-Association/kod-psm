// backend/templates.js
// Paste the volunteer onboarding email + signature HTML here (from apps/volunteer-onboarding/src/
// onboardingTemplate.ts, onboardingTemplatePsmInbox.ts, gmailSignature.ts buildPolishYouthSignatureHtml).
// Kept separate so the large HTML strings don't clutter the logic modules.

export const ONBOARDING_TEMPLATE_HTML = `<!-- TODO: paste ONBOARDING_TEMPLATE_HTML -->`;
export const ONBOARDING_TEMPLATE_PSM_HTML = `<!-- TODO: paste ONBOARDING_TEMPLATE_PSM_HTML -->`;

// Placeholders {{FIRST_NAME}}, {{TITLE}}, {{POLISH_YOUTH_EMAIL}}, {{TEMP_PASSWORD}} are substituted.
export function renderTemplate(html, vars) {
  return html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_m, key) => (vars[key] != null ? vars[key] : ''));
}

/** Port of buildPolishYouthSignatureHtml — replace with the real signature markup. */
export function buildSignatureHtml({ firstName, lastName, email, title }) {
  return (
    `<div><strong>${firstName} ${lastName}</strong>` +
    (title ? `<br/>${title}` : '') +
    `<br/><a href="mailto:${email}">${email}</a>` +
    `<br/>Polish Youth Association</div>`
  );
}
