// Lightweight server-only Supabase REST client. Uses the service-role key, so
// every call here must stay on the server (never import this into a Client
// Component) — it is only ever imported by Route Handlers and Server
// Components. Mirrors the raw-REST approach of the Python pipeline scripts.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function baseHeaders(): Record<string, string> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

type FetchOpts = {
  /** Next.js cache tags to attach for on-demand revalidation. */
  tags?: string[];
  /** Revalidate window in seconds. Omit for no-store (always fresh). */
  revalidate?: number;
};

function nextOpts(opts?: FetchOpts): RequestInit {
  if (opts?.tags || typeof opts?.revalidate === 'number') {
    return { next: { tags: opts.tags, revalidate: opts.revalidate } };
  }
  return { cache: 'no-store' };
}

async function handle(res: Response): Promise<unknown> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 500)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** GET rows. `query` is a raw PostgREST query string (without leading `?`). */
export async function sbSelect<T = unknown>(
  table: string,
  query: string,
  opts?: FetchOpts,
): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'GET',
    headers: baseHeaders(),
    ...nextOpts(opts),
  });
  return (await handle(res)) as T[];
}

/** INSERT one or more rows, returning the inserted rows. */
export async function sbInsert<T = unknown>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...baseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(rows),
    cache: 'no-store',
  });
  return (await handle(res)) as T[];
}

/** PATCH rows matching `query`, returning the updated rows. */
export async function sbUpdate<T = unknown>(
  table: string,
  query: string,
  patch: Record<string, unknown>,
): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { ...baseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
    cache: 'no-store',
  });
  return (await handle(res)) as T[];
}

/** DELETE rows matching `query`, returning the deleted rows. */
export async function sbDelete<T = unknown>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: { ...baseHeaders(), Prefer: 'return=representation' },
    cache: 'no-store',
  });
  return (await handle(res)) as T[];
}
