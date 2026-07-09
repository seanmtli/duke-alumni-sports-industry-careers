import { NextRequest, NextResponse } from 'next/server';

const CACHE = 'public, max-age=86400, stale-while-revalidate=604800';

function domainFallbacks(domain: string): string[] {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=128`,
    `https://unavatar.io/${clean}?fallback=false`,
  ];
}

async function fetchImage(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DukeSportsAlumni/1.0 (logo proxy)' },
      redirect: 'follow',
      next: { revalidate: 86400 },
    });
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && type.startsWith('image/')) return res;
  } catch {
    // try next source
  }
  return null;
}

function imageResponse(res: Response): NextResponse {
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/png',
      'Cache-Control': CACHE,
    },
  });
}

/** Proxy company logos with domain fallbacks for expired LinkedIn CDN URLs. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const domain = req.nextUrl.searchParams.get('domain');

  if (url) {
    const res = await fetchImage(url);
    if (res) return imageResponse(res);
  }

  if (domain) {
    for (const fallback of domainFallbacks(domain)) {
      const res = await fetchImage(fallback);
      if (res) return imageResponse(res);
    }
  }

  return new NextResponse('Logo not found', { status: 404 });
}
