'use client';

import { useState } from 'react';

interface CompanyLogoProps {
  src: string;
  alt: string;
  className?: string;
  title?: string;
  width?: number;
  height?: number;
}

/** Logo image via Logo.dev.
 * Uses a plain <img> (Logo.dev already CDN-sizes images; next/image would
 * re-encode through the optimizer — see logo.dev/docs/integrations/nextjs).
 * Hides itself when the source 404s (`fallback=404`). */
export function CompanyLogo({
  src,
  alt,
  className,
  title,
  width = 128,
  height = 128,
}: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      title={title}
      width={width}
      height={height}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
