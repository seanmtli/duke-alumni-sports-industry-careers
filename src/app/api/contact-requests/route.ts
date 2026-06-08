import { promises as fs } from 'fs';
import path from 'path';
import type { ContactRequest } from '@/types/alumni';

const FILE = path.join(process.cwd(), 'src/data/contact-requests.json');
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'duke2025';

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

async function readRequests(): Promise<ContactRequest[]> {
  const raw = await fs.readFile(FILE, 'utf-8').catch(() => '{"requests":[]}');
  try {
    const data = JSON.parse(raw) as { requests: ContactRequest[] };
    return Array.isArray(data.requests) ? data.requests : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  if (request.headers.get('x-admin-password') !== ADMIN_PW) return unauthorized();
  const requests = await readRequests();
  return Response.json({ requests });
}

export async function DELETE(request: Request) {
  if (request.headers.get('x-admin-password') !== ADMIN_PW) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return Response.json({ error: 'Missing request id' }, { status: 400 });
  }

  const requests = await readRequests();
  const filtered = requests.filter((r) => r.request_id !== id);

  if (filtered.length === requests.length) {
    return Response.json({ error: 'Request not found' }, { status: 404 });
  }

  await fs.writeFile(FILE, JSON.stringify({ requests: filtered }, null, 2));
  return Response.json({ ok: true });
}
