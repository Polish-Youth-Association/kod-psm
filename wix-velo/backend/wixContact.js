// backend/wixContact.js
// In-platform replacement for the old outbound Wix Contacts v4 REST calls
// (findWixContactByEmail / updateWixContactExtendedFields). We're inside Wix now, so use
// wix-crm-backend directly. Custom-field keys match the originals in member-onboarding/server.ts.

import contacts from 'wix-crm-backend';

const AUTH = { suppressAuth: true };

// Custom field keys created in the Wix dashboard (unchanged from the old service).
export const FIELD_MEMBER_ID = 'custom.membership_id_cvtyjgiautctnhvxvwcpo';
export const FIELD_CERT_URL = 'custom.certificate_url';

/** Look up a contact id by email (kept for flows where the event doesn't carry a contactId). */
export async function findContactIdByEmail(email) {
  const res = await contacts.queryContacts()
    .eq('info.emails.email', String(email).trim().toLowerCase())
    .find(AUTH);
  const c = res.items && res.items[0];
  return c ? c._id : null;
}

/** Patch a contact's membership custom fields. Best-effort. */
export async function updateContactMembership(contactId, { memberId, certUrl }) {
  const info = { extendedFields: {} };
  info.extendedFields[FIELD_MEMBER_ID] = memberId;
  if (certUrl) info.extendedFields[FIELD_CERT_URL] = certUrl;
  return contacts.updateContact(contactId, { info }, AUTH);
}
