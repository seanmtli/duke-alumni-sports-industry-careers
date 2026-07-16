'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Alumni } from '@/types/alumni';
import { useDebounce } from '@/hooks/useDebounce';
import { searchByName, sortAlumni } from '@/lib/filterAlumni';
import { AlumniGrid } from '@/components/directory/AlumniGrid';
import { SearchBar } from '@/components/directory/SearchBar';
import { ResultsCount } from '@/components/directory/ResultsCount';

const PAGE_SIZE = 25;

interface Props {
  initialData: Alumni[];
  clubShortName: string;
}

export function ClubDirectoryClient({ initialData, clubShortName }: Props) {
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebounce(rawQuery, 200);
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const searched = searchByName(initialData, debouncedQuery);
    return sortAlumni(searched, { field: 'name', direction: 'asc' });
  }, [initialData, debouncedQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (initialData.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-600">
          No {clubShortName} alumni loaded yet. Run the club discovery scrape
          or ask club leadership to fill the roster gap.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex-1">
          <SearchBar value={rawQuery} onChange={setRawQuery} />
        </div>
        <ResultsCount count={filtered.length} total={initialData.length} />
      </div>

      <AlumniGrid alumni={paged} />

      {totalPages > 1 ? (
        <div className="flex justify-center gap-2 mt-8">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
