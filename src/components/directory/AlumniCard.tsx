import Image from 'next/image';
import type { Alumni } from '@/types/alumni';
import { SPORTS_FUNCTION_LABELS, SPORTS_FUNCTION_COLORS } from '@/lib/constants';
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
    sports_functions,
  } = alumni;

  const schoolLabel = school === 'Other' ? 'Duke' : school;
  const yearLabel = grad_year ? ` ’${String(grad_year).slice(-2)}` : '';
  const topFunctions = (sports_functions ?? []).slice(0, 2);

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
          {schoolLabel}{yearLabel}
          {sports_league_affiliation ? ` · ${sports_league_affiliation}` : ''}
        </p>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.title}>{current_title}</p>
        {current_company ? <p className={styles.company}>{current_company}</p> : null}

        {topFunctions.length > 0 && (
          <div className={styles.tags}>
            {topFunctions.map((fn) => {
              const color = SPORTS_FUNCTION_COLORS[fn];
              return (
                <span
                  key={fn}
                  style={{
                    backgroundColor: color?.bg ?? '#f3f4f6',
                    color: color?.text ?? '#374151',
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 9999,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {SPORTS_FUNCTION_LABELS[fn] ?? fn}
                </span>
              );
            })}
          </div>
        )}

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
