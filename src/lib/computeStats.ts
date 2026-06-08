import type { Alumni, AlumniStats, SubIndustry, CompanyType, SeniorityLevel } from '@/types/alumni';
import { SUB_INDUSTRIES, COMPANY_TYPES, SENIORITY_LEVELS } from './constants';

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
  const subIndustryCounts: Record<string, number> = {};
  const companyTypeCounts: Record<string, number> = {};
  const seniorityCounts: Record<string, number> = {};
  const decadeCounts: Record<string, number> = {};
  const companyCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};

  for (const a of alumni) {
    for (const si of a.sub_industries) {
      subIndustryCounts[si] = (subIndustryCounts[si] ?? 0) + 1;
    }
    companyTypeCounts[a.company_type] = (companyTypeCounts[a.company_type] ?? 0) + 1;
    seniorityCounts[a.seniority_level] = (seniorityCounts[a.seniority_level] ?? 0) + 1;

    const decade = `${Math.floor(a.grad_year / 10) * 10}s`;
    decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;

    companyCounts[a.current_company] = (companyCounts[a.current_company] ?? 0) + 1;
    const city = normalizeStatCity(a.location);
    if (city) cityCounts[city] = (cityCounts[city] ?? 0) + 1;
  }

  // Preserve canonical ordering for charts
  const bySubIndustry = SUB_INDUSTRIES.filter((si) => subIndustryCounts[si] > 0).map(
    (si) => ({ label: si, count: subIndustryCounts[si] })
  );

  const byCompanyType = COMPANY_TYPES.filter((ct) => companyTypeCounts[ct] > 0).map(
    (ct) => ({ label: ct, count: companyTypeCounts[ct] })
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
    bySubIndustry,
    byCompanyType,
    bySeniority,
    byGradDecade,
    topCompanies,
    topCities,
  };
}
