import { NextResponse } from 'next/server';
import type { Submission } from '@/types/alumni';
import { isAdminAuthed } from '@/lib/auth';
import { sbSelect, sbDelete } from '@/lib/supabase';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// The submissions table's PK is `id`; alias it to `submission_id` so the
// frontend Submission type is unchanged. Only the pending ("new") queue shows.
const SUBMISSION_SELECT =
  'submission_id:id,submitted_at,name,grad_year,school,degree,major,all_degrees,' +
  'current_company,current_title,org_category,sports_functions,seniority_level,' +
  'linkedin_url,location,bio,reach_out_for';

export async function GET() {
  if (!(await isAdminAuthed())) return unauthorized();
  const submissions = await sbSelect<Submission>(
    'submissions',
    `select=${SUBMISSION_SELECT}&status=eq.new&order=submitted_at.desc`,
  );
  return NextResponse.json({ submissions });
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthed())) return unauthorized();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'Missing submission id' }, { status: 400 });
  }

  const deleted = await sbDelete<Submission>('submissions', `id=eq.${encodeURIComponent(id)}`);
  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
