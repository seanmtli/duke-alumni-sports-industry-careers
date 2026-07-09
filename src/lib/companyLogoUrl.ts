/** Build the proxied logo URL used by `<img>` tags. The API route tries the
 * stored LinkedIn URL first, then falls back to domain-based sources when the
 * URL is expired or blocked. */
export function companyLogoSrc(info: {
  logo_url?: string | null;
  domain?: string | null;
}): string | null {
  if (!info.logo_url && !info.domain) return null;
  const params = new URLSearchParams();
  if (info.logo_url) params.set('url', info.logo_url);
  if (info.domain) params.set('domain', info.domain);
  return `/api/company-logo?${params.toString()}`;
}
