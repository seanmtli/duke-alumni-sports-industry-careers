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

export interface Alumni {
  id: string;
  name: string;
  grad_year: number;
  school: School;
  degree: string;
  major: string;
  current_company: string;
  current_title: string;
  company_type: CompanyType;
  sub_industries: SubIndustry[];
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
  companyTypes: CompanyType[];
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
  bySubIndustry: { label: string; count: number }[];
  byCompanyType: { label: string; count: number }[];
  bySeniority: { label: string; count: number }[];
  byGradDecade: { decade: string; count: number }[];
  topCompanies: { label: string; count: number }[];
  topCities: { label: string; count: number }[];
}

export const DEFAULT_FILTERS: FilterState = {
  companyTypes: [],
  schools: [],
  locations: [],
  gradYearRange: [1970, new Date().getFullYear()],
};

export function getYearsExperience(alumni: Alumni): number {
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
