export type CompanyType =
  | 'Startup'
  | 'League'
  | 'Team'
  | 'Big Tech'
  | 'Consulting'
  | 'VC/PE'
  | 'Media'
  | 'Agency'
  | 'University'
  | 'Non-Profit'
  | 'Brand'
  | 'Sports Betting'
  | 'Other';

// --- New 2-axis taxonomy (mirrors Supabase reference tables) ---

// Axis 1 — organization category (one per person)
export type OrgCategory =
  | 'leagues_governing'
  | 'teams_clubs'
  | 'betting_gaming'
  | 'media_broadcast'
  | 'sports_tech_data'
  | 'big_tech_vertical'
  | 'agencies_rep'
  | 'investing_advisory'
  | 'infra_experiences'
  | 'brands_sponsors'
  | 'collegiate'
  | 'nonprofit_other';

// Axis 2 — sports function / domain (one or more per person)
export type SportsFunction =
  | 'front_office'
  | 'partnerships'
  | 'media_content'
  | 'ticketing_revenue'
  | 'data_analytics'
  | 'product_eng'
  | 'sales_account'
  | 'strategy_corpdev'
  | 'marketing_fan'
  | 'investing_deal'
  | 'legal_rep'
  | 'health_athlete';

export type SeniorityLevel =
  | 'Entry'
  | 'Mid'
  | 'Senior'
  | 'VP/Director'
  | 'C-Suite/Exec';

export type SubIndustry =
  | 'Fan Data/CDP'
  | 'Ticketing'
  | 'Sponsorship & Partnerships'
  | 'Sports Gambling/Betting'
  | 'Media & Broadcasting'
  | 'Sports Analytics'
  | 'Fan Experience & Engagement'
  | 'Venue & Event Tech'
  | 'Athlete Tech'
  | 'Sports at Big Tech'
  | 'League/Team Front Office'
  | 'VC/PE/Investment in Sports'
  | 'Sports Consulting'
  | 'Esports & Gaming'
  | 'Sports Data Infrastructure'
  | 'Collegiate/Amateur Sports'
  | 'Fitness & Wellness Tech';

export type School =
  | 'Trinity'
  | 'Pratt'
  | 'Fuqua'
  | 'Law'
  | 'Medicine'
  | 'Nicholas'
  | 'Sanford'
  | 'Other';

export interface DukeDegree {
  school: School | string;
  degree: string | null;
  grad_year: number | null;
  major: string | null;
}

export interface Alumni {
  id: string;
  name: string;
  grad_year: number | null;
  school: School;
  degree: string;
  major: string;
  current_company: string;
  current_title: string;
  company_type: CompanyType;
  sub_industries: SubIndustry[];
  // new taxonomy (always present in exported data; optional so the admin form,
  // which still uses the legacy fields, keeps compiling)
  org_category?: OrgCategory | null;
  sports_functions?: SportsFunction[];
  all_degrees?: DukeDegree[];
  seniority_level: SeniorityLevel;
  linkedin_url: string;
  location: string;
  headshot_url: string | null;
  sports_league_affiliation: string | null;
  bio?: string;
  reach_out_for?: string[];
  added_date: string;
  last_verified: string;
}

export interface FilterState {
  orgCategories: OrgCategory[];
  sportsFunctions: SportsFunction[];
  schools: School[];
  locations: string[];
  gradYearRange: [number, number];
}

export interface SortConfig {
  field: 'name' | 'grad_year' | 'added_date';
  direction: 'asc' | 'desc';
}

export interface AlumniStats {
  totalAlumni: number;
  totalCompanies: number;
  schoolsRepresented: number;
  citiesRepresented: number;
  bySportsFunction: { label: string; count: number }[];
  byOrgCategory: { label: string; count: number }[];
  bySeniority: { label: string; count: number }[];
  byGradDecade: { decade: string; count: number }[];
  topCompanies: { label: string; count: number }[];
  topCities: { label: string; count: number }[];
}

export const DEFAULT_FILTERS: FilterState = {
  orgCategories: [],
  sportsFunctions: [],
  schools: [],
  locations: [],
  // Upper bound extends past the current year so "incoming"/future-dated grads
  // (e.g. current students and rising analysts) are not hidden by default.
  gradYearRange: [1970, new Date().getFullYear() + 6],
};

export function getYearsExperience(alumni: Alumni): number {
  if (!alumni.grad_year) return 0;
  return new Date().getFullYear() - alumni.grad_year;
}

export interface ContactRequest {
  request_id: string;
  submitted_at: string;
  name: string;
  email: string;
  type: 'removal' | 'contact';
  linkedin_url: string;
  message: string;
}

export interface Submission {
  submission_id: string;
  submitted_at: string;
  name: string;
  grad_year: number;
  school: School;
  degree: string;
  major: string;
  current_company: string;
  current_title: string;
  company_type: CompanyType;
  seniority_level: SeniorityLevel;
  linkedin_url: string;
  location: string;
  bio: string;
  reach_out_for: string[];
}
