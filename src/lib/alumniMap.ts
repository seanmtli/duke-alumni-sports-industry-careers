import type { Alumni, CompanyType, OrgCategory, Role, School, SeniorityLevel, SportsFunction } from '@/types/alumni';
import { normalizeCompany } from '@/lib/companyNormalization';

// Shared mapping between the Supabase `people`(+`duke_degrees`) rows and the
// app's flat `Alumni` shape. The site reads Supabase directly at request time
// (this replaced the old build-time JSON export step).

export interface PeopleRow {
  id: string; // Supabase uuid (primary key) — the admin edit/delete key
  crustdata_person_id: string | null;
  full_name: string | null;
  current_company: string | null;
  current_title: string | null;
  org_category: string | null;
  sports_functions: string[] | null;
  seniority_level: string | null;
  linkedin_url: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  headshot_url: string | null;
  sports_league_affiliation: string | null;
  bio: string | null;
  reach_out_for: string[] | null;
  added_date: string | null;
  last_verified: string | null;
  duke_degrees?: DegreeRow[];
  work_history?: WorkHistoryRow[];
}

export interface DegreeRow {
  school: string | null;
  degree: string | null;
  grad_year: number | null;
  major: string | null;
}

export interface WorkHistoryRow {
  company: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
}

// new org_category -> representative legacy company_type (for the current UI)
export const ORG_TO_COMPANY_TYPE: Record<string, CompanyType> = {
  leagues_governing: 'League',
  teams_clubs: 'Team',
  betting_gaming: 'Sports Betting',
  media_broadcast: 'Media',
  sports_tech_data: 'Startup',
  big_tech_vertical: 'Big Tech',
  agencies_rep: 'Agency',
  investing_advisory: 'VC/PE',
  infra_experiences: 'Other',
  brands_sponsors: 'Brand',
  collegiate: 'University',
  nonprofit_other: 'Non-Profit',
};

// reverse: legacy company_type -> org_category (for admin writes)
export const COMPANY_TYPE_TO_ORG: Record<CompanyType, OrgCategory> = {
  League: 'leagues_governing',
  Team: 'teams_clubs',
  'Sports Betting': 'betting_gaming',
  Media: 'media_broadcast',
  Startup: 'sports_tech_data',
  'Big Tech': 'big_tech_vertical',
  Agency: 'agencies_rep',
  'VC/PE': 'investing_advisory',
  Brand: 'brands_sponsors',
  University: 'collegiate',
  'Non-Profit': 'nonprofit_other',
  Consulting: 'investing_advisory',
  Other: 'infra_experiences',
};

const VALID_SCHOOLS: ReadonlySet<string> = new Set<School>([
  'Trinity', 'Pratt', 'Fuqua', 'Law', 'Medicine', 'Nicholas', 'Sanford', 'Other',
]);

export function slugify(name: string | null, year: number | null): string {
  const s = (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return year ? `${s}-${year}` : s;
}

const UNDERGRAD_DEGREE = /\b(BA|BS|AB|BSE|Bachelor)/i;

/** The most identifying degree — the earliest by grad_year (usually undergrad).
 * When no degree carries a year (Crustdata's education end_dates are often
 * null), prefer an undergraduate degree over a graduate one rather than falling
 * back to the arbitrary array order. */
function pickPrimaryDegree(degrees: DegreeRow[]): DegreeRow | null {
  const withYear = degrees.filter((d) => d.grad_year != null);
  if (withYear.length > 0) {
    return withYear.reduce((a, b) => (a.grad_year! <= b.grad_year! ? a : b));
  }
  return degrees.find((d) => UNDERGRAD_DEGREE.test(d.degree ?? '')) ?? degrees[0] ?? null;
}

function normalizeSchool(school: string | null, degreeStr: string): School {
  const s = school || 'Other';
  if (VALID_SCHOOLS.has(s)) return s as School;
  // "General" = matched the parent "Duke University" entity; a bachelor's there
  // is almost always Trinity (undergrad college).
  if (s === 'General' && /\b(BA|BS|AB|Bachelor)/i.test(degreeStr)) return 'Trinity';
  return 'Other';
}

/** Map a Supabase people row (with embedded duke_degrees) to an Alumni record. */
export function mapPersonToAlumni(p: PeopleRow): Alumni {
  const degrees = p.duke_degrees ?? [];
  const primary = pickPrimaryDegree(degrees);
  const gradYear = primary?.grad_year ?? null;
  const degreeStr = primary?.degree ?? '';
  const school = normalizeSchool(primary?.school ?? null, degreeStr);
  const location =
    [p.location_city, p.location_state].filter(Boolean).join(', ') || p.location_country || '';

  return {
    id: p.crustdata_person_id ? `cd-${p.crustdata_person_id}` : slugify(p.full_name, gradYear),
    person_id: p.id,
    name: p.full_name ?? '',
    grad_year: gradYear,
    school,
    degree: degreeStr,
    major: primary?.major ?? '',
    current_company: normalizeCompany(p.current_company),
    current_title: p.current_title ?? '',
    company_type: ORG_TO_COMPANY_TYPE[p.org_category ?? ''] ?? 'Other',
    sub_industries: [],
    seniority_level: (p.seniority_level as SeniorityLevel) || 'Mid',
    linkedin_url: p.linkedin_url ?? '',
    location,
    headshot_url: p.headshot_url,
    sports_league_affiliation: p.sports_league_affiliation,
    org_category: (p.org_category as OrgCategory) ?? null,
    sports_functions: (p.sports_functions as SportsFunction[]) ?? [],
    all_degrees: degrees.map((d) => ({
      // Normalize each degree's school so a raw 'General' (the parent
      // "Duke University" entity) renders and filters as Trinity, matching how
      // the primary `school` field is derived.
      school: normalizeSchool(d.school ?? null, d.degree ?? ''),
      degree: d.degree,
      grad_year: d.grad_year,
      major: d.major,
    })),
    work_history: mapWorkHistory(p.work_history),
    bio: p.bio ?? undefined,
    reach_out_for: p.reach_out_for ?? undefined,
    added_date: p.added_date ?? '',
    last_verified: p.last_verified ?? '',
  };
}

/** Order roles current-first, then most-recent start first. */
function mapWorkHistory(rows: WorkHistoryRow[] | undefined): Role[] {
  return (rows ?? [])
    .filter((r): r is WorkHistoryRow & { company: string } => !!r.company)
    .map((r) => ({
      company: normalizeCompany(r.company),
      title: r.title,
      start_date: r.start_date,
      end_date: r.end_date,
      is_current: !!r.is_current,
    }))
    .sort((a, b) => {
      if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
      return (b.start_date ?? '').localeCompare(a.start_date ?? '');
    });
}

const PEOPLE_SELECT =
  'id,crustdata_person_id,full_name,current_company,current_title,org_category,' +
  'sports_functions,seniority_level,linkedin_url,location_city,location_state,' +
  'location_country,headshot_url,sports_league_affiliation,bio,reach_out_for,' +
  'added_date,last_verified,duke_degrees(school,degree,grad_year,major),' +
  'work_history(company,title,start_date,end_date,is_current)';

export { PEOPLE_SELECT };
