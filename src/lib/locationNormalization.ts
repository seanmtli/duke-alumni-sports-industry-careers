// Single source of truth for city/state normalization. Crustdata (and hand
// entry) sometimes return the state as a full name ("New York") instead of a
// 2-letter code ("NY"), and neighborhood cities get reported instead of their
// metro area. Without this, "New York, New York" and "New York, NY" split
// into separate stats buckets and filter options.
//
// Applied in `mapPersonToAlumni`, so every downstream consumer (stats,
// filters, search) sees one canonical location string. The raw value in
// Supabase is left untouched — same pattern as companyNormalization.ts.

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
};

export const US_STATES: ReadonlySet<string> = new Set(Object.values(STATE_NAME_TO_ABBR));

/** Full state name -> 2-letter code; already-valid codes pass through
 * uppercased; anything else (countries, unrecognized regions) is returned as-is. */
export function normalizeStateToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const abbr = STATE_NAME_TO_ABBR[trimmed.toLowerCase()];
  if (abbr) return abbr;
  const upper = trimmed.toUpperCase();
  if (US_STATES.has(upper)) return upper;
  return trimmed;
}

/** Neighborhood/suburb (lowercased key, plus a couple of no-comma metro-area
 * strings) -> its canonical metro {city, state}. Shared by computeStats (city
 * display bucket, "City, ST") and filterAlumni (broader metro filter bucket,
 * bare city name) so both read the same list instead of drifting. */
export const METRO_BUCKETS: Record<string, { city: string; state: string }> = {
  'new york city metropolitan area': { city: 'New York', state: 'NY' },
  'new york metropolitan area': { city: 'New York', state: 'NY' },
  brooklyn: { city: 'New York', state: 'NY' },
  bronxville: { city: 'New York', state: 'NY' },
  'briarcliff manor': { city: 'New York', state: 'NY' },
  'great neck': { city: 'New York', state: 'NY' },
  'new hyde park': { city: 'New York', state: 'NY' },
  'long island city': { city: 'New York', state: 'NY' },
  scarsdale: { city: 'New York', state: 'NY' },
  'east hampton': { city: 'New York', state: 'NY' },
  'port washington': { city: 'New York', state: 'NY' },
  'marina del rey': { city: 'Los Angeles', state: 'CA' },
  'santa monica': { city: 'Los Angeles', state: 'CA' },
  calabasas: { city: 'Los Angeles', state: 'CA' },
  'los altos': { city: 'San Francisco', state: 'CA' },
  'san jose': { city: 'San Francisco', state: 'CA' },
  suwanee: { city: 'Atlanta', state: 'GA' },
  'miami lakes': { city: 'Miami', state: 'FL' },
  'deerfield beach': { city: 'Miami', state: 'FL' },
};

/** Builds the canonical "City, ST" (US) or "City, Country" display string. */
export function formatLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined
): string {
  const c = (city ?? '').trim();
  const s = normalizeStateToken(state ?? '');
  if (c && s) return `${c}, ${s}`;
  return c || (country ?? '').trim();
}
