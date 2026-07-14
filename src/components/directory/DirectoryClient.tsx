'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Alumni, FilterState } from '@/types/alumni';
import { useAlumniFilter } from '@/hooks/useAlumniFilter';
import { useDebounce } from '@/hooks/useDebounce';
import { AlumniGrid } from './AlumniGrid';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { FilterChips } from './FilterChips';
import { SortControls } from './SortControls';
import { ResultsCount } from './ResultsCount';
import { buildLocationOptions, buildCompanyOptions } from '@/lib/filterAlumni';

const PAGE_SIZE = 25;

interface DirectoryClientProps {
  initialData: Alumni[];
}

export function DirectoryClient({ initialData }: DirectoryClientProps) {
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebounce(rawQuery, 200);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const {
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
  } = useAlumniFilter(initialData);

  // Sync debounced input to the filter hook
  useEffect(() => {
    setSearchQuery(debouncedQuery);
  }, [debouncedQuery, setSearchQuery]);

  // Reset to page 1 whenever filtered results change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAlumni]);

  const locationOptions = useMemo(() => buildLocationOptions(initialData), [initialData]);
  const companyOptions = useMemo(() => buildCompanyOptions(initialData), [initialData]);

  const totalPages = Math.ceil(filteredAlumni.length / PAGE_SIZE);
  const pagedAlumni = filteredAlumni.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function removeFilter(key: keyof FilterState, value: string) {
    const current = filters[key] as string[];
    setFilters({ ...filters, [key]: current.filter((v) => v !== value) });
  }

  function handleClearAll() {
    resetFilters();
    setRawQuery('');
  }

  function handleClearSearch() {
    setRawQuery('');
    setSearchQuery('');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar value={rawQuery} onChange={setRawQuery} />
            </div>
            <SortControls sortConfig={sortConfig} onChange={setSortConfig} />
            {/* Mobile filter toggle */}
            <button
              onClick={() => setMobileFiltersOpen((o) => !o)}
              className="lg:hidden relative flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-md px-3 py-2 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h4" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#003087] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-8">
          {/* Sidebar filters — desktop */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800">Filters</h2>
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-[#003087] hover:underline"
                  >
                    Clear all ({activeFilterCount})
                  </button>
                )}
              </div>
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                locationOptions={locationOptions}
                companyOptions={companyOptions}
              />
            </div>
          </aside>

          {/* Mobile filter drawer */}
          {mobileFiltersOpen && (
            <div className="lg:hidden fixed inset-0 z-40 flex">
              <div
                className="fixed inset-0 bg-black/40"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <div className="relative ml-auto w-72 bg-white h-full overflow-y-auto p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-800">Filters</h2>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="text-gray-500 hover:text-gray-800 text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { handleClearAll(); setMobileFiltersOpen(false); }}
                    className="text-xs text-[#003087] hover:underline mb-4 block"
                  >
                    Clear all filters
                  </button>
                )}
                <FilterPanel
                  filters={filters}
                  onChange={setFilters}
                  locationOptions={locationOptions}
                  companyOptions={companyOptions}
                />
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <ResultsCount count={pagedAlumni.length} total={filteredAlumni.length} />
              <FilterChips
                filters={filters}
                searchQuery={hasSearchQuery ? searchQuery : undefined}
                onRemove={removeFilter}
                onClearSearch={handleClearSearch}
                onClearAll={handleClearAll}
                activeCount={activeFilterCount}
              />
            </div>
            <AlumniGrid alumni={pagedAlumni} />

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>

                {/* Page number buttons */}
                {(() => {
                  const pages: (number | 'ellipsis')[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('ellipsis');
                    for (
                      let i = Math.max(2, currentPage - 1);
                      i <= Math.min(totalPages - 1, currentPage + 1);
                      i++
                    ) {
                      pages.push(i);
                    }
                    if (currentPage < totalPages - 2) pages.push('ellipsis');
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-sm select-none">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                          p === currentPage
                            ? 'bg-[#003087] text-white'
                            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
