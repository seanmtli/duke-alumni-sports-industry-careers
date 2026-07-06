import { NextResponse } from 'next/server';
import type { ContactRequest } from '@/types/alumni';
import { isAdminAuthed } from '@/lib/auth';
import { sbSelect, sbDelete } from '@/lib/supabase';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// PK is `id`; alias to `request_id` to match the frontend ContactRequest type.
const REQUEST_SELECT = 'request_id:id,submitted_at,name,email,type,linkedin_url,message';

export async function GET() {
  if (!(await isAdminAuthed())) return unauthorized();
  const requests = await sbSelect<ContactRequest>(
    'contact_requests',
    `select=${REQUEST_SELECT}&status=eq.new&order=submitted_at.desc`,
  );
  return NextResponse.json({ requests });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed())) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'Missing request id' }, { status: 400 });
  }

  const deleted = await sbDelete<ContactRequest>('contact_requests', `id=eq.${encodeURIComponent(id)}`);
  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
