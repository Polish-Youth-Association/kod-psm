// backend/intake.js
// Port of member-onboarding POST /api/intake (the richer Wix ingestion flow).
//
// Now runs IN-PLATFORM: triggered by a Wix Form submission / Automation (see events.js) instead of
// an inbound webhook, so the WIX_INTAKE_SECRET auth and the outbound Wix Contacts REST calls
// (findWixContactByEmail / updateWixContactExtendedFields / attachCertificateToWixContact) collapse
// into local wix-crm-backend updates — the contact already exists and its id arrives in the event.

import wixData from 'wix-data';
import { COLLECTIONS, DEFAULT_PREFIX } from 'backend/config';
import { resolvePrefix, assignMemberId } from 'backend/counter';
import { generateAndStore } from 'backend/cert';
import { updateContactMembership } from 'backend/wixContact';

const AUTH = { suppressAuth: true };

/**
 * @param {{ fullName: string, email: string, birthday?: string, phone?: string,
 *           contactId?: string, address: { line1?, city?, state?, postalCode, country } }} submission
 * @returns {Promise<{ ok, memberId, docId, certStatus, certUrl, alreadyExisted }>}
 */
export async function intake(submission) {
  const { fullName, email, birthday, phone, address, contactId } = submission || {};
  if (!fullName || !email || !address || !address.postalCode || !address.country) {
    throw Object.assign(
      new Error('fullName, email, address.postalCode, and address.country are required'),
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Idempotency: return the existing member for this email (no fresh id, no overwrite).
  const existing = await wixData
    .query(COLLECTIONS.members)
    .eq('email', normalizedEmail)
    .limit(1)
    .find(AUTH);
  if (existing.items.length) {
    const doc = existing.items[0];
    return {
      ok: true,
      memberId: doc.memberId,
      docId: doc._id,
      certStatus: doc.certStatus || null,
      certUrl: doc.certUrl || null,
      alreadyExisted: true,
    };
  }

  const prefix = resolvePrefix({ country: address.country, postalCode: address.postalCode }) || DEFAULT_PREFIX;
  const memberId = await assignMemberId(prefix);

  const [firstName, ...rest] = String(fullName).trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;

  // Certificate (best-effort — member is stored even if this fails).
  let certUrl = null;
  let certFileId = null;
  let certStatus = 'pending';
  try {
    const cert = await generateAndStore(memberId, firstName, lastName);
    certUrl = cert.url;
    certFileId = cert.fileId;
    certStatus = 'generated';
  } catch (err) {
    console.error('certificate generation failed for', memberId, err);
    certStatus = 'failed';
  }

  // Update the Wix contact's custom fields in-platform (best-effort).
  let wixFieldsUpdated = false;
  try {
    if (contactId) {
      await updateContactMembership(contactId, { memberId, certUrl });
      wixFieldsUpdated = true;
    }
  } catch (err) {
    console.warn('wix contact field update failed for', memberId, err);
  }

  const inserted = await wixData.insert(
    COLLECTIONS.members,
    {
      memberId,
      prefix,
      fullName,
      firstName,
      lastName,
      email: normalizedEmail,
      birthday: birthday || null,
      phone: phone || null,
      addressLine1: address.line1 || null,
      city: address.city || null,
      state: address.state || null,
      postalCode: address.postalCode,
      country: address.country,
      onboardingStatus: 'NOT_ONBOARDED',
      certStatus,
      certUrl,
      certFileId,
      wixContactId: contactId || null,
      wixFieldsUpdated,
      source: 'wix',
      flow: 'intake',
    },
    AUTH
  );

  return { ok: true, memberId, docId: inserted._id, certStatus, certUrl, alreadyExisted: false };
}
