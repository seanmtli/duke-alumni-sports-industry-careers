'use client';

import type { FilterState } from '@/types/alumni';
import { DEFAULT_FILTERS } from '@/types/alumni';

const SCHOOL_DISPLAY: Partial<Record<string, string>> = { Other: 'Other School' };

interface FilterChipsProps {
  filters: FilterState;
  onRemove: (key: keyof FilterState, value: string) => void;
  onClearAll: () => void;
  activeCount: number;
}

export function FilterChips({ filters, onRemove, onClearAll, activeCount }: FilterChipsProps) {
  if (activeCount === 0) return null;

  const chips: { key: keyof FilterState; value: string }[] = [
    ...filters.companyTypes.map((v) => ({ key: 'companyTypes' as const, value: v })),
    ...filters.schools.map((v) => ({ key: 'schools' as const, value: v })),
    ...filters.locations.map((v) => ({ key: 'locations' as const, value: v })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map(({ key, value }) => (
        <span
          key={`${key}-${value}`}
          className="inline-flex items-center gap-1 text-xs bg-[#dce6f7] text-[#003087] font-medium px-2.5 py-1 rounded-full"
        >
          {key === 'schools' ? (SCHOOL_DISPLAY[value] ?? value) : value}
          <button
            onClick={() => onRemove(key, value)}
            className="ml-0.5 hover:text-[#001a5c] transition-colors"
            aria-label={`Remove ${value} filter`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-xs text-gray-500 hover:text-gray-800 underline transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
