// backend/lib/geoPrefix.js
// Canonical PSM delegation-prefix resolver. Ported verbatim from
// apps/member-onboarding/src/geoPrefix.ts (the rich resolver — chosen over persist-member's stub).
// Requires the `zipcodes` npm package (install via the Velo Package Manager).

import zipcodes from 'zipcodes';

// US: state abbreviation -> delegation prefix.
const US_STATE_TO_PREFIX = {
  NY: 'DNY', NJ: 'DNY', CT: 'DNY', MA: 'DNY', RI: 'DNY',
  NH: 'DNY', VT: 'DNY', ME: 'DNY', PA: 'DNY', DE: 'DNY',
  MD: 'DNY', DC: 'DNY', VA: 'DNY', WV: 'DNY',

  IL: 'DCH', WI: 'DCH', IN: 'DCH', MI: 'DCH', OH: 'DCH',
  MN: 'DCH', IA: 'DCH', MO: 'DCH', ND: 'DCH', SD: 'DCH',
  NE: 'DCH', KS: 'DCH',

  FL: 'DMI', GA: 'DMI', SC: 'DMI', NC: 'DMI', TN: 'DMI',
  AL: 'DMI', MS: 'DMI', KY: 'DMI', AR: 'DMI', LA: 'DMI',

  TX: 'DSA', OK: 'DSA', NM: 'DSA',

  CA: 'DLA', AZ: 'DLA', NV: 'DLA', CO: 'DLA', UT: 'DLA',
  WA: 'DLA', OR: 'DLA', ID: 'DLA', MT: 'DLA', WY: 'DLA',
  AK: 'DLA', HI: 'DLA',
};

// Poland: postal-code first-2-digit range -> voivodeship branch.
function polishPostalToPrefix(postalCode) {
  const digits = String(postalCode || '').replace(/\D/g, '');
  if (digits.length < 2) return 'DPL';
  const n = parseInt(digits.slice(0, 2), 10);

  if (n <= 9) return 'DPL';
  if (n <= 14) return 'PLMN';
  if (n <= 19) return 'PLPD';
  if (n <= 24) return 'PLLU';
  if (n <= 28) return 'PLSK';
  if (n === 29) return 'DPL';
  if (n <= 34) return 'PLMA';
  if (n <= 39) return 'PLPK';
  if (n <= 44) return 'PLSL';
  if (n <= 49) return 'PLOP';
  if (n <= 59) return 'PLDS';
  if (n <= 64) return 'PLWP';
  if (n <= 69) return 'PLLB';
  if (n <= 76) return 'PLZP';
  if (n <= 84) return 'PLPM';
  if (n <= 89) return 'PLKP';
  return 'PLLD';
}

const COUNTRY_TO_PREFIX = { IT: 'DIT', ES: 'DES', CA: 'DCA', GB: 'DGB', FR: 'DFR' };

function normaliseCountry(raw) {
  const c = String(raw || '').trim().toUpperCase();
  if (c === 'UNITED STATES' || c === 'USA') return 'US';
  if (c === 'POLAND') return 'PL';
  if (c === 'UNITED KINGDOM' || c === 'UK') return 'GB';
  if (c === 'CANADA') return 'CA';
  if (c === 'FRANCE') return 'FR';
  if (c === 'ITALY') return 'IT';
  if (c === 'SPAIN') return 'ES';
  return c;
}

function normaliseZip(raw) {
  const m = String(raw || '').trim().match(/^(\d{5})/);
  return m ? m[1] : null;
}

/**
 * Resolves the PSM delegation/branch prefix for a new member.
 * Returns null if the country is unrecognised and has no fallback.
 * Callers should use DEFAULT_PREFIX (DNY / HQ) as the final fallback.
 * @param {{ country: string, postalCode: string }} input
 * @returns {string | null}
 */
export function getMemberPrefix(input) {
  const country = normaliseCountry(input.country);

  if (country === 'US') {
    const zip = normaliseZip(input.postalCode);
    if (!zip) return null;
    const info = zipcodes.lookup(zip);
    if (!info || !info.state) return null;
    return US_STATE_TO_PREFIX[info.state] || null;
  }

  if (country === 'PL') {
    return polishPostalToPrefix(input.postalCode);
  }

  return COUNTRY_TO_PREFIX[country] || null;
}
