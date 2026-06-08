import type { SubIndustry, CompanyType, SeniorityLevel, School } from '@/types/alumni';

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
