'use client';

import { useState, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import type { Alumni, FilterState, SortConfig } from '@/types/alumni';
import { DEFAULT_FILTERS } from '@/types/alumni';
import { filterAlumni, sortAlumni } from '@/lib/filterAlumni';

export function useAlumniFilter(initialData: Alumni[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'name',
    direction: 'asc',
  });

  const fuseRef = useRef<Fuse<Alumni>>(
    new Fuse(initialData, {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'current_company', weight: 1.5 },
        { name: 'current_title', weight: 1 },
        { name: 'location', weight: 0.8 },
        { name: 'sub_industries', weight: 0.6 },
      ],
      threshold: 0.2,
      includeScore: true,
      minMatchCharLength: 2,
    })
  );

  const filteredAlumni = useMemo(() => {
    const filtered = filterAlumni(initialData, filters, searchQuery, fuseRef.current);
    return sortAlumni(filtered, sortConfig);
  }, [initialData, filters, searchQuery, sortConfig]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  }

  const activeFilterCount =
    filters.companyTypes.length +
    filters.schools.length +
    filters.locations.length;

  return {
    filteredAlumni,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortConfig,
    setSortConfig,
    resetFilters,
    activeFilterCount,
  };
}
