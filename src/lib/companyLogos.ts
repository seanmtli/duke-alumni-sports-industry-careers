import { sbSelect } from '@/lib/supabase';
import { isSupabaseConfigured, readRepoJson } from '@/lib/localData';

interface SportsCompanyRow {
  name: string;
  aliases: string[] | null;
  domain: string | null;
}

/** Lowercased company/alias name -> known website domain (when available).
 * Used to prefer Logo.dev domain lookups over name lookups. */
export type CompanyDomainMap = Map<string, string>;

interface SeedCompany {
  name: string;
  domain?: string;
  aliases?: string[];
}

function loadSeedDomainMap(): CompanyDomainMap {
  const data = readRepoJson<{ companies: SeedCompany[] }>('scripts/data/sports_companies_seed.json');
  const map: CompanyDomainMap = new Map();
  if (!data?.companies) return map;

  for (const row of data.companies) {
    if (!row.domain) continue;
    map.set(row.name.toLowerCase(), row.domain);
    for (const alias of row.aliases ?? []) {
      map.set(alias.toLowerCase(), row.domain);
    }
  }
  return map;
}

/** Lowercased company/alias name -> domain. Empty map if the query fails.
 * In local dev without Supabase credentials, falls back to the seed companies file. */
export async function getCompanyDomainMap(): Promise<CompanyDomainMap> {
  if (!isSupabaseConfigured()) {
    return loadSeedDomainMap();
  }

  let rows: SportsCompanyRow[];
  try {
    rows = await sbSelect<SportsCompanyRow>(
      'sports_companies',
      'select=name,aliases,domain',
      { revalidate: 3600 },
    );
  } catch (err) {
    console.error('getCompanyDomainMap: failed to load company domains', err);
    return new Map();
  }

  const map: CompanyDomainMap = new Map();
  for (const row of rows) {
    if (!row.domain) continue;
    map.set(row.name.toLowerCase(), row.domain);
    for (const alias of row.aliases ?? []) {
      map.set(alias.toLowerCase(), row.domain);
    }
  }
  return map;
}
