import { promises as fs } from 'fs';
import path from 'path';
import { SCHOOLS, COMPANY_TYPES, SENIORITY_LEVELS, REACH_OUT_FOR_OPTIONS } from '@/lib/constants';
import type { Submission, School, CompanyType, SeniorityLevel } from '@/types/alumni';

const FILE = path.join(process.cwd(), 'src/data/submissions.json');

const VALID_SCHOOLS = new Set<string>(SCHOOLS);
const VALID_COMPANY_TYPES = new Set<string>(COMPANY_TYPES);
const VALID_SENIORITY = new Set<string>(SENIORITY_LEVELS);
const VALID_REACH_OUT_FOR = new Set<string>(REACH_OUT_FOR_OPTIONS);

// Serialize concurrent writes to prevent race conditions
let writeQueue: Promise<void> = Promise.resolve();

function sanitizeStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
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

    // Required field extraction and validation
    const name = sanitizeStr(b.name, 100);
    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

    const grad_year = Number(b.grad_year);
    const maxYear = new Date().getFullYear() + 5;
    if (!Number.isInteger(grad_year) || grad_year < 1838 || grad_year > maxYear) {
      return Response.json({ error: 'Invalid graduation year' }, { status: 400 });
    }

    const current_title = sanitizeStr(b.current_title, 150);
    if (!current_title) return Response.json({ error: 'Current title is required' }, { status: 400 });

    const current_company = sanitizeStr(b.current_company, 150);
    if (!current_company) return Response.json({ error: 'Current company is required' }, { status: 400 });

    const linkedin_url = sanitizeStr(b.linkedin_url, 300);
    const isValidLinkedIn =
      linkedin_url.startsWith('https://linkedin.com/') ||
      linkedin_url.startsWith('https://www.linkedin.com/');
    if (!linkedin_url || !isValidLinkedIn) {
      return Response.json(
        { error: 'A valid LinkedIn URL (https://linkedin.com/in/...) is required' },
        { status: 400 }
      );
    }

    // Optional enum fields — fall back to safe defaults for unknown values
    const schoolInput = typeof b.school === 'string' ? b.school : '';
    const school: School = VALID_SCHOOLS.has(schoolInput) ? (schoolInput as School) : 'Other';

    const companyTypeInput = typeof b.company_type === 'string' ? b.company_type : '';
    const company_type: CompanyType = VALID_COMPANY_TYPES.has(companyTypeInput)
      ? (companyTypeInput as CompanyType)
      : 'Other';

    const seniorityInput = typeof b.seniority_level === 'string' ? b.seniority_level : '';
    const seniority_level: SeniorityLevel = VALID_SENIORITY.has(seniorityInput)
      ? (seniorityInput as SeniorityLevel)
      : 'Mid';

    // reach_out_for: only accept values from the known options list
    const reach_out_for: string[] = Array.isArray(b.reach_out_for)
      ? [...new Set(b.reach_out_for.filter((o) => typeof o === 'string' && VALID_REACH_OUT_FOR.has(o)))]
      : [];

    const submission: Submission = {
      submission_id: crypto.randomUUID(),
      submitted_at: new Date().toISOString(),
      name,
      grad_year,
      school,
      degree: sanitizeStr(b.degree, 100),
      major: sanitizeStr(b.major, 100),
      current_company,
      current_title,
      company_type,
      seniority_level,
      linkedin_url,
      location: sanitizeStr(b.location, 100),
      bio: sanitizeStr(b.bio, 500),
      reach_out_for,
    };

    // Serialize writes to avoid race conditions.
    // Use an object wrapper so TypeScript control-flow analysis doesn't narrow
    // the value away after the async closure mutates it.
    const result = { outcome: 'ok' as string };
    writeQueue = writeQueue.then(async () => {
      const raw = await fs.readFile(FILE, 'utf-8').catch(() => '{"submissions":[]}');
      let data: { submissions: Submission[] };
      try {
        data = JSON.parse(raw) as { submissions: Submission[] };
        if (!Array.isArray(data.submissions)) data.submissions = [];
      } catch {
        data = { submissions: [] };
      }

      if (data.submissions.length >= 500) {
        result.outcome = 'queue_full';
        return;
      }
      if (data.submissions.some((s) => s.linkedin_url === submission.linkedin_url)) {
        result.outcome = 'duplicate';
        return;
      }

      data.submissions.push(submission);
      await fs.writeFile(FILE, JSON.stringify(data, null, 2));
    });
    await writeQueue;

    if (result.outcome === 'queue_full') {
      return Response.json({ error: 'Submission queue full, please try again later' }, { status: 503 });
    }
    if (result.outcome === 'duplicate') {
      return Response.json(
        { error: 'A submission with this LinkedIn URL is already pending review' },
        { status: 409 }
      );
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
