import { sbSelect } from '@/lib/supabase';

interface SportsCompanyRow {
  name: string;
  aliases: string[] | null;
  logo_url: string | null;
}

/** Lowercased company/alias name -> logo URL, for every sports_companies row
 * with a logo (backfilled by scripts/fetch_company_logos.py). */
export async function getCompanyLogoMap(): Promise<Map<string, string>> {
  const rows = await sbSelect<SportsCompanyRow>(
    'sports_companies',
    'select=name,aliases,logo_url&logo_url=not.is.null',
    { revalidate: 3600 },
  );

  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.logo_url) continue;
    map.set(row.name.toLowerCase(), row.logo_url);
    for (const alias of row.aliases ?? []) {
      map.set(alias.toLowerCase(), row.logo_url);
    }
  }
  return map;
}
