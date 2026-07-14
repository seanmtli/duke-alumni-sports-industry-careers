'use client';

import { Input } from '@/components/ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <Input
          type="search"
          placeholder="Search by name..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 h-11 text-sm"
        />
      </div>
      <p className="mt-1 text-xs text-gray-500 hidden sm:block">
        Filter by company, industry, school, or location in the sidebar →
      </p>
    </div>
  );
}
