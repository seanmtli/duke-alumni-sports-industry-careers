import fs from 'fs';
import path from 'path';

/** True when Supabase server credentials are available. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/** Load a JSON file from the repo root, returning null if missing/unreadable. */
export function readRepoJson<T>(relativePath: string): T | null {
  try {
    const file = path.join(process.cwd(), relativePath);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}
