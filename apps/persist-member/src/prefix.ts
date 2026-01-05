import zipcodes from "zipcodes";

export type PrefixInput = {
  country?: string | null;
  zipCode?: string | null; // only required when country is US
};

/**
 * Your org's US mapping: ZIP -> state -> prefix.
 * Fill this out with your real delegation rules.
 */
const US_STATE_TO_PREFIX: Record<string, string> = {
  NY: "DNY",
  NJ: "DNY", // example: NJ belongs to DNY
  // PA: "DPA",
  // CT: "DNY",
  // ...
};

/**
 * Non-US mapping: country -> prefix.
 * Use ISO-2 (PL, CA, DE, etc). Add what you support.
 */
const COUNTRY_TO_PREFIX: Record<string, string> = {
  // PL: "DPL",
  // CA: "DCA",
  // ...
};

function normalizeCountry(input?: string | null): string {
  const c = (input ?? "").trim().toUpperCase();
  if (c === "UNITED STATES" || c === "USA" || c === "US") return "US";
  return c; // assume ISO-2 for others (PL, CA, etc.)
}

function normalizeZip(input?: string | null): string | null {
  if (!input) return null;
  const m = input.trim().match(/^(\d{5})/); // supports 12345-6789
  return m ? m[1] : null;
}

/**
 * Returns delegation prefix (e.g., DNY) or null if it can't be determined.
 */
export function getMemberPrefix(input: PrefixInput): string | null {
  const country = normalizeCountry(input.country);

  // Non-US: direct mapping
  if (country && country !== "US") {
    return COUNTRY_TO_PREFIX[country] ?? null;
  }

  // US: ZIP required
  const zip = normalizeZip(input.zipCode);
  if (!zip) return null;

  const info = zipcodes.lookup(zip);
  if (!info?.state) return null;

  return US_STATE_TO_PREFIX[info.state] ?? null;
}