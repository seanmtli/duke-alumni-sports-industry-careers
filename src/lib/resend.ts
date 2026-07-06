// Server-only Resend REST client. Kept dependency-free (raw fetch) to match the
// Supabase helper's approach. Only import from Route Handlers / Server
// Components — the API key must never reach the browser.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL || 'Duke Sports Directory <onboarding@resend.dev>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Set to the submitter's address so replies go straight to them. */
  replyTo?: string;
}

/**
 * Send an email via Resend. Returns true on success. Never throws — email is a
 * best-effort side effect and must not break the request that triggered it.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — skipping email send');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`Resend ${res.status}: ${body.slice(0, 500)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend request failed:', err);
    return false;
  }
}
