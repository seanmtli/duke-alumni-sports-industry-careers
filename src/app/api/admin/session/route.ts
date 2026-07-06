import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';

export async function GET() {
  return NextResponse.json({ authed: await isAdminAuthed() });
}
