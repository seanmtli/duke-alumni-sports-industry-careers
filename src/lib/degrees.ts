import type { Alumni, DukeDegree } from '@/types/alumni';

/** Degrees to show, de-duplicated by (school, grad_year) so the reconciled
 * "Certificate" rows that share a year with a real degree don't render as a
 * duplicate chip. Falls back to the flat primary school when a record predates
 * the duke_degrees table. */
export function degreeChips(a: Pick<Alumni, 'all_degrees' | 'school' | 'grad_year'>): {
  school: string;
  grad_year: number | null;
}[] {
  const source: Pick<DukeDegree, 'school' | 'grad_year'>[] =
    a.all_degrees && a.all_degrees.length > 0
      ? a.all_degrees
      : [{ school: a.school, grad_year: a.grad_year }];

  const seen = new Set<string>();
  const out: { school: string; grad_year: number | null }[] = [];
  for (const d of source) {
    const school = (d.school || 'Duke').toString();
    const key = `${school}|${d.grad_year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ school: school === 'Other' ? 'Duke' : school, grad_year: d.grad_year });
  }
  // Earliest first (undergrad before grad); undated degrees sort last.
  out.sort((x, y) => (x.grad_year ?? 9999) - (y.grad_year ?? 9999));
  return out;
}

/** "Trinity ’14" — school with a 2-digit apostrophe year when known. */
export function formatChip(chip: { school: string; grad_year: number | null }): string {
  const year = chip.grad_year ? ` ’${String(chip.grad_year).slice(-2)}` : '';
  return `${chip.school}${year}`;
}
