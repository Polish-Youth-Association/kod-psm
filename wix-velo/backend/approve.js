// backend/approve.js
// Port of member-onboarding POST /api/members/:docId/approve.
// Ensures a certificate exists, sends the welcome email (CC records@), flips status to ONBOARDED.

import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { COLLECTIONS } from 'backend/config';
import { sendMail, renderWelcomeEmail } from 'backend/email';
import { generateAndStore } from 'backend/cert';

const AUTH = { suppressAuth: true };

/**
 * @param {string} docId  Members._id
 * @param {string} firstNamePolish
 * @returns {Promise<{ ok: boolean, memberId?: string, error?: string }>}
 */
export async function approveMember(docId, firstNamePolish) {
  if (!firstNamePolish || !firstNamePolish.trim()) {
    throw Object.assign(new Error('firstNamePolish is required'), { status: 400 });
  }

  const member = await wixData.get(COLLECTIONS.members, docId, AUTH);
  if (!member) throw Object.assign(new Error('member not found'), { status: 400 });
  if (member.onboardingStatus === 'ONBOARDED') {
    throw Object.assign(new Error('member already onboarded'), { status: 400 });
  }

  // Ensure a certificate exists (generate on the fly if intake didn't).
  let certUrl = member.certUrl;
  let certBytes = null;
  if (member.certStatus !== 'generated' || !certUrl) {
    try {
      const cert = await generateAndStore(member.memberId, member.firstName, member.lastName);
      certUrl = cert.url;
      certBytes = cert.bytes;
      await wixData.update(
        COLLECTIONS.members,
        { ...member, certStatus: 'generated', certUrl: cert.url, certFileId: cert.fileId },
        AUTH
      );
    } catch (err) {
      // Non-fatal: send without an attachment rather than failing (matches old behaviour).
      console.warn('on-demand cert generation failed for', member.memberId, err);
    }
  }

  // Fetch the cert bytes for the attachment if we didn't just generate them.
  let attachments = [];
  if (!certBytes && certUrl) {
    try {
      const resp = await fetch(certUrl, { method: 'get' });
      if (resp.ok) certBytes = new Uint8Array(await resp.arrayBuffer());
    } catch (err) {
      console.warn('could not retrieve certificate for', member.memberId, err);
    }
  }
  if (certBytes) {
    attachments = [{
      filename: `PSM_Certificate_${member.memberId}.pdf`,
      content: Buffer.from(certBytes),
      contentType: 'application/pdf',
    }];
  }

  const html = renderWelcomeEmail({
    firstNamePolish: firstNamePolish.trim(),
    firstNameEnglish: member.firstName,
    memberId: member.memberId,
  });

  await sendMail({
    to: member.email,
    subject: `Welcome to Polish Youth Association! (ID: ${member.memberId})`,
    html,
    attachments,
  });

  await wixData.update(
    COLLECTIONS.members,
    {
      ...member,
      onboardingStatus: 'ONBOARDED',
      firstNamePolish: firstNamePolish.trim(),
      onboardedAt: new Date(),
    },
    AUTH
  );

  return { ok: true, memberId: member.memberId };
}
