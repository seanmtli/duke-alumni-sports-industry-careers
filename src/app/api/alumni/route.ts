import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { sbSelect, sbInsert, sbUpdate, sbDelete } from '@/lib/supabase';
import { fetchHeadshotUrl } from '@/lib/crustdata';
import {
  mapPersonToAlumni,
  PEOPLE_SELECT,
  COMPANY_TYPE_TO_ORG,
  type PeopleRow,
} from '@/lib/alumniMap';
import { ALUMNI_TAG } from '@/lib/getAlumni';
import { COMPANY_TYPES, ORG_CATEGORIES, SPORTS_FUNCTIONS, SENIORITY_LEVELS, SCHOOLS } from '@/lib/constants';
import type { CompanyType, OrgCategory, SportsFunction, SeniorityLevel, School } from '@/types/alumni';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Resolve org_category: prefer an explicit taxonomy value, else map from the
 * legacy company_type, else leave null. */
function resolveOrgCategory(b: Record<string, unknown>): OrgCategory | null {
  if ((ORG_CATEGORIES as string[]).includes(b.org_category as string)) {
    return b.org_category as OrgCategory;
  }
  if ((COMPANY_TYPES as string[]).includes(b.company_type as string)) {
    return COMPANY_TYPE_TO_ORG[b.company_type as CompanyType];
  }
  return null;
}

/** Build the Supabase `people` column patch from an admin form payload. */
function toPeopleRow(b: Record<string, unknown>) {
  const seniority = (SENIORITY_LEVELS as string[]).includes(b.seniority_level as string)
    ? (b.seniority_level as SeniorityLevel)
    : 'Mid';
  const today = new Date().toISOString().split('T')[0];

  const row: Record<string, unknown> = {
    full_name: str(b.name, 150),
    current_company: str(b.current_company, 200),
    current_title: str(b.current_title, 200),
    org_category: resolveOrgCategory(b),
    seniority_level: seniority,
    linkedin_url: str(b.linkedin_url, 300),
    // The flat `location` string is stored in location_city; the read mapper
    // reconstructs `location` from city/state, so this round-trips cleanly.
    location_city: str(b.location, 200) || null,
    headshot_url: str(b.headshot_url, 500) || null,
    sports_league_affiliation: str(b.sports_league_affiliation, 150) || null,
    last_verified: today,
  };

  if (Array.isArray(b.sports_functions)) {
    row.sports_functions = b.sports_functions.filter(
      (f) => typeof f === 'string' && (SPORTS_FUNCTIONS as string[]).includes(f),
    ) as SportsFunction[];
  }
  // Only touch bio / reach_out_for when the payload actually carries them
  // (a submission approval does; the admin edit form does not) so a normal
  // edit never blanks out an existing bio.
  if (typeof b.bio === 'string') row.bio = str(b.bio, 2000) || null;
  if (Array.isArray(b.reach_out_for)) {
    row.reach_out_for = b.reach_out_for.filter((x) => typeof x === 'string').slice(0, 20);
  }
  return row;
}

type DegreeRow = { school: School; degree: string | null; grad_year: number | null; major: string | null };

/** Sanitize one degree object into a duke_degrees row. */
function cleanDegree(d: Record<string, unknown>): DegreeRow {
  const school = (SCHOOLS as string[]).includes(d.school as string) ? (d.school as School) : 'Other';
  const gradYear = Number(d.grad_year);
  return {
    school,
    degree: str(d.degree, 150) || null,
    grad_year: Number.isInteger(gradYear) ? gradYear : null,
    major: str(d.major, 150) || null,
  };
}

/** The full list of Duke degrees from the payload — the `all_degrees` array
 * when present (multi-degree form), else the single flat degree fields. */
function toDegreeRows(b: Record<string, unknown>): DegreeRow[] {
  if (Array.isArray(b.all_degrees) && b.all_degrees.length > 0) {
    return b.all_degrees
      .slice(0, 6)
      .map((d) => cleanDegree((d && typeof d === 'object' ? d : {}) as Record<string, unknown>));
  }
  return [cleanDegree(b)];
}

// GET — list all verified alumni for the admin table (includes person_id).
export async function GET() {
  if (!(await isAdminAuthed())) return unauthorized();
  const rows = await sbSelect<PeopleRow>('people', `select=${PEOPLE_SELECT}&status=eq.verified`);
  const alumni = rows.map(mapPersonToAlumni);
  alumni.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return NextResponse.json({ alumni });
}

// POST — create a new record, or update an existing one when person_id is given.
export async function POST(request: Request) {
  if (!(await isAdminAuthed())) return unauthorized();

  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!b || typeof b !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const name = str(b.name, 150);
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const personId = typeof b.person_id === 'string' ? b.person_id : null;
  const peoplePatch = toPeopleRow(b);
  const degrees = toDegreeRows(b);

  try {
    if (personId) {
      // Update the person, then replace its degree rows with the submitted set
      // (the admin form edits the whole list, so keep the two in sync).
      await sbUpdate('people', `id=eq.${personId}`, peoplePatch);
      await sbDelete('duke_degrees', `person_id=eq.${personId}`);
      await sbInsert('duke_degrees', degrees.map((d) => ({ ...d, person_id: personId })));
      revalidateTag(ALUMNI_TAG, 'max');
      return NextResponse.json({ ok: true, person_id: personId });
    }

    // New records never carry a photo (the admin form has no headshot field and
    // submissions don't collect one), so grab one from Crustdata by LinkedIn URL
    // — the same source the batch enrich job uses. Best-effort: a miss just
    // leaves headshot_url null and the card falls back to initials.
    if (!peoplePatch.headshot_url && typeof peoplePatch.linkedin_url === 'string') {
      const headshot = await fetchHeadshotUrl(peoplePatch.linkedin_url);
      if (headshot) {
        peoplePatch.headshot_url = headshot;
        peoplePatch.last_enriched = 'now()';
      }
    }

    // Insert a new verified person + all its degrees.
    const inserted = await sbInsert<{ id: string }>('people', {
      ...peoplePatch,
      status: 'verified',
      source: ['admin'],
    });
    const newId = inserted[0]?.id;
    if (!newId) throw new Error('insert returned no id');
    await sbInsert('duke_degrees', degrees.map((d) => ({ ...d, person_id: newId })));
    revalidateTag(ALUMNI_TAG, 'max');
    return NextResponse.json({ ok: true, person_id: newId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Write failed' },
      { status: 500 },
    );
  }
}

// DELETE — soft-delete by archiving (keeps the row + degrees for recovery).
export async function DELETE(request: Request) {
  if (!(await isAdminAuthed())) return unauthorized();
  const { searchParams } = new URL(request.url);
  const personId = searchParams.get('person_id');
  if (!personId) {
    return NextResponse.json({ error: 'Missing person_id' }, { status: 400 });
  }
  try {
    await sbUpdate('people', `id=eq.${personId}`, {
      status: 'archived',
      last_verified: new Date().toISOString().split('T')[0],
    });
    revalidateTag(ALUMNI_TAG, 'max');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
