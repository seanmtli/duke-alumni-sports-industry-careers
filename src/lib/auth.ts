import crypto from 'crypto';
import { cookies } from 'next/headers';

// Server-only admin auth. None of these values are ever sent to the browser:
// the client only ever POSTs the typed password to /api/admin/login and, on
// success, receives an httpOnly session cookie it cannot read.

export const SESSION_COOKIE = 'admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function adminPassword(): string {
  // Set ADMIN_PASSWORD in .env (server-only). Fallback keeps local dev working.
  return process.env.ADMIN_PASSWORD ?? 'duke2025';
}

function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_PASSWORD ??
    'insecure-dev-session-secret'
  );
}

/** Timing-safe password comparison. */
export function verifyPassword(input: string): boolean {
  const a = crypto.createHash('sha256').update(input ?? '').digest();
  const b = crypto.createHash('sha256').update(adminPassword()).digest();
  return crypto.timingSafeEqual(a, b);
}

function sign(body: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
}

/** Create a signed session token carrying its own expiry. */
export function createSessionToken(): string {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const body = Buffer.from(payload).toString('base64url');
  return `${body}.${sign(body)}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;

  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof exp === 'number' && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/** Whether the current request carries a valid admin session cookie. */
export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return isValidToken(store.get(SESSION_COOKIE)?.value);
}
