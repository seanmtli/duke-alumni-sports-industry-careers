import fs from 'fs';
import path from 'path';
import alumniData from '@/data/alumni.json';
import type { Alumni } from '@/types/alumni';

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
 * Load all alumni with headshot_url resolved to a LOCAL file when present,
 * otherwise null. The stale external (LinkedIn) URLs in alumni.json are
 * intentionally ignored — they are expired/blocked and never load.
 */
export function getAlumni(): Alumni[] {
  const headshots = buildHeadshotMap();
  return (alumniData.alumni as Alumni[]).map((a) => ({
    ...a,
    headshot_url: headshots.get(a.id) ?? null,
  }));
}
