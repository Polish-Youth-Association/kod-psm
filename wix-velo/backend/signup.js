// backend/signup.js
// Port of persist-member POST /wix/signup and /members/:docId/onboarding/done.
// The SECOND live ingestion flow — kept distinct from intake.js per scope. Simpler payload
// (freeform `location`), no certificate step. Uses the same atomic counter.

import wixData from 'wix-data';
import { COLLECTIONS, DEFAULT_PREFIX } from 'backend/config';
import { resolvePrefix, assignMemberId } from 'backend/counter';

const AUTH = { suppressAuth: true };

/**
 * @param {{ firstName?, lastName?, email: string, phone?, location?, wixSubmissionId?, raw?: object }} submission
 * @returns {Promise<{ ok, docId, memberId, alreadyExisted }>}
 */
export async function signup(submission) {
  const { firstName = '', lastName = '', email, phone = '', location = '', raw = {} } = submission || {};
  if (!email) throw Object.assign(new Error('email is required'), { status: 400 });

  const normalizedEmail = String(email).trim().toLowerCase();

  // Idempotency by email (persist-member keyed on submission id; email is the durable key here).
  const existing = await wixData
    .query(COLLECTIONS.members)
    .eq('email', normalizedEmail)
    .limit(1)
    .find(AUTH);
  if (existing.items.length) {
    const doc = existing.items[0];
    return { ok: true, docId: doc._id, memberId: doc.memberId, alreadyExisted: true };
  }

  const prefix = resolvePrefix({ location }) || DEFAULT_PREFIX;
  const memberId = await assignMemberId(prefix);

  const inserted = await wixData.insert(
    COLLECTIONS.members,
    {
      memberId,
      prefix,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email: normalizedEmail,
      phone,
      // persist-member wrote its own vocab; normalize to the canonical one used by the queue.
      onboardingStatus: 'NOT_ONBOARDED',
      source: 'wix',
      flow: 'signup',
      raw,
    },
    AUTH
  );

  return { ok: true, docId: inserted._id, memberId, alreadyExisted: false };
}

/** Mark onboarding complete (persist-member /members/:docId/onboarding/done). */
export async function markOnboardingDone(docId) {
  const member = await wixData.get(COLLECTIONS.members, docId, AUTH);
  if (!member) throw Object.assign(new Error('member not found'), { status: 400 });
  await wixData.update(
    COLLECTIONS.members,
    { ...member, onboardingStatus: 'ONBOARDED', onboardedAt: new Date() },
    AUTH
  );
  return { ok: true };
}
