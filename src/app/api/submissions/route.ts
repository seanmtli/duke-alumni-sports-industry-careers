import { promises as fs } from 'fs';
import path from 'path';
import type { Submission } from '@/types/alumni';

const FILE = path.join(process.cwd(), 'src/data/submissions.json');
const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'duke2025';

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

async function readSubmissions(): Promise<Submission[]> {
  const raw = await fs.readFile(FILE, 'utf-8').catch(() => '{"submissions":[]}');
  try {
    const data = JSON.parse(raw) as { submissions: Submission[] };
    return Array.isArray(data.submissions) ? data.submissions : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  if (request.headers.get('x-admin-password') !== ADMIN_PW) return unauthorized();
  const submissions = await readSubmissions();
  return Response.json({ submissions });
}

export async function DELETE(request: Request) {
  if (request.headers.get('x-admin-password') !== ADMIN_PW) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return Response.json({ error: 'Missing submission id' }, { status: 400 });
  }

  const submissions = await readSubmissions();
  const filtered = submissions.filter((s) => s.submission_id !== id);

  if (filtered.length === submissions.length) {
    return Response.json({ error: 'Submission not found' }, { status: 404 });
  }

  await fs.writeFile(FILE, JSON.stringify({ submissions: filtered }, null, 2));
  return Response.json({ ok: true });
}
