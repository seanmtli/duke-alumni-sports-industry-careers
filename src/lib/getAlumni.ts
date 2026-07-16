import fs from 'fs';
import path from 'path';
import type { Alumni } from '@/types/alumni';
import { sbSelect } from '@/lib/supabase';
import { isSupabaseConfigured, readRepoJson } from '@/lib/localData';
import { mapPersonToAlumni, PEOPLE_SELECT, type PeopleRow } from '@/lib/alumniMap';

// Cache tag for the public alumni reads. Admin write routes call
// revalidateTag(ALUMNI_TAG) so edits appear on the live site within seconds
// without a rebuild/redeploy.
export const ALUMNI_TAG = 'alumni';
const REVALIDATE_SECONDS = 300; // safety refresh even if a tag bust is missed

const HEADSHOT_DIR = path.join(process.cwd(), 'public', 'headshots');
const SUPPORTED_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * Build a map of alumni id -> local headshot path by reading the
 * public/headshots/ directory. A photo is matched when a file named
 * `<id>.<ext>` exists (e.g. public/headshots/michael-king-1998.jpg).
 *
 * Drop a new `<id>.jpg` into public/headshots/ and it appears automatically;
 * no data edits required. Runs server-side only (uses fs).
 */
function buildHeadshotMap(): Map<string, string> {
  const map = new Map<string, string>();
  let files: string[];
  try {
    files = fs.readdirSync(HEADSHOT_DIR);
  } catch {
    // Directory missing (e.g. nothing added yet) — everyone gets initials.
    return map;
  }

  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) continue;
    const id = path.basename(file, path.extname(file));
    if (!map.has(id)) {
      map.set(id, `/headshots/${file}`);
    }
  }
  return map;
}

/**
 * Resolve a headshot to a usable URL, in priority order:
 *   1. A local file in public/headshots/ (highest priority).
 *   2. A stable external URL from Supabase (e.g. a Crustdata S3 permalink).
 *   3. null — render initials.
 *
 * Raw LinkedIn CDN URLs (media.licdn.com) are short-lived signed URLs that
 * expire and never load, so they are ignored. Re-hosted permalinks (Crustdata
 * S3) are stable and used directly.
 */
function resolveHeadshot(localPath: string | undefined, dbUrl: string | null): string | null {
  if (localPath) return localPath;
  if (dbUrl && !dbUrl.includes('media.licdn.com')) return dbUrl;
  return null;
}

/**
 * Load all verified alumni straight from Supabase, mapped to the app's `Alumni`
 * shape, with headshot_url resolved to a local file or stable permalink.
 * Cached under ALUMNI_TAG; admin writes revalidate that tag so the live site
 * reflects edits immediately.
 *
 * In local dev without Supabase credentials, falls back to src/data/alumni.json.
 */
export async function getAlumni(): Promise<Alumni[]> {
  if (!isSupabaseConfigured()) {
    const data = readRepoJson<{ alumni: Alumni[] }>('src/data/alumni.json');
    if (data?.alumni) {
      const headshots = buildHeadshotMap();
      const alumni = data.alumni.map((a) => ({
        ...a,
        headshot_url: resolveHeadshot(headshots.get(a.id), a.headshot_url),
      }));
      alumni.sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
      return alumni;
    }
  }

  const rows = await sbSelect<PeopleRow>(
    'people',
    `select=${PEOPLE_SELECT}&status=eq.verified`,
    { tags: [ALUMNI_TAG], revalidate: REVALIDATE_SECONDS },
  );

  // Lazy import avoids a circular dependency with getClubs → getAlumni.
  const { getAffiliationsByPersonId } = await import('@/lib/getClubs');
  const affils = await getAffiliationsByPersonId();

  const headshots = buildHeadshotMap();
  const alumni = rows.map((r) => {
    const a = mapPersonToAlumni(r);
    a.headshot_url = resolveHeadshot(headshots.get(a.id), a.headshot_url);
    if (r.id && affils.has(r.id)) {
      a.clubs = affils.get(r.id);
    }
    return a;
  });
  alumni.sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
  return alumni;
}
