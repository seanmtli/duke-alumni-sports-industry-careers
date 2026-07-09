import { sbSelect } from '@/lib/supabase';
import { isSupabaseConfigured, readRepoJson } from '@/lib/localData';

interface SportsCompanyRow {
  name: string;
  aliases: string[] | null;
  logo_url: string | null;
  domain: string | null;
}

export interface CompanyLogoInfo {
  logo_url: string | null;
  domain: string | null;
}

interface SeedCompany {
  name: string;
  domain?: string;
  aliases?: string[];
}

function loadSeedLogoMap(): Map<string, CompanyLogoInfo> {
  const data = readRepoJson<{ companies: SeedCompany[] }>('scripts/data/sports_companies_seed.json');
  const map = new Map<string, CompanyLogoInfo>();
  if (!data?.companies) return map;

  for (const row of data.companies) {
    if (!row.domain) continue;
    const info: CompanyLogoInfo = { logo_url: null, domain: row.domain };
    map.set(row.name.toLowerCase(), info);
    for (const alias of row.aliases ?? []) {
      map.set(alias.toLowerCase(), info);
    }
  }
  return map;
}

/** Lowercased company/alias name -> logo metadata, for sports_companies rows
 * with a logo URL and/or domain. Returns an empty map (rather than throwing)
 * if the query fails — e.g. the `logo_url` column hasn't been migrated onto
 * this database yet — so a pending migration degrades to "no logos" instead of
 * failing the build.
 *
 * In local dev without Supabase credentials, falls back to the seed companies
 * file (domain-only logos via the /api/company-logo proxy). */
export async function getCompanyLogoMap(): Promise<Map<string, CompanyLogoInfo>> {
  if (!isSupabaseConfigured()) {
    return loadSeedLogoMap();
  }

  let rows: SportsCompanyRow[];
  try {
    rows = await sbSelect<SportsCompanyRow>(
      'sports_companies',
      'select=name,aliases,logo_url,domain',
      { revalidate: 3600 },
    );
  } catch (err) {
    console.error('getCompanyLogoMap: failed to load company logos', err);
    return new Map();
  }

  const map = new Map<string, CompanyLogoInfo>();
  for (const row of rows) {
    if (!row.logo_url && !row.domain) continue;
    const info: CompanyLogoInfo = {
      logo_url: row.logo_url,
      domain: row.domain,
    };
    map.set(row.name.toLowerCase(), info);
    for (const alias of row.aliases ?? []) {
      map.set(alias.toLowerCase(), info);
    }
  }
  return map;
}
