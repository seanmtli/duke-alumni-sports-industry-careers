import type {
  SubIndustry, CompanyType, SeniorityLevel, School, OrgCategory, SportsFunction,
} from '@/types/alumni';

export const SUB_INDUSTRIES: SubIndustry[] = [
  'Fan Data/CDP',
  'Ticketing',
  'Sponsorship & Partnerships',
  'Sports Gambling/Betting',
  'Media & Broadcasting',
  'Sports Analytics',
  'Fan Experience & Engagement',
  'Venue & Event Tech',
  'Athlete Tech',
  'Sports at Big Tech',
  'League/Team Front Office',
  'VC/PE/Investment in Sports',
  'Sports Consulting',
  'Esports & Gaming',
  'Sports Data Infrastructure',
  'Collegiate/Amateur Sports',
  'Fitness & Wellness Tech',
];

// --- New 2-axis taxonomy ---

export const ORG_CATEGORIES: OrgCategory[] = [
  'leagues_governing', 'teams_clubs', 'betting_gaming', 'media_broadcast',
  'sports_tech_data', 'big_tech_vertical', 'agencies_rep', 'investing_advisory',
  'infra_experiences', 'brands_sponsors', 'collegiate', 'nonprofit_other',
];

export const ORG_CATEGORY_LABELS: Record<OrgCategory, string> = {
  leagues_governing: 'Leagues & Governing Bodies',
  teams_clubs: 'Teams & Clubs',
  betting_gaming: 'Sports Betting & Gaming',
  media_broadcast: 'Sports Media & Broadcasting',
  sports_tech_data: 'Sports Tech & Data',
  big_tech_vertical: 'Big Tech / Sports Vertical',
  agencies_rep: 'Agencies & Representation',
  investing_advisory: 'Investing & Advisory',
  infra_experiences: 'Infrastructure & Experiences',
  brands_sponsors: 'Brands & Sponsors',
  collegiate: 'Collegiate Athletics',
  nonprofit_other: 'Non-Profit / Other',
};

export const SPORTS_FUNCTIONS: SportsFunction[] = [
  'front_office', 'partnerships', 'media_content', 'ticketing_revenue',
  'data_analytics', 'product_eng', 'sales_account', 'strategy_corpdev',
  'marketing_fan', 'investing_deal', 'legal_rep', 'health_athlete',
];

export const SPORTS_FUNCTION_LABELS: Record<SportsFunction, string> = {
  front_office: 'Front Office / Business Ops',
  partnerships: 'Partnerships & Sponsorship',
  media_content: 'Media, Content & Broadcast',
  ticketing_revenue: 'Ticketing & Revenue',
  data_analytics: 'Data, Analytics & Performance',
  product_eng: 'Product & Engineering',
  sales_account: 'Sales & Account Management',
  strategy_corpdev: 'Strategy & Corp Dev',
  marketing_fan: 'Marketing & Fan Engagement',
  investing_deal: 'Investing / Dealmaking',
  legal_rep: 'Legal, Agent & Representation',
  health_athlete: 'Health, Wellness & Athlete Services',
};

export const ORG_CATEGORY_COLORS: Record<OrgCategory, { bg: string; text: string }> = {
  leagues_governing:  { bg: '#dcfce7', text: '#166534' },
  teams_clubs:        { bg: '#cffafe', text: '#155e75' },
  betting_gaming:     { bg: '#fee2e2', text: '#991b1b' },
  media_broadcast:    { bg: '#ffedd5', text: '#9a3412' },
  sports_tech_data:   { bg: '#dce6f7', text: '#003087' },
  big_tech_vertical:  { bg: '#f3e8ff', text: '#6b21a8' },
  agencies_rep:       { bg: '#fce7f3', text: '#9d174d' },
  investing_advisory: { bg: '#fef9c3', text: '#854d0e' },
  infra_experiences:  { bg: '#e0e7ff', text: '#3730a3' },
  brands_sponsors:    { bg: '#fef3c7', text: '#92400e' },
  collegiate:         { bg: '#fefce8', text: '#713f12' },
  nonprofit_other:    { bg: '#f3f4f6', text: '#374151' },
};

