// backend/config.js
// Shared constants for the PSM Velo backend.

// Only Google Workspace accounts in this domain may use the internal tools.
export const ALLOWED_DOMAIN = 'polishyouth.org';

// All member-facing mail is CC'd here (matches the old member-onboarding behaviour).
export const RECORDS_CC = 'records@polishyouth.org';

// HQ fallback prefix when the resolver can't determine a branch (see lib/geoPrefix.js).
export const DEFAULT_PREFIX = 'DNY';

// Named Wix CMS collections.
export const COLLECTIONS = {
  members: 'Members',
  counters: 'Counters',
  memberIds: 'MemberIds',
  volunteerRequests: 'VolunteerRequests',
};
