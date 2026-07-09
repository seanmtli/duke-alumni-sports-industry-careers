import { sbSelect } from '@/lib/supabase';

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

/** Lowercased company/alias name -> logo metadata, for sports_companies rows
 * with a logo URL and/or domain. Returns an empty map (rather than throwing)
 * if the query fails — e.g. the `logo_url` column hasn't been migrated onto
 * this database yet — so a pending migration degrades to "no logos" instead of
 * failing the build. */
export async function getCompanyLogoMap(): Promise<Map<string, CompanyLogoInfo>> {
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
