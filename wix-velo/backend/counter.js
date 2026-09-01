// backend/counter.js
// Atomic member-ID assignment on Wix Data.
//
// Firestore gave us a real transaction (see apps/persist-member/src/index.ts and
// apps/member-onboarding assignMemberId). Wix Data has NO transactions and NO atomic increment,
// so we lean on the ONE atomic primitive it does offer: a unique `_id` insert fails on duplicates.
//
// Strategy: read the Counters hint for the prefix, form candidate `${prefix}${next}`, and try to
// INSERT it into MemberIds (unique _id). If the insert succeeds we won the slot; if it throws
// (duplicate), someone else took that number — bump the hint and retry. IDs are therefore always
// unique, though the sequence may skip numbers under contention (acceptable; same as any CAS).
//
// Member ID format matches the CODE (not the docs): `${prefix}${number}` with NO zero-padding.

import wixData from 'wix-data';
import { getMemberPrefix } from 'backend/lib/geoPrefix';
import { COLLECTIONS, DEFAULT_PREFIX } from 'backend/config';

const MAX_ATTEMPTS = 12;
const AUTH = { suppressAuth: true };

/**
 * Resolve the delegation prefix from address input, falling back to HQ.
 * @param {{ country?: string, postalCode?: string, location?: string }} input
 * @returns {string}
 */
export function resolvePrefix(input) {
  // member-onboarding passes structured {country, postalCode}. persist-member historically passed a
  // freeform `location`; treat a bare US ZIP or country name through the same resolver.
  const country = input.country || guessCountryFromLocation(input.location);
  const postalCode = input.postalCode || extractZip(input.location);
  const resolved = getMemberPrefix({ country, postalCode });
  return resolved || DEFAULT_PREFIX;
}

function extractZip(location) {
  const m = String(location || '').match(/\b(\d{5})\b/);
  return m ? m[1] : '';
}
function guessCountryFromLocation(location) {
  const loc = String(location || '').trim();
  if (/^\d{5}\b/.test(loc)) return 'US';
  return loc; // let normaliseCountry() in geoPrefix handle names like "Poland"
}

async function readNext(prefix) {
  const item = await wixData.get(COLLECTIONS.counters, prefix, AUTH);
  return item && typeof item.next === 'number' ? item.next : 1;
}

async function bumpHint(prefix, to) {
  // Best-effort advance of the hint. `save` upserts by _id.
  await wixData.save(COLLECTIONS.counters, { _id: prefix, next: to }, AUTH);
}

/**
 * Assign the next unique member ID for a prefix. Concurrency-safe via unique-_id insert.
 * @param {string} prefix
 * @returns {Promise<string>} the assigned memberId, e.g. "DNY42"
 */
export async function assignMemberId(prefix) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const next = await readNext(prefix);
    const candidate = `${prefix}${next}`;
    try {
      // Unique _id insert is the atomic guard: throws if this id is already taken.
      await wixData.insert(COLLECTIONS.memberIds, { _id: candidate, prefix, n: next }, AUTH);
      await bumpHint(prefix, next + 1);
      return candidate;
    } catch (err) {
      // Duplicate — another request grabbed this number. Advance the hint and retry.
      await bumpHint(prefix, next + 1);
    }
  }
  throw new Error(`counter contention: could not assign id for prefix ${prefix}`);
}
