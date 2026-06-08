'use client';

import type { SortConfig } from '@/types/alumni';
import { SORT_OPTIONS } from '@/lib/constants';

interface SortControlsProps {
  sortConfig: SortConfig;
  onChange: (config: SortConfig) => void;
}

export function SortControls({ sortConfig, onChange }: SortControlsProps) {
  const currentValue = `${sortConfig.field}-${sortConfig.direction}`;

  function handleChange(value: string) {
    const [field, direction] = value.split('-') as [SortConfig['field'], SortConfig['direction']];
    onChange({ field, direction });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 whitespace-nowrap">Sort by</span>
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#003087] bg-white text-gray-700"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
