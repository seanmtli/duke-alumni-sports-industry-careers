import { readRepoJson } from '@/lib/localData';
import { sbSelect } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/localData';
import {
  DUKE_CLUBS,
  DUKE_CLUBS_BY_SLUG,
  isClubSlug,
  type ClubSlug,
  type DukeClub,
} from '@/lib/clubs';
import { ALUMNI_TAG } from '@/lib/getAlumni';
import { mapPersonToAlumni, PEOPLE_SELECT, type PeopleRow } from '@/lib/alumniMap';
import type { Alumni, AlumniClubAffiliation } from '@/types/alumni';
import fs from 'fs';
import path from 'path';

export const CLUBS_TAG = 'clubs';
const REVALIDATE_SECONDS = 300;

interface JsonAffiliation {
  person_id: string;
  club_slug: string;
  source?: string;
  evidence?: string | null;
  role_title?: string | null;
  confidence?: number | null;
  linkedin_url?: string | null;
  full_name?: string | null;
  directory_status?: string | null;
}

interface JsonFile {
  affiliations: JsonAffiliation[];
}

interface DbClubRow {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  school_scope: string | null;
  description: string | null;
  sort_order: number | null;
}

interface DbPersonClubRow {
  person_id: string;
  source: string | null;
  evidence: string | null;
  role_title: string | null;
  confidence: number | null;
  duke_clubs: { slug: string; short_name: string; name: string } | null;
}

function loadJsonAffiliations(): JsonAffiliation[] {
  const data = readRepoJson<JsonFile>('src/data/person_clubs.json');
  return data?.affiliations ?? [];
}

/** Club catalog: Supabase duke_clubs when available, else static seed. */
export async function getClubCatalog(): Promise<DukeClub[]> {
  if (!isSupabaseConfigured()) return DUKE_CLUBS;
  try {
    const rows = await sbSelect<DbClubRow>(
      'duke_clubs',
      'select=id,slug,name,short_name,school_scope,description,sort_order&order=sort_order.asc',
      { tags: [CLUBS_TAG], revalidate: REVALIDATE_SECONDS },
    );
    if (!rows.length) return DUKE_CLUBS;
    return rows
      .filter((r) => isClubSlug(r.slug))
      .map((r) => ({
        slug: r.slug as ClubSlug,
        name: r.name,
        short_name: r.short_name,
        school_scope: r.school_scope ?? '',
        description: r.description ?? '',
        sort_order: r.sort_order ?? 0,
      }));
  } catch {
    return DUKE_CLUBS;
  }
}

export async function getClubBySlug(slug: string): Promise<DukeClub | null> {
  if (!isClubSlug(slug)) return null;
  const catalog = await getClubCatalog();
  return catalog.find((c) => c.slug === slug) ?? DUKE_CLUBS_BY_SLUG[slug];
}

/** Map person_id -> club affiliations (for verified directory badges). */
export async function getAffiliationsByPersonId(): Promise<
  Map<string, AlumniClubAffiliation[]>
> {
  const map = new Map<string, AlumniClubAffiliation[]>();

  if (isSupabaseConfigured()) {
    try {
      const rows = await sbSelect<DbPersonClubRow>(
        'person_clubs',
        'select=person_id,source,evidence,role_title,confidence,duke_clubs(slug,short_name,name)',
        { tags: [CLUBS_TAG, ALUMNI_TAG], revalidate: REVALIDATE_SECONDS },
      );
      if (rows.length > 0) {
        for (const r of rows) {
          const slug = r.duke_clubs?.slug;
          if (!slug || !isClubSlug(slug)) continue;
          const list = map.get(r.person_id) ?? [];
          list.push({
            slug,
            short_name: r.duke_clubs?.short_name ?? slug.toUpperCase(),
            name: r.duke_clubs?.name,
            role_title: r.role_title ?? undefined,
          });
          map.set(r.person_id, list);
        }
        return map;
      }
    } catch {
      // fall through to JSON
    }
  }

  for (const a of loadJsonAffiliations()) {
    if (!isClubSlug(a.club_slug)) continue;
    const club = DUKE_CLUBS_BY_SLUG[a.club_slug];
    const list = map.get(a.person_id) ?? [];
    list.push({
      slug: a.club_slug,
      short_name: club.short_name,
      name: club.name,
      role_title: a.role_title ?? undefined,
    });
    map.set(a.person_id, list);
  }
  return map;
}

function resolveHeadshot(dbUrl: string | null): string | null {
  if (dbUrl && !dbUrl.includes('media.licdn.com')) return dbUrl;
  return null;
}

function applyLocalHeadshots(alumni: Alumni[]): Alumni[] {
  const headshotDir = path.join(process.cwd(), 'public', 'headshots');
  let files: string[] = [];
  try {
    files = fs.readdirSync(headshotDir);
  } catch {
    return alumni;
  }
  const map = new Map<string, string>();
  for (const file of files) {
    const ext = path.extname(file).slice(1).toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;
    const id = path.basename(file, path.extname(file));
    if (!map.has(id)) map.set(id, `/headshots/${file}`);
  }
  return alumni.map((a) => ({
    ...a,
    headshot_url: map.get(a.id) ?? a.headshot_url,
  }));
}

/**
 * Alumni for a club page: verified sports alumni + club_alumni members
 * who share this affiliation. Main directory is unaffected.
 */
export async function getClubAlumni(slug: ClubSlug): Promise<Alumni[]> {
  const affils = await getAffiliationsByPersonId();
  const personIds = [...affils.entries()]
    .filter(([, clubs]) => clubs.some((c) => c.slug === slug))
    .map(([id]) => id);

  if (personIds.length === 0 || !isSupabaseConfigured()) {
    return [];
  }

  // PostgREST `in` filter — chunk to stay under URL limits
  const chunks: string[][] = [];
  for (let i = 0; i < personIds.length; i += 100) {
    chunks.push(personIds.slice(i, i + 100));
  }

  const rows: PeopleRow[] = [];
  for (const chunk of chunks) {
    const ids = chunk.join(',');
    const batch = await sbSelect<PeopleRow>(
      'people',
      `select=${PEOPLE_SELECT}&id=in.(${ids})&status=in.(verified,club_alumni,candidate)`,
      { tags: [CLUBS_TAG, ALUMNI_TAG], revalidate: REVALIDATE_SECONDS },
    );
    rows.push(...batch);
  }

  let alumni = rows.map((r) => {
    const a = mapPersonToAlumni(r);
    a.headshot_url = resolveHeadshot(a.headshot_url);
    a.clubs = affils.get(r.id) ?? [];
    return a;
  });
  alumni = applyLocalHeadshots(alumni);
  alumni.sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
  return alumni;
}

/** Member counts per club slug for the hub page. */
export async function getClubMemberCounts(): Promise<Record<ClubSlug, number>> {
  const affils = await getAffiliationsByPersonId();
  const counts = Object.fromEntries(DUKE_CLUBS.map((c) => [c.slug, 0])) as Record<
    ClubSlug,
    number
  >;
  for (const clubs of affils.values()) {
    const seen = new Set<ClubSlug>();
    for (const c of clubs) {
      if (!seen.has(c.slug)) {
        counts[c.slug] += 1;
        seen.add(c.slug);
      }
    }
  }
  return counts;
}