export const SPORTS_FUNCTION_COLORS: Record<SportsFunction, { bg: string; text: string }> = {
  front_office:      { bg: '#dce6f7', text: '#003087' },
  partnerships:      { bg: '#fef9c3', text: '#854d0e' },
  media_content:     { bg: '#f3e8ff', text: '#6b21a8' },
  ticketing_revenue: { bg: '#dcfce7', text: '#166534' },
  data_analytics:    { bg: '#cffafe', text: '#155e75' },
  product_eng:       { bg: '#e0e7ff', text: '#3730a3' },
  sales_account:     { bg: '#ffedd5', text: '#9a3412' },
  strategy_corpdev:  { bg: '#f1f5f9', text: '#334155' },
  marketing_fan:     { bg: '#fce7f3', text: '#9d174d' },
  investing_deal:    { bg: '#fdf2f8', text: '#701a75' },
  legal_rep:         { bg: '#ecfdf5', text: '#047857' },
  health_athlete:    { bg: '#f0fdf4', text: '#15803d' },
};

export const COMPANY_TYPES: CompanyType[] = [
  'Startup',
  'League',
  'Team',
  'Big Tech',
  'Consulting',
  'VC/PE',
  'Media',
  'Agency',
  'University',
  'Non-Profit',
  'Brand',
  'Sports Betting',
  'Other',
];

export const SENIORITY_LEVELS: SeniorityLevel[] = [
  'Entry',
  'Mid',
  'Senior',
  'VP/Director',
  'C-Suite/Exec',
];

export const SCHOOLS: School[] = [
  'Trinity',
  'Pratt',
  'Fuqua',
  'Law',
  'Medicine',
  'Nicholas',
  'Sanford',
  'Other',
];

export const REACH_OUT_FOR_OPTIONS = [
  'Career Advice',
  'Warm Introductions',
  'Industry Insights',
  'Mentorship',
  'Job Referrals',
  'Informational Interviews',
  'Recruiting',
] as const;

export const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'grad_year-desc', label: 'Grad Year (Newest)' },
  { value: 'grad_year-asc', label: 'Grad Year (Oldest)' },
  { value: 'added_date-desc', label: 'Recently Added' },
];

export const SUB_INDUSTRY_COLORS: Record<SubIndustry, { bg: string; text: string }> = {
  'Fan Data/CDP':                 { bg: '#dbeafe', text: '#1e40af' },
  'Ticketing':                    { bg: '#dcfce7', text: '#166534' },
  'Sponsorship & Partnerships':   { bg: '#fef9c3', text: '#854d0e' },
  'Sports Gambling/Betting':      { bg: '#fee2e2', text: '#991b1b' },
  'Media & Broadcasting':         { bg: '#f3e8ff', text: '#6b21a8' },
  'Sports Analytics':             { bg: '#cffafe', text: '#155e75' },
  'Fan Experience & Engagement':  { bg: '#ffedd5', text: '#9a3412' },
  'Venue & Event Tech':           { bg: '#e0e7ff', text: '#3730a3' },
  'Athlete Tech':                 { bg: '#fce7f3', text: '#9d174d' },
  'Sports at Big Tech':           { bg: '#d1fae5', text: '#065f46' },
  'League/Team Front Office':     { bg: '#dce6f7', text: '#003087' },
  'VC/PE/Investment in Sports':   { bg: '#fdf2f8', text: '#701a75' },
  'Sports Consulting':            { bg: '#f1f5f9', text: '#334155' },
  'Esports & Gaming':             { bg: '#ecfdf5', text: '#047857' },
  'Sports Data Infrastructure':   { bg: '#eff6ff', text: '#1d4ed8' },
  'Collegiate/Amateur Sports':    { bg: '#fefce8', text: '#713f12' },
  'Fitness & Wellness Tech':      { bg: '#f0fdf4', text: '#15803d' },
};

export const COMPANY_TYPE_COLORS: Record<CompanyType, { bg: string; text: string }> = {
  'Startup':    { bg: '#dce6f7', text: '#003087' },
  'League':     { bg: '#dcfce7', text: '#166534' },
  'Team':       { bg: '#cffafe', text: '#155e75' },
  'Big Tech':   { bg: '#f3e8ff', text: '#6b21a8' },
  'Consulting': { bg: '#f1f5f9', text: '#334155' },
  'VC/PE':      { bg: '#fef9c3', text: '#854d0e' },
  'Media':      { bg: '#ffedd5', text: '#9a3412' },
  'Agency':     { bg: '#fce7f3', text: '#9d174d' },
  'University': { bg: '#e0e7ff', text: '#3730a3' },
  'Non-Profit': { bg: '#d1fae5', text: '#065f46' },
  'Brand':      { bg: '#fef3c7', text: '#92400e' },
  'Sports Betting': { bg: '#fef2f2', text: '#991b1b' },
  'Other':          { bg: '#f3f4f6', text: '#6b7280' },
};
