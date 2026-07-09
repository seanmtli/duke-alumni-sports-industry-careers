import { getAlumni } from '@/lib/getAlumni';
import { computeStats } from '@/lib/computeStats';
import { getCompanyLogoMap } from '@/lib/companyLogos';
import { StatCard } from '@/components/stats/StatCard';
import { HorizontalBarChart } from '@/components/stats/HorizontalBarChart';
import { RankedList } from '@/components/stats/RankedList';

export const metadata = {
  title: 'Stats | Duke Sports Alumni',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-5">{title}</h2>
      {children}
    </section>
  );
}

export default async function StatsPage() {
  const [alumni, logoMap] = await Promise.all([getAlumni(), getCompanyLogoMap()]);
  const stats = computeStats(alumni);
  const topCompaniesWithLogos = stats.topCompanies.map((c) => ({
    ...c,
    logo_url: logoMap.get(c.label.toLowerCase()),
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Alumni Stats</h1>
        <p className="text-gray-500 text-sm mt-1">
          Snapshot of Duke&apos;s presence across the sports industry.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Alumni" value={stats.totalAlumni} />
        <StatCard label="Companies" value={stats.totalCompanies} />
        <StatCard label="Cities" value={stats.citiesRepresented} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="By Industry">
          <HorizontalBarChart data={stats.byOrgCategory} height={stats.byOrgCategory.length * 44} />
        </Section>

        <Section title="By Sports Function">
          <HorizontalBarChart data={stats.bySportsFunction} height={stats.bySportsFunction.length * 44} />
        </Section>

        <Section title="By Graduation Decade">
          <HorizontalBarChart data={stats.byGradDecade.map(d => ({ label: d.decade, count: d.count }))} height={stats.byGradDecade.length * 44} />
        </Section>

        <Section title="Top Companies">
          <RankedList items={topCompaniesWithLogos} />
        </Section>

        <Section title="Top Cities">
          <RankedList items={stats.topCities} />
        </Section>
      </div>
    </div>
  );
}
