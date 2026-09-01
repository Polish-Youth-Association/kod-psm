// backend/memberEmail.js
// Port of the legacy member-onboarding POST /api/onboard (manual welcome-email send).
// Kept per scope. The frontend now uploads any certificate to Wix Media and passes its URL.

import { fetch } from 'wix-fetch';
import { sendMail, renderWelcomeEmail } from 'backend/email';

/**
 * @param {{ firstNamePolish: string, firstNameEnglish: string, email: string,
 *           memberId: string, certFileUrl?: string }} payload
 */
export async function sendWelcomeEmailManual(payload) {
  const { firstNamePolish, firstNameEnglish, email, memberId, certFileUrl } = payload || {};
  if (!firstNamePolish || !firstNameEnglish || !email || !memberId) {
    throw Object.assign(new Error('Missing required fields'), { status: 400 });
  }

  let attachments = [];
  if (certFileUrl) {
    try {
      const resp = await fetch(certFileUrl, { method: 'get' });
      if (resp.ok) {
        attachments = [{
          filename: `PSM_Certificate_${memberId}.pdf`,
          content: Buffer.from(new Uint8Array(await resp.arrayBuffer())),
          contentType: 'application/pdf',
        }];
      }
    } catch (err) {
      console.warn('could not fetch cert for manual send', err);
    }
  }

  await sendMail({
    to: email,
    subject: `Welcome to Polish Youth Association! (ID: ${memberId})`,
    html: renderWelcomeEmail({ firstNamePolish, firstNameEnglish, memberId }),
    attachments,
  });

  return { ok: true, message: 'Onboarding email sent.' };
}
