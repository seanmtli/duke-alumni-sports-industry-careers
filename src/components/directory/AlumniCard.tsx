'use client';

import Image from 'next/image';
import type { Alumni } from '@/types/alumni';
import { SPORTS_FUNCTION_LABELS, SPORTS_FUNCTION_COLORS } from '@/lib/constants';
import { degreeChips, formatChip } from '@/lib/degrees';
import styles from './AlumniCard.module.css';

interface AlumniCardProps {
  alumni: Alumni;
  onOpen: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AlumniCard({ alumni, onOpen }: AlumniCardProps) {
  const {
    name,
    current_title,
    current_company,
    linkedin_url,
    location,
    headshot_url,
    sports_league_affiliation,
    sports_functions,
    clubs,
  } = alumni;

  // Show every Duke degree — a Trinity undergrad who later did a Fuqua MBA
  // reads "Trinity ’14 · Fuqua ’20". Cap at two chips; overflow becomes "+N".
  const chips = degreeChips(alumni);
  const shownChips = chips.slice(0, 2);
  const extraChips = chips.length - shownChips.length;
  const degreeLabel =
    shownChips.map(formatChip).join(' · ') + (extraChips > 0 ? ` +${extraChips}` : '');
  const topFunctions = (sports_functions ?? []).slice(0, 2);
  const clubBadges = (clubs ?? []).slice(0, 3);

  return (
    <div
      className={styles.card}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
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
        {clubBadges.length > 0 ? (
          <div className={styles.clubBadges} aria-label="Duke club affiliations">
            {clubBadges.map((c) => (
              <span key={c.slug} className={styles.clubBadge} title={c.name ?? c.short_name}>
                ★ {c.short_name}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Body zone */}
      <div className={styles.body}>
        <p className={styles.meta}>
          {degreeLabel || 'Duke'}
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
