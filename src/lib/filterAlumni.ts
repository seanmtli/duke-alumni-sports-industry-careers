import Fuse from 'fuse.js';
import type { Alumni, FilterState, SortConfig } from '@/types/alumni';

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

let fuseInstance: Fuse<Alumni> | null = null;

export function getFuseInstance(alumni: Alumni[]): Fuse<Alumni> {
  if (!fuseInstance) {
    fuseInstance = new Fuse(alumni, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'current_company', weight: 1.5 },
        { name: 'current_title', weight: 1 },
        { name: 'location', weight: 0.8 },
        { name: 'sub_industries', weight: 0.6 },
      ],
      threshold: 0.2,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }
  return fuseInstance;
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
  if (filters.companyTypes.length > 0) {
    results = results.filter((a) => filters.companyTypes.includes(a.company_type));
  }
  if (filters.schools.length > 0) {
    results = results.filter((a) => filters.schools.includes(a.school));
  }
  if (filters.locations.length > 0) {
    results = results.filter((a) => filters.locations.includes(extractLocation(a.location)));
  }

  // Step 3: Grad year range — always applied
  results = results.filter(
    (a) =>
      a.grad_year >= filters.gradYearRange[0] &&
      a.grad_year <= filters.gradYearRange[1]
  );

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
      aVal = a.grad_year;
      bVal = b.grad_year;
    } else {
      aVal = a.added_date;
      bVal = b.added_date;
    }

    if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
    return 0;
  });
}
