/** Domains that resolve to the wrong brand on Logo.dev (or better match). */
const LOGO_DOMAIN_OVERRIDES: Record<string, string> = {
  'caa.com': 'caasports.com',
  'caa sports': 'caasports.com',
  'creative artists agency': 'caasports.com',
  'caa': 'caasports.com',
  'duke university': 'duke.edu',
  // hornets.com currently resolves to the NBA mark on Logo.dev
  'hornets.com': 'charlottehornets.com',
  'charlotte hornets': 'charlottehornets.com',
};

function cleanDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
}

/** Build a Logo.dev CDN URL for a company logo.
 * Prefer domain (most reliable); fall back to company name.
 * Docs: https://www.logo.dev/docs/logo-images/introduction
 */
export function companyLogoSrc(info: {
  name?: string | null;
  domain?: string | null;
  size?: number;
}): string | null {
  const token =
    process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (!token) return null;

  const name = info.name?.trim() || '';
  const nameKey = name.toLowerCase();
  let domain = info.domain ? cleanDomain(info.domain) : '';

  if (nameKey && LOGO_DOMAIN_OVERRIDES[nameKey]) {
    domain = LOGO_DOMAIN_OVERRIDES[nameKey];
  } else if (domain && LOGO_DOMAIN_OVERRIDES[domain]) {
    domain = LOGO_DOMAIN_OVERRIDES[domain];
  }

  if (!domain && !name) return null;

  const params = new URLSearchParams({
    token,
    size: String(info.size ?? 128),
    format: 'png',
    theme: 'light',
    retina: 'true',
    fallback: '404',
  });

  // Domain lookups are the canonical, most reliable path per Logo.dev docs.
  if (domain) {
    return `https://img.logo.dev/${encodeURIComponent(domain)}?${params}`;
  }
  return `https://img.logo.dev/name/${encodeURIComponent(name)}?${params}`;
}
