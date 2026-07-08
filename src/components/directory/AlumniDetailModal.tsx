'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import type { Alumni, Role } from '@/types/alumni';
import { degreeChips, formatChip } from '@/lib/degrees';
import styles from './AlumniDetailModal.module.css';

interface Props {
  alumni: Alumni;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function year(iso: string | null): string | null {
  return iso && iso.length >= 4 ? iso.slice(0, 4) : null;
}

/** "2021 – 2024", "2024 – Present", "2024", or "" when no dates are known. */
function dateRange(r: Role): string {
  const start = year(r.start_date);
  const end = r.is_current ? 'Present' : year(r.end_date);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}

export function AlumniDetailModal({ alumni, onClose }: Props) {
  const {
    name, current_title, current_company, linkedin_url, location,
    headshot_url, sports_league_affiliation, work_history, bio, reach_out_for,
  } = alumni;

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const chips = degreeChips(alumni);
  const degreeLine = chips.map(formatChip).join(' · ');
  const roles = work_history ?? [];

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={name}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.header}>
          <div className={styles.photo}>
            {headshot_url ? (
              <Image src={headshot_url} alt={name} fill className="object-cover" sizes="76px" />
            ) : (
              <div className={styles.photoPlaceholder}>{getInitials(name)}</div>
            )}
          </div>
          <div className={styles.headerText}>
            <p className={styles.meta}>
              {degreeLine || 'Duke'}
              {sports_league_affiliation ? ` · ${sports_league_affiliation}` : ''}
            </p>
            <h2 className={styles.name}>{name}</h2>
            {current_title ? (
              <p className={styles.role}>
                {current_title}
                {current_company ? (
                  <> · <span className={styles.roleCompany}>{current_company}</span></>
                ) : null}
              </p>
            ) : null}
            {location ? <p className={styles.role}>{location}</p> : null}
          </div>
        </div>

        <div className={styles.body}>
          {bio ? (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>About</p>
              <p className={styles.bio}>{bio}</p>
            </section>
          ) : null}

          {reach_out_for && reach_out_for.length > 0 ? (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Happy to chat about</p>
              <div className={styles.reachTags}>
                {reach_out_for.map((r) => (
                  <span key={r} className={styles.reachTag}>{r}</span>
                ))}
              </div>
            </section>
          ) : null}

          {roles.length > 0 ? (
            <section className={styles.section}>
              <p className={styles.sectionLabel}>Experience</p>
              <ul className={styles.timeline}>
                {roles.map((r, i) => (
                  <li key={`${r.company}-${r.title}-${i}`} className={styles.entry}>
                    <span className={`${styles.dot} ${r.is_current ? styles.dotCurrent : ''}`} />
                    {r.title ? <div className={styles.entryTitle}>{r.title}</div> : null}
                    <div className={styles.entryCompany}>{r.company}</div>
                    {dateRange(r) ? <div className={styles.entryDates}>{dateRange(r)}</div> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {linkedin_url ? (
          <div className={styles.footer}>
            <a className={styles.linkedin} href={linkedin_url} target="_blank" rel="noopener noreferrer">
              {linkedin_url.includes('linkedin.com') ? 'View on LinkedIn →' : 'View Profile →'}
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
