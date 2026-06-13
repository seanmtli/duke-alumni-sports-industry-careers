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
 * Resolve a headshot to a usable URL, in priority order:
 *   1. A local file in public/headshots/ (highest priority).
 *   2. A stable external URL from alumni.json (e.g. a Crustdata S3 permalink).
 *   3. null — render initials.
 *
 * Raw LinkedIn CDN URLs (media.licdn.com) are short-lived signed URLs that
 * expire and never load, so they are ignored. Re-hosted permalinks (Crustdata
 * S3) are stable and used directly.
 */
function resolveHeadshot(localPath: string | undefined, jsonUrl: string | null): string | null {
  if (localPath) return localPath;
  if (jsonUrl && !jsonUrl.includes('media.licdn.com')) return jsonUrl;
  return null;
}

/**
 * Load all alumni with headshot_url resolved to a local file or a stable
 * external permalink when present, otherwise null.
 */
export function getAlumni(): Alumni[] {
  const headshots = buildHeadshotMap();
  return (alumniData.alumni as Alumni[]).map((a) => ({
    ...a,
    headshot_url: resolveHeadshot(headshots.get(a.id), a.headshot_url),
  }));
}
