// Canonical company-name normalization for display, search, and the company
// filter. Crustdata (and hand entry) leave the same employer under several
// spellings — "DraftKings" vs "DraftKings Inc.", "CAA" vs "CAA Sports",
// parent-vs-product like "Deloitte" vs "ConvergeSports by Deloitte". Without
// this, the directory shows duplicate cards per company and the filter splits
// one employer into multiple buckets.
//
// Applied in `mapPersonToAlumni`, so every downstream consumer — cards, the
// filter option list, filter matching, and Fuse search — sees one canonical
// name. The raw value in Supabase is left untouched (re-enrichment safe); this
// is purely a presentation layer.
//
// IMPORTANT: this is an EXACT-match map (case-insensitive on the raw key), not
// a substring rewrite. That is deliberate — "Real" collapses into "Real Sports"
// but "Real Salt Lake" (a different, unrelated MLS club) must stay separate. A
// substring approach would wrongly merge them.

// raw name (lowercased) -> canonical display name
const CANONICAL_COMPANY: Record<string, string> = {
  'aramark': 'Aramark Sports & Entertainment',
  'draftkings inc.': 'DraftKings',
  'caa': 'CAA Sports',
  'convergesports by deloitte': 'Deloitte',
  'real': 'Real Sports',
  'redbird capital partners': 'RedBird Capital Partners', // fix casing variant
  'wilson sporting goods co.': 'Wilson Sporting Goods',
  'us soccer federation': 'U.S. Soccer Federation',
  '(usta) united states tennis association': 'USTA',
  'major league baseball': 'Major League Baseball (MLB)',
  'us olympic committee': 'United States Olympic & Paralympic Committee',
};

/** Return the canonical display name for a raw company string. */
export function normalizeCompany(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  return CANONICAL_COMPANY[value.toLowerCase()] ?? value;
}
