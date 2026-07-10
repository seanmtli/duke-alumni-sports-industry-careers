'use client';

import { useState, useMemo } from 'react';
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

  const filteredAlumni = useMemo(() => {
    const filtered = filterAlumni(initialData, filters, searchQuery);
    return sortAlumni(filtered, sortConfig);
  }, [initialData, filters, searchQuery, sortConfig]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery('');
  }

  const hasSearchQuery = searchQuery.trim().length >= 2;

  const activeFilterCount =
    filters.orgCategories.length +
    filters.sportsFunctions.length +
    filters.schools.length +
    filters.locations.length +
    filters.companies.length +
    (hasSearchQuery ? 1 : 0);

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
    hasSearchQuery,
  };
}
