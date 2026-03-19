import zipcodes from 'zipcodes';

// Delegation prefixes are defined in src/geo_code.json.
// This module resolves a member's prefix from their address.

// ---------------------------------------------------------------------------
// US: map state abbreviation → delegation city
// Adjust these boundaries to match PSM's organisational structure.
// ---------------------------------------------------------------------------
const US_STATE_TO_PREFIX: Record<string, string> = {
  // Northeast → New York HQ (DNY)
  NY: 'DNY', NJ: 'DNY', CT: 'DNY', MA: 'DNY', RI: 'DNY',
  NH: 'DNY', VT: 'DNY', ME: 'DNY', PA: 'DNY', DE: 'DNY',
  MD: 'DNY', DC: 'DNY', VA: 'DNY', WV: 'DNY',

  // Midwest → Chicago (DCH)
  IL: 'DCH', WI: 'DCH', IN: 'DCH', MI: 'DCH', OH: 'DCH',
  MN: 'DCH', IA: 'DCH', MO: 'DCH', ND: 'DCH', SD: 'DCH',
  NE: 'DCH', KS: 'DCH',

  // Southeast → Miami (DMI)
  FL: 'DMI', GA: 'DMI', SC: 'DMI', NC: 'DMI', TN: 'DMI',
  AL: 'DMI', MS: 'DMI', KY: 'DMI', AR: 'DMI', LA: 'DMI',

  // Texas region → San Antonio (DSA)
  TX: 'DSA', OK: 'DSA', NM: 'DSA',

  // West → Los Angeles (DLA)
  CA: 'DLA', AZ: 'DLA', NV: 'DLA', CO: 'DLA', UT: 'DLA',
  WA: 'DLA', OR: 'DLA', ID: 'DLA', MT: 'DLA', WY: 'DLA',
  AK: 'DLA', HI: 'DLA',
};

// ---------------------------------------------------------------------------
// Poland: map postal code first-2-digit range → voivodeship branch
// Polish postal codes are XX-XXX. Ranges are approximate — the mapping is
// not perfectly linear but this covers the vast majority of addresses.
// ---------------------------------------------------------------------------
function polishPostalToPrefix(postalCode: string): string {
  const digits = postalCode.replace(/\D/g, '');
  if (digits.length < 2) return 'DPL'; // fallback to Warsaw
  const n = parseInt(digits.slice(0, 2), 10);

  if (n <= 9)  return 'DPL';   // Masovian (Warsaw)
  if (n <= 14) return 'PLMN';  // Warmian-Masurian
  if (n <= 19) return 'PLPD';  // Podlaskie
  if (n <= 24) return 'PLLU';  // Lublin
  if (n <= 28) return 'PLSK';  // Świętokrzyskie
  if (n === 29) return 'DPL';  // Masovian (Warsaw, edge)
  if (n <= 34) return 'PLMA';  // Lesser Poland (Kraków)
  if (n <= 39) return 'PLPK';  // Subcarpathian
  if (n <= 44) return 'PLSL';  // Silesian
  if (n <= 49) return 'PLOP';  // Opole
  if (n <= 59) return 'PLDS';  // Lower Silesian (Wrocław)
  if (n <= 64) return 'PLWP';  // Greater Poland (Poznań)
  if (n <= 69) return 'PLLB';  // Lubusz
  if (n <= 76) return 'PLZP';  // West Pomeranian
  if (n <= 84) return 'PLPM';  // Pomeranian
  if (n <= 89) return 'PLKP';  // Kuyavian-Pomeranian
  return 'PLLD';               // Łódź (90–99)
}

// ---------------------------------------------------------------------------
// Other countries: ISO-2 country code → delegation prefix
// ---------------------------------------------------------------------------
const COUNTRY_TO_PREFIX: Record<string, string> = {
  IT: 'DIT',
  ES: 'DES',
  CA: 'DCA',
  GB: 'DGB',
  FR: 'DFR',
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export type PrefixInput = {
  country: string;   // ISO-2 code: "US", "PL", "IT", etc.
  postalCode: string;
};

/**
 * Resolves the PSM delegation/branch prefix for a new member.
 * Returns null if the country is unrecognised and has no fallback.
 * Callers should use DNY (HQ) as the final fallback.
 */
export function getMemberPrefix(input: PrefixInput): string | null {
  const country = normaliseCountry(input.country);

  if (country === 'US') {
    const zip = normaliseZip(input.postalCode);
    if (!zip) return null;
    const info = zipcodes.lookup(zip);
    if (!info?.state) return null;
    return US_STATE_TO_PREFIX[info.state] ?? null;
  }

  if (country === 'PL') {
    return polishPostalToPrefix(input.postalCode);
  }

  return COUNTRY_TO_PREFIX[country] ?? null;
}

function normaliseCountry(raw: string): string {
  const c = raw.trim().toUpperCase();
  if (c === 'UNITED STATES' || c === 'USA') return 'US';
  if (c === 'POLAND') return 'PL';
  if (c === 'UNITED KINGDOM' || c === 'UK') return 'GB';
  if (c === 'CANADA') return 'CA';
  if (c === 'FRANCE') return 'FR';
  if (c === 'ITALY') return 'IT';
  if (c === 'SPAIN') return 'ES';
  return c;
}

function normaliseZip(raw: string): string | null {
  const m = raw.trim().match(/^(\d{5})/);
  return m ? m[1] : null;
}
