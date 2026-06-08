import Image from 'next/image';
import type { Alumni } from '@/types/alumni';
import styles from './AlumniCard.module.css';

interface AlumniCardProps {
  alumni: Alumni;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AlumniCard({ alumni }: AlumniCardProps) {
  const {
    name,
    grad_year,
    school,
    current_title,
    current_company,
    linkedin_url,
    location,
    headshot_url,
    sports_league_affiliation,
  } = alumni;

  return (
    <div className={styles.card}>
      {/* Photo zone */}
      <div className={styles.photoWrapper}>
        {headshot_url ? (
          <Image
            src={headshot_url}
            alt={name}
            fill
            className={`${styles.photo} object-cover`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className={styles.photoPlaceholder}>{getInitials(name)}</div>
        )}
      </div>

      {/* Body zone */}
      <div className={styles.body}>
        <p className={styles.meta}>
          {school === 'Other' ? 'Duke' : school} &rsquo;{String(grad_year).slice(-2)}
          {sports_league_affiliation ? ` · ${sports_league_affiliation}` : ''}
        </p>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.title}>{current_title}</p>
        <p className={styles.company}>{current_company}</p>

        <div className={styles.footer}>
          <span>{location}</span>
        </div>
      </div>

      {/* CTA zone — revealed on hover */}
      <div className={styles.cta}>
        <a
          href={linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ctaLink}
          onClick={(e) => e.stopPropagation()}
        >
          {linkedin_url?.includes('linkedin.com') ? 'View on LinkedIn →' : 'View Profile →'}
        </a>
      </div>
    </div>
  );
}
