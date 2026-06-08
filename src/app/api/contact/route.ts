import { promises as fs } from 'fs';
import path from 'path';
import type { ContactRequest } from '@/types/alumni';

const FILE = path.join(process.cwd(), 'src/data/contact-requests.json');

let writeQueue: Promise<void> = Promise.resolve();

function sanitizeStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    const req: ContactRequest = {
      request_id: crypto.randomUUID(),
      submitted_at: new Date().toISOString(),
      name,
      email,
      type,
      linkedin_url,
      message,
    };

    const result = { outcome: 'ok' as string };
    writeQueue = writeQueue.then(async () => {
      const raw = await fs.readFile(FILE, 'utf-8').catch(() => '{"requests":[]}');
      let data: { requests: ContactRequest[] };
      try {
        data = JSON.parse(raw) as { requests: ContactRequest[] };
        if (!Array.isArray(data.requests)) data.requests = [];
      } catch {
        data = { requests: [] };
      }

      if (data.requests.length >= 500) {
        result.outcome = 'queue_full';
        return;
      }

      data.requests.push(req);
      await fs.writeFile(FILE, JSON.stringify(data, null, 2));
    });
    await writeQueue;

    if (result.outcome === 'queue_full') {
      return Response.json({ error: 'Request queue full, please try again later' }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
