import type { Alumni, AlumniStats } from '@/types/alumni';
import {
  ORG_CATEGORIES, ORG_CATEGORY_LABELS,
  SPORTS_FUNCTIONS, SPORTS_FUNCTION_LABELS, SENIORITY_LEVELS,
} from './constants';

const NYC_VARIANTS = new Set([
  'new york city metropolitan area',
  'new york metropolitan area',
  'brooklyn, ny',
  'bronxville, ny',
  'briarcliff manor, ny',
  'great neck, ny',
  'new hyde park, ny',
  'long island city, ny',
  'scarsdale, ny',
  'east hampton, ny',
  'port washington, ny',
]);

function normalizeStatCity(location: string): string | null {
  const trimmed = location.trim();
  if (!trimmed) return null;
  if (NYC_VARIANTS.has(trimmed.toLowerCase())) return 'New York, NY';
  return trimmed;
}

export function computeStats(alumni: Alumni[]): AlumniStats {
  const functionCounts: Record<string, number> = {};
  const orgCategoryCounts: Record<string, number> = {};
  const seniorityCounts: Record<string, number> = {};
  const decadeCounts: Record<string, number> = {};
  const companyCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};

  for (const a of alumni) {
    for (const fn of a.sports_functions ?? []) {
      functionCounts[fn] = (functionCounts[fn] ?? 0) + 1;
    }
    if (a.org_category) {
      orgCategoryCounts[a.org_category] = (orgCategoryCounts[a.org_category] ?? 0) + 1;
    }
    seniorityCounts[a.seniority_level] = (seniorityCounts[a.seniority_level] ?? 0) + 1;

    if (a.grad_year) {
      const decade = `${Math.floor(a.grad_year / 10) * 10}s`;
      decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;
    }

    if (a.current_company) {
      companyCounts[a.current_company] = (companyCounts[a.current_company] ?? 0) + 1;
    }
    const city = normalizeStatCity(a.location);
    if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1;
  }

  // Preserve canonical ordering for charts
  const bySportsFunction = SPORTS_FUNCTIONS.filter((fn) => functionCounts[fn] > 0).map(
    (fn) => ({ label: SPORTS_FUNCTION_LABELS[fn], count: functionCounts[fn] })
  );

  const byOrgCategory = ORG_CATEGORIES.filter((c) => orgCategoryCounts[c] > 0).map(
    (c) => ({ label: ORG_CATEGORY_LABELS[c], count: orgCategoryCounts[c] })
  );

  const bySeniority = SENIORITY_LEVELS.filter((sl) => seniorityCounts[sl] > 0).map(
    (sl) => ({ label: sl, count: seniorityCounts[sl] })
  );

  const byGradDecade = Object.entries(decadeCounts)
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade));

  const topCompanies = Object.entries(companyCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topCities = Object.entries(cityCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalAlumni: alumni.length,
    totalCompanies: new Set(alumni.map((a) => a.current_company)).size,
    schoolsRepresented: new Set(alumni.map((a) => a.school)).size,
    citiesRepresented: new Set(alumni.map((a) => a.location).filter(Boolean)).size,
    bySportsFunction,
    byOrgCategory,
    bySeniority,
    byGradDecade,
    topCompanies,
    topCities,
  };
}
