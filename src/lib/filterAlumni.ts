import Fuse from 'fuse.js';
import type { Alumni, FilterState, School, SortConfig } from '@/types/alumni';

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

// Maps lowercased city names to their canonical filter bucket
const US_CITY_BUCKETS: Record<string, string> = {
  // New York metro
  'new york': 'New York', 'brooklyn': 'New York', 'bronxville': 'New York',
  'briarcliff manor': 'New York', 'great neck': 'New York', 'new hyde park': 'New York',
  'long island city': 'New York', 'scarsdale': 'New York', 'east hampton': 'New York',
  // Los Angeles metro
  'los angeles': 'Los Angeles', 'marina del rey': 'Los Angeles',
  'santa monica': 'Los Angeles', 'calabasas': 'Los Angeles',
  // San Francisco Bay Area
  'san francisco': 'San Francisco', 'los altos': 'San Francisco', 'san jose': 'San Francisco',
  // Washington DC
  'washington': 'Washington DC',
  // Durham
  'durham': 'Durham',
  // Charlotte
  'charlotte': 'Charlotte',
  // Atlanta metro
  'atlanta': 'Atlanta', 'suwanee': 'Atlanta',
  // Miami metro
  'miami': 'Miami', 'miami lakes': 'Miami', 'deerfield beach': 'Miami',
};

// Maps last segment of non-US locations to country names
const INTL_COUNTRY_MAP: Record<string, string> = {
  'UK': 'United Kingdom', 'LN': 'United Kingdom',
  'FR': 'France', 'BE': 'Switzerland', 'VR': 'Italy',
  '14': 'Malaysia', '24': 'India',
};

// No-comma metro area strings → bucket
const METRO_STRING_MAP: Record<string, string> = {
  'new york city metropolitan area': 'New York',
  'new york metropolitan area': 'New York',
};

/** Returns the canonical location bucket for a given raw location string. */
export function extractLocation(location: string): string {
  if (!location) return '';

  const lower = location.trim().toLowerCase();
  if (METRO_STRING_MAP[lower]) return METRO_STRING_MAP[lower];

  const parts = location.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].toUpperCase();
    if (US_STATES.has(state)) {
      const city = parts[0].toLowerCase();
      return US_CITY_BUCKETS[city] ?? 'Other US';
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

/**
 * Derives the list of company filter options from the alumni list, ordered by
 * how many alumni are associated with each employer (current or past),
 * descending, then alphabetically.
 */
export function buildCompanyOptions(
  alumni: Pick<Alumni, 'current_company' | 'work_history'>[],
): string[] {
  const counts = new Map<string, number>();
  for (const a of alumni) {
    for (const company of employersOf(a)) {
      counts.set(company, (counts.get(company) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([company]) => company);
}

export function filterAlumni(
  alumni: Alumni[],
  filters: FilterState,
  searchQuery: string,
  fuse: Fuse<Alumni>
): Alumni[] {
  // Step 1: Full-text search
  let results =
    searchQuery.trim().length >= 2
      ? fuse.search(searchQuery).map((r) => r.item)
      : [...alumni];

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
