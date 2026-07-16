import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getClubBySlug, getClubAlumni } from '@/lib/getClubs';
import { isClubSlug, CLUB_SLUGS, CLUB_BADGE_COLORS } from '@/lib/clubs';
import { ClubDirectoryClient } from '@/components/clubs/ClubDirectoryClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CLUB_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) return { title: 'Club | Duke Sports Alumni' };
  return {
    title: `${club.short_name} Alumni | Duke Sports Alumni`,
    description: club.description,
  };
}

export default async function ClubPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isClubSlug(slug)) notFound();

  const club = await getClubBySlug(slug);
  if (!club) notFound();

  const alumni = await getClubAlumni(slug);
  const color = CLUB_BADGE_COLORS[slug];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <Link
            href="/clubs"
            className="text-sm font-medium text-[#003087] hover:underline mb-4 inline-block"
          >
            ← All clubs
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span
              className="inline-flex text-xs font-bold tracking-wide uppercase px-2.5 py-1 rounded-full"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              ★ {club.short_name}
            </span>
            <span className="text-sm text-gray-500">
              {alumni.length} {alumni.length === 1 ? 'alumnus' : 'alumni'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
            {club.name}
          </h1>
          <p className="text-base text-gray-600 max-w-2xl leading-relaxed">
            {club.description} Includes members now in the sports industry
            directory and club alumni working elsewhere — useful for current
            students looking to reconnect.
          </p>
        </div>
      </div>

      <ClubDirectoryClient initialData={alumni} clubShortName={club.short_name} />
    </div>
  );
}
