import { CompanyLogo } from '@/components/ui/CompanyLogo';

interface RankedListProps {
  items: { label: string; count: number; logo_src?: string | null }[];
  max?: number;
}

export function RankedList({ items, max = 10 }: RankedListProps) {
  const displayed = items.slice(0, max);
  const topCount = displayed[0]?.count ?? 1;

  return (
    <ol className="space-y-2.5">
      {displayed.map(({ label, count, logo_src }, i) => (
        <li key={label} className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-300 w-4 text-right flex-shrink-0">
            {i + 1}
          </span>
          {logo_src && (
            <CompanyLogo
              src={logo_src}
              alt=""
              width={40}
              height={40}
              className="w-5 h-5 rounded object-contain flex-shrink-0 bg-white border border-gray-100"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm text-gray-700 truncate">{label}</span>
              <span className="text-xs font-semibold text-gray-500 ml-2 flex-shrink-0">{count}</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#003087]"
                style={{ width: `${(count / topCount) * 100}%`, opacity: 0.6 + 0.4 * (count / topCount) }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
