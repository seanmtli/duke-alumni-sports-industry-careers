import Link from 'next/link';
import Image from 'next/image';
import { getAlumni } from '@/lib/getAlumni';

export default async function HomePage() {
  const alumni = await getAlumni();
  const totalAlumni = alumni.length;
  const totalCompanies = new Set(alumni.map((a) => a.current_company)).size;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background image */}
        <Image
          src="/hero.jpg"
          alt="Cameron Indoor Stadium"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Duke-tinted dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,20,70,0.78) 0%, rgba(0,30,80,0.65) 60%, rgba(0,20,70,0.82) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 uppercase tracking-wider border border-white/25">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            Duke University · Sports Industry
          </div>

          <h1
            className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-tight mb-4"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
          >
            Where Duke meets{' '}
            <span style={{ color: '#7eb3ff' }}>sports</span>.
          </h1>

          <p
            className="text-lg text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.35)' }}
          >
            A curated directory of Duke alumni working across the sports industry —
            from leagues and teams to startups, media, analytics, and big tech.
            Find your people.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/directory"
              className="inline-flex items-center gap-2 bg-white text-[#003087] font-semibold px-7 py-3.5 rounded-lg hover:bg-blue-50 transition-colors text-sm shadow-lg"
            >
              Browse Directory
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/stats"
              className="inline-flex items-center gap-2 border border-white/50 text-white font-medium px-7 py-3.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
            >
              View Stats
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[#003087]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-center text-white">
            <div>
              <p className="text-3xl font-bold">{totalAlumni}</p>
              <p className="text-sm text-blue-200 mt-0.5">Alumni tracked</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{totalCompanies}</p>
              <p className="text-sm text-blue-200 mt-0.5">Companies represented</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-3xl font-bold">17</p>
              <p className="text-sm text-blue-200 mt-0.5">Sub-industries covered</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-3 gap-8 text-center">
          {[
            {
              icon: '🔍',
              title: 'Search & Filter',
              body: 'Find alumni by name, company, sub-industry, school, seniority, and more.',
            },
            {
              icon: '🔗',
              title: 'Connect on LinkedIn',
              body: 'Every profile links directly to LinkedIn — one click to reach out.',
            },
            {
              icon: '📊',
              title: 'Explore the Landscape',
              body: 'See where Duke grads have landed across every corner of the sports ecosystem.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="flex flex-col items-center">
              <span className="text-3xl mb-3">{icon}</span>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
