// Server-only Crustdata REST client. Mirrors the person-enrich call in
// scripts/crustdata_client.py (Python pipeline) so admin-added records can grab
// a headshot at approval time instead of waiting for the batch enrich job.
// Reads CRUSTDATA_API_KEY from env — never import this into a Client Component.

const API = 'https://api.crustdata.com';

/** Pull the first non-empty value for any of `keys` from a plain object. */
function first(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Fetch a LinkedIn headshot URL for one profile via Crustdata person-enrich.
 * Best-effort: returns null on any error (missing key, network, no match) so
 * callers can save the record regardless. Prefers the stable Crustdata S3
 * permalink over the expiring licdn URL, matching enrich.py's headshot_of().
 */
export async function fetchHeadshotUrl(linkedinUrl: string): Promise<string | null> {
  const token = process.env.CRUSTDATA_API_KEY;
  if (!token || !linkedinUrl) return null;

  const url =
    `${API}/screener/person/enrich?` +
    `linkedin_profile_url=${encodeURIComponent(linkedinUrl)}`;

  try {
    // Cap the wait so a slow/down Crustdata never blocks an admin save for long.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;

    const data: unknown = await res.json();
    // Response may be a bare list, or { profiles|data|results: [...] }.
    let profiles: unknown[] = [];
    if (Array.isArray(data)) {
      profiles = data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      for (const k of ['profiles', 'data', 'results']) {
        if (Array.isArray(obj[k])) {
          profiles = obj[k] as unknown[];
          break;
        }
      }
      if (profiles.length === 0) profiles = [obj];
    }

    const prof = profiles[0];
    if (!prof || typeof prof !== 'object') return null;
    return first(
      prof as Record<string, unknown>,
      'profile_picture_permalink',
      'profile_picture_url',
      'linkedin_profile_picture',
    );
  } catch {
    return null;
  }
}
