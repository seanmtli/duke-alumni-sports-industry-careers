'use client';

import { useState } from 'react';

interface CompanyLogoProps {
  src: string;
  alt: string;
  className?: string;
  title?: string;
}

/** Logo image that hides itself when the proxied source 404s. */
export function CompanyLogo({ src, alt, className, title }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      title={title}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
