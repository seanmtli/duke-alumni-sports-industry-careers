import Link from 'next/link';
import { getClubCatalog, getClubMemberCounts } from '@/lib/getClubs';
import { CLUB_BADGE_COLORS } from '@/lib/clubs';

export const metadata = {
  title: 'Clubs | Duke Sports Alumni',
  description:
    'Duke sports-club alumni from DSBC, DSAC, and Fuqua MES — a way for current members to find and reach out to former clubmates.',
};

export default async function ClubsHubPage() {
  const [clubs, counts] = await Promise.all([
    getClubCatalog(),
    getClubMemberCounts(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#003087] mb-3">
          Club alumni
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">
          Duke sports clubs
        </h1>
        <p className="text-base text-gray-600 max-w-2xl leading-relaxed mb-10">
          Browse alumni who were part of Duke&apos;s sports business, analytics,
          and Fuqua MES communities — whether or not they work in sports today.
          Profiles already in the main sports directory are marked with a club star.
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => {
            const color = CLUB_BADGE_COLORS[club.slug];
            const count = counts[club.slug] ?? 0;
            return (
              <Link
                key={club.slug}
                href={`/clubs/${club.slug}`}
                className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-[#003087]/30"
              >
                <span
                  className="inline-flex text-xs font-bold tracking-wide uppercase px-2.5 py-1 rounded-full mb-4"
                  style={{ backgroundColor: color.bg, color: color.text }}
                >
                  ★ {club.short_name}
                </span>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-[#003087] transition-colors mb-2">
                  {club.name}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">
                  {club.description}
                </p>
                <p className="text-sm font-semibold text-[#003087]">
                  {count} {count === 1 ? 'alumnus' : 'alumni'} →
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
