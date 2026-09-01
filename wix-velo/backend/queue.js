// backend/queue.js
// Port of member-onboarding GET /api/members/pending and DELETE /api/members/:docId.
// Reads the Members CMS collection, computes the same duplicate/error flags for the admin queue.

import wixData from 'wix-data';
import { COLLECTIONS } from 'backend/config';

const AUTH = { suppressAuth: true };
const PENDING_LIMIT = 100;

// Cap the dedup scan. Firestore projected the whole collection cheaply; Wix Data reads are
// quota-metered and paginated, so we bound it and flag when the cap is hit. Raise if needed.
const DEDUP_SCAN_CAP = 2000;

/**
 * List NOT_ONBOARDED members with duplicate_email / duplicate_name / wix-status flags.
 * @returns {Promise<{ ok: boolean, members: any[], truncatedScan?: boolean }>}
 */
export async function listPending() {
  const pending = await wixData
    .query(COLLECTIONS.members)
    .eq('onboardingStatus', 'NOT_ONBOARDED')
    .descending('_createdDate')
    .limit(PENDING_LIMIT)
    .find(AUTH);

  // Build email/name frequency maps across the collection (bounded).
  const emailCounts = new Map();
  const nameCounts = new Map();
  let scanned = 0;
  let truncatedScan = false;

  let page = await wixData
    .query(COLLECTIONS.members)
    .limit(1000)
    .find(AUTH);
  while (page && page.items.length) {
    for (const d of page.items) {
      const email = String(d.email || '').trim().toLowerCase();
      const name = String(d.fullName || '').trim().toLowerCase();
      if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
    scanned += page.items.length;
    if (scanned >= DEDUP_SCAN_CAP) { truncatedScan = true; break; }
    if (!page.hasNext()) break;
    page = await page.next();
  }

  const members = pending.items.map((data) => {
    const email = String(data.email || '').trim().toLowerCase();
    const name = String(data.fullName || '').trim().toLowerCase();
    const flags = [];
    if (email && (emailCounts.get(email) || 0) > 1) flags.push('duplicate_email');
    if (name && (nameCounts.get(name) || 0) > 1) flags.push('duplicate_name');
    if (!data.wixContactId) flags.push('no_wix_contact');
    if (data.wixAttachStatus === 'failed') flags.push('wix_attach_failed');
    if (data.wixFieldsUpdated === false && data.wixContactId) flags.push('wix_fields_not_updated');

    return {
      docId: data._id,
      memberId: data.memberId,
      fullName: data.fullName,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      prefix: data.prefix,
      address: {
        line1: data.addressLine1,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
      },
      birthday: data.birthday,
      phone: data.phone,
      certStatus: data.certStatus,
      createdAt: data._createdDate,
      wixContactId: data.wixContactId || null,
      wixAttachStatus: data.wixAttachStatus || null,
      wixFieldsUpdated: data.wixFieldsUpdated || false,
      flags,
    };
  });

  return { ok: true, members, truncatedScan };
}

/**
 * Remove a member from the queue (deletes the CMS row only; cert in Media is preserved).
 */
export async function deleteMember(docId) {
  if (!docId) throw Object.assign(new Error('docId is required'), { status: 400 });
  const existing = await wixData.get(COLLECTIONS.members, docId, AUTH);
  if (!existing) throw Object.assign(new Error('member not found'), { status: 400 });
  await wixData.remove(COLLECTIONS.members, docId, AUTH);
  return { ok: true };
}
