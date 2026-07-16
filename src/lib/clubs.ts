/** Canonical Duke sports-club catalog (mirrors scripts/clubs_catalog.py). */

export type ClubSlug = 'dsbc' | 'dsac' | 'fuqua-mes';

export interface DukeClub {
  slug: ClubSlug;
  name: string;
  short_name: string;
  school_scope: string;
  description: string;
  sort_order: number;
}

export const DUKE_CLUBS: DukeClub[] = [
  {
    slug: 'dsbc',
    name: 'Duke Sports Business Conference',
    short_name: 'DSBC',
    school_scope: 'undergraduate',
    description:
      'Alumni who organized or participated in the Duke Sports Business Conference.',
    sort_order: 1,
  },
  {
    slug: 'dsac',
    name: 'Duke Sports Analytics Club',
    short_name: 'DSAC',
    school_scope: 'undergraduate',
    description: 'Alumni of the Duke Sports Analytics Club.',
    sort_order: 2,
  },
  {
    slug: 'fuqua-mes',
    name: 'Fuqua Media, Entertainment, and Sports Club',
    short_name: 'MES',
    school_scope: 'fuqua',
    description: "Alumni of Fuqua's Media, Entertainment, and Sports (MES) Club.",
    sort_order: 3,
  },
];

export const DUKE_CLUBS_BY_SLUG: Record<ClubSlug, DukeClub> = Object.fromEntries(
  DUKE_CLUBS.map((c) => [c.slug, c]),
) as Record<ClubSlug, DukeClub>;

export const CLUB_SLUGS: ClubSlug[] = DUKE_CLUBS.map((c) => c.slug);

export const CLUB_SHORT_LABELS: Record<ClubSlug, string> = {
  dsbc: 'DSBC',
  dsac: 'DSAC',
  'fuqua-mes': 'MES',
};

export const CLUB_BADGE_COLORS: Record<ClubSlug, { bg: string; text: string }> = {
  dsbc: { bg: '#dce6f7', text: '#003087' },
  dsac: { bg: '#cffafe', text: '#155e75' },
  'fuqua-mes': { bg: '#f3e8ff', text: '#6b21a8' },
};

export function isClubSlug(value: string): value is ClubSlug {
  return value in DUKE_CLUBS_BY_SLUG;
}
