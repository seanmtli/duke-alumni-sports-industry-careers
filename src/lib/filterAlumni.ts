import type { Alumni, FilterState, School, SortConfig } from '@/types/alumni';
import { US_STATES, METRO_BUCKETS } from '@/lib/locationNormalization';

// Non-suburb city names that bucket to themselves (no neighborhood variants
// to merge, unlike the NYC/LA/SF/Atlanta/Miami entries in METRO_BUCKETS).
const SELF_CITY_BUCKETS: Record<string, string> = {
  'new york': 'New York', 'los angeles': 'Los Angeles', 'san francisco': 'San Francisco',
  washington: 'Washington DC', durham: 'Durham', charlotte: 'Charlotte',
  atlanta: 'Atlanta', miami: 'Miami',
};

// Maps last segment of non-US locations to country names
const INTL_COUNTRY_MAP: Record<string, string> = {
  'UK': 'United Kingdom', 'LN': 'United Kingdom',
  'FR': 'France', 'BE': 'Switzerland', 'VR': 'Italy',
  '14': 'Malaysia', '24': 'India',
};

/** Returns the canonical location bucket for a given raw location string. */
export function extractLocation(location: string): string {
  if (!location) return '';

  const lower = location.trim().toLowerCase();
  if (METRO_BUCKETS[lower]) return METRO_BUCKETS[lower].city;

  const parts = location.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].toUpperCase();
    if (US_STATES.has(state)) {
      const city = parts[0].toLowerCase();
      return METRO_BUCKETS[city]?.city ?? SELF_CITY_BUCKETS[city] ?? 'Other US';
    }
    return INTL_COUNTRY_MAP[state] ?? 'International';
  }

  return 'International';
}

export type LocationOptions = {
  usCities: string[];
  countries: string[];
};

/** Derives available location filter options from the alumni list, ordered by count. */
export function buildLocationOptions(alumni: { location: string }[]): LocationOptions {
  const US_CITY_ORDER = [
    'New York', 'Durham', 'Charlotte', 'Los Angeles',
    'San Francisco', 'Washington DC', 'Atlanta', 'Miami', 'Other US',
  ];

  const present = new Set(alumni.map((a) => extractLocation(a.location)).filter(Boolean));
  const usCities = US_CITY_ORDER.filter((c) => present.has(c));
  const countries = [...present].filter((k) => !US_CITY_ORDER.includes(k)).sort();

  return { usCities, countries };
}

/** All distinct employers for one person: current company plus every past
 * employer, normalized and deduped. The single source of truth for what the
 * company filter matches and how options are counted. */
export function employersOf(a: Pick<Alumni, 'current_company' | 'work_history'>): string[] {
  const set = new Set<string>();
  const cur = a.current_company?.trim();
  if (cur) set.add(cur);
  for (const r of a.work_history ?? []) {
    const c = r.company?.trim();
    if (c) set.add(c);
  }
  return [...set];
}

/** Derives the list of company filter options from the alumni list, sorted alphabetically. */
export function buildCompanyOptions(
  alumni: Pick<Alumni, 'current_company' | 'work_history'>[],
): string[] {
  const names = new Set<string>();
  for (const a of alumni) {
    for (const company of employersOf(a)) {
      names.add(company);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Name-only search for the directory search bar. Company/industry/location
 * lookups belong in the sidebar filters. */
export function searchByName(alumni: Alumni[], query: string): Alumni[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return alumni;

  const tokens = q.split(/\s+/).filter(Boolean);

  return alumni.filter((person) => {
    const name = person.name.toLowerCase();
    const nameParts = name.split(/\s+/);

    if (name.includes(q)) return true;

    return tokens.every((token) =>
      nameParts.some((part) => part.startsWith(token) || part.includes(token))
    );
  });
}

export function filterAlumni(
  alumni: Alumni[],
  filters: FilterState,
  searchQuery: string,
): Alumni[] {
  // Step 1: Name search only
  let results = searchByName(alumni, searchQuery);

  // Step 2: Filter dimensions — AND between dims, OR within
  if (filters.orgCategories.length > 0) {
    results = results.filter(
      (a) => a.org_category != null && filters.orgCategories.includes(a.org_category)
    );
  }
  if (filters.sportsFunctions.length > 0) {
    results = results.filter((a) =>
      a.sports_functions?.some((f) => filters.sportsFunctions.includes(f))
    );
  }
  if (filters.schools.length > 0) {
    // Match ANY of the person's Duke degrees, not just the primary one — a
    // Trinity undergrad who later did a Fuqua MBA must appear under both.
    results = results.filter((a) => {
      const schools = a.all_degrees?.length
        ? a.all_degrees.map((d) => d.school)
        : [a.school];
      return schools.some((s) => filters.schools.includes(s as School));
    });
  }
  if (filters.locations.length > 0) {
    results = results.filter((a) => filters.locations.includes(extractLocation(a.location)));
  }
  if (filters.companies.length > 0) {
    results = results.filter((a) => {
      const pool = filters.includePastCompanies ? employersOf(a) : [a.current_company];
      return pool.some((c) => filters.companies.includes(c));
    });
  }
  if (filters.clubs.length > 0) {
    results = results.filter((a) =>
      a.clubs?.some((c) => filters.clubs.includes(c.slug))
    );
  }

  return results;
}

export function sortAlumni(alumni: Alumni[], sort: SortConfig): Alumni[] {
  return [...alumni].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    if (sort.field === 'name') {
      aVal = a.name.toLowerCase();
      bVal = b.name.toLowerCase();
    } else if (sort.field === 'grad_year') {
      aVal = a.grad_year ?? 0;
      bVal = b.grad_year ?? 0;
    } else {
      aVal = a.added_date;
      bVal = b.added_date;
    }

    if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
    return 0;
  });
}
