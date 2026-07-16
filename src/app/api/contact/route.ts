import { sbInsert } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { distinctIdFromRequest, getPostHogClient } from '@/lib/posthog-server';

function sanitizeStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Send a notification email to the site owner. Best-effort — never throws. */
async function notifyOwner(req: {
  name: string;
  email: string;
  type: 'removal' | 'contact';
  linkedin_url: string;
  message: string;
}): Promise<void> {
  const to = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (!to) return;

  const label = req.type === 'removal' ? 'Profile removal request' : 'New contact message';
  const rows: [string, string][] = [
    ['Name', req.name],
    ['Email', req.email],
    ['Type', req.type],
    ...(req.linkedin_url ? ([['LinkedIn / URL', req.linkedin_url]] as [string, string][]) : []),
    ...(req.message ? ([['Message', req.message]] as [string, string][]) : []),
  ];

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px">
      <h2 style="color:#003087;margin:0 0 4px">${esc(label)}</h2>
      <p style="color:#666;margin:0 0 16px;font-size:14px">Submitted via the Duke Sports Alumni Directory.</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:6px 12px 6px 0;color:#888;vertical-align:top;white-space:nowrap"><strong>${esc(
                k,
              )}</strong></td><td style="padding:6px 0;color:#222">${esc(v).replace(
                /\n/g,
                '<br>',
              )}</td></tr>`,
          )
          .join('')}
      </table>
    </div>`;

  const text = `${label}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}`;

  await sendEmail({
    to,
    subject: `[Duke Sports Directory] ${label} — ${req.name}`,
    html,
    text,
    replyTo: req.email,
  });
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const b = body as Record<string, unknown>;

    const name = sanitizeStr(b.name, 100);
    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

    const email = sanitizeStr(b.email, 200);
    if (!email || !isValidEmail(email)) {
      return Response.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const type = b.type === 'removal' || b.type === 'contact' ? b.type : null;
    if (!type) return Response.json({ error: 'Request type is required' }, { status: 400 });

    const linkedin_url = sanitizeStr(b.linkedin_url, 300);
    if (type === 'removal' && !linkedin_url) {
      return Response.json({ error: 'LinkedIn or profile URL is required for removal requests' }, { status: 400 });
    }

    const message = sanitizeStr(b.message, 1000);
    if (type === 'contact' && !message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    await sbInsert('contact_requests', { name, email, type, linkedin_url, message });

    // Fire the notification email; failures are logged but must not fail the
    // request, since the record is already safely stored in Supabase.
    await notifyOwner({ name, email, type, linkedin_url, message });

    const posthog = getPostHogClient();
    posthog?.capture({
      distinctId: distinctIdFromRequest(request, email),
      event: 'contact_request_created',
      properties: {
        type,
        has_linkedin: Boolean(linkedin_url),
        source: 'api',
      },
    });
    await posthog?.flush();

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
