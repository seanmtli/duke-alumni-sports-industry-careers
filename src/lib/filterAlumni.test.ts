import { describe, it, expect } from 'vitest';
import type { Alumni } from '@/types/alumni';
import { DEFAULT_FILTERS } from '@/types/alumni';
import { searchByName, filterAlumni } from './filterAlumni';

function makeAlumni(overrides: Partial<Alumni> & Pick<Alumni, 'id' | 'name'>): Alumni {
  return {
    grad_year: 2010,
    school: 'Trinity',
    degree: 'BA',
    major: '',
    current_company: '',
    current_title: '',
    company_type: 'Other',
    sub_industries: [],
    seniority_level: 'Mid',
    linkedin_url: 'https://linkedin.com/in/test',
    location: 'Durham, NC',
    headshot_url: null,
    sports_league_affiliation: null,
    added_date: '2026-01-01',
    last_verified: '2026-01-01',
    ...overrides,
  };
}

const alanaBeard = makeAlumni({
  id: '1',
  name: 'Alana Beard',
  current_company: 'Project B',
  current_title: 'Chief Basketball Officer',
  work_history: [{ company: 'WNBA', title: 'Player', start_date: null, end_date: null, is_current: false }],
});

const nbaEmployee = makeAlumni({
  id: '2',
  name: 'Jane Smith',
  current_company: 'National Basketball Association (NBA)',
  current_title: 'VP of Strategy',
});

const wnbaEmployee = makeAlumni({
  id: '3',
  name: 'Alex Johnson',
  current_company: 'WNBA',
  current_title: 'Director of Operations',
});

const allAlumni = [alanaBeard, nbaEmployee, wnbaEmployee];

describe('searchByName', () => {
  it('does not return Alana Beard when searching NBA', () => {
    const results = searchByName(allAlumni, 'NBA');
    expect(results.map((a) => a.name)).not.toContain('Alana Beard');
  });

  it('returns Alana Beard when searching Alana', () => {
    const results = searchByName(allAlumni, 'Alana');
    expect(results.map((a) => a.name)).toContain('Alana Beard');
  });

  it('returns no results for queries under 2 characters', () => {
    expect(searchByName(allAlumni, 'A')).toHaveLength(allAlumni.length);
  });
});

describe('filterAlumni company filter', () => {
  it('returns only NBA employees when NBA company is selected', () => {
    const results = filterAlumni(allAlumni, {
      ...DEFAULT_FILTERS,
      companies: ['National Basketball Association (NBA)'],
    }, '');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Jane Smith');
  });

  it('does not bleed WNBA results into NBA company filter', () => {
    const results = filterAlumni(allAlumni, {
      ...DEFAULT_FILTERS,
      companies: ['National Basketball Association (NBA)'],
    }, '');
    expect(results.map((a) => a.current_company)).not.toContain('WNBA');
  });

  it('returns WNBA employees when WNBA company is selected', () => {
    const results = filterAlumni(allAlumni, {
      ...DEFAULT_FILTERS,
      companies: ['WNBA'],
      includePastCompanies: true,
    }, '');
    expect(results.map((a) => a.name)).toContain('Alex Johnson');
    expect(results.map((a) => a.name)).not.toContain('Jane Smith');
  });
});
