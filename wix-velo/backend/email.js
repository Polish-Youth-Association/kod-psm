// backend/email.js
// SMTP send helper (Nodemailer) — ported from apps/member-onboarding/src/server.ts transporter.
// SMTP_* + EMAIL_FROM live in Wix Secrets Manager. Install `nodemailer` via the Velo Package Manager.
//
// Alternative: if you'd rather not run SMTP inside Velo, swap this for wix-crm-backend
// triggered emails. SMTP is kept to preserve the exact current behaviour (Gmail App Password).

import nodemailer from 'nodemailer';
import { getSecret } from 'wix-secrets-backend';
import { RECORDS_CC } from 'backend/config';

let cached = null;

async function getTransport() {
  if (cached) return cached;
  const [host, port, user, pass, from] = await Promise.all([
    getSecret('SMTP_HOST'),
    getSecret('SMTP_PORT'),
    getSecret('SMTP_USER'),
    getSecret('SMTP_PASS'),
    getSecret('EMAIL_FROM'),
  ]);
  if (!host || !port || !user || !pass || !from) {
    throw new Error('SMTP secrets not fully configured');
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: { user, pass },
  });
  cached = { transporter, from };
  return cached;
}

/**
 * Send the PSM welcome email. CC'd to records@polishyouth.org to match current behaviour.
 * @param {{ to: string, subject: string, html: string,
 *           attachments?: {filename: string, content: any, contentType: string}[] }} msg
 */
export async function sendMail(msg) {
  const { transporter, from } = await getTransport();
  await transporter.sendMail({
    from: `"PSM Onboarding" <${from}>`,
    to: msg.to,
    cc: RECORDS_CC,
    subject: msg.subject,
    html: msg.html,
    attachments: msg.attachments || [],
  });
}

/**
 * Render the welcome email HTML. Mirrors renderNewMemberEmail() in the old server.ts:
 * supports {{placeholder}} and legacy [Bracket] styles. TEMPLATE_HTML is the contents of
 * apps/member-onboarding/templates/NewMembersEmailTemplate.html (paste it below or load from Media).
 */
const TEMPLATE_HTML = null; // TODO: paste NewMembersEmailTemplate.html contents here, or load from Wix Media.

export function renderWelcomeEmail({ firstNamePolish, firstNameEnglish, memberId }) {
  if (!TEMPLATE_HTML) {
    return (
      `<h2>Welcome to Polish Youth Association!</h2>` +
      `<p>Dear ${firstNamePolish} (${firstNameEnglish}),</p>` +
      `<p>Your membership ID is <strong>${memberId}</strong>.</p>`
    );
  }
  return TEMPLATE_HTML.replace(/{{\s*firstNamePolish\s*}}/gi, firstNamePolish)
    .replace(/{{\s*firstNameEnglish\s*}}/gi, firstNameEnglish)
    .replace(/{{\s*memberId\s*}}/gi, memberId)
    .replace(/\[First Name Polish\]/g, firstNamePolish)
    .replace(/\[First Name English\]/g, firstNameEnglish)
    .replace(/\[MEMBERSHIP_ID\]/g, memberId);
}
