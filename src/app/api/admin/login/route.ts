import { NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth';
import { distinctIdFromRequest, getPostHogClient } from '@/lib/posthog-server';

export async function POST(request: Request) {
  let password = '';
  try {
    const body = await request.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const posthog = getPostHogClient();
  const distinctId = distinctIdFromRequest(request, 'admin');

  if (!verifyPassword(password)) {
    posthog?.capture({
      distinctId,
      event: 'admin_login_failed',
      properties: { source: 'api' },
    });
    await posthog?.flush();
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  posthog?.identify({
    distinctId: 'admin',
    properties: { role: 'admin' },
  });
  posthog?.capture({
    distinctId: 'admin',
    event: 'admin_login_succeeded',
    properties: { source: 'api' },
  });
  await posthog?.flush();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
