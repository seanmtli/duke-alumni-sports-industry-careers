'use client';

import { useState } from 'react';
import type { Alumni } from '@/types/alumni';
import { AlumniCard } from './AlumniCard';
import { AlumniDetailModal } from './AlumniDetailModal';
import { captureClientEvent } from '@/lib/posthog-client';

interface AlumniGridProps {
  alumni: Alumni[];
}

export function AlumniGrid({ alumni }: AlumniGridProps) {
  const [selected, setSelected] = useState<Alumni | null>(null);

  function openProfile(a: Alumni, source: 'card' | 'card_linkedin') {
    captureClientEvent('alumni_profile_opened', {
      alumni_id: a.id,
      company: a.current_company,
      org_category: a.org_category,
      source,
    });
    setSelected(a);
  }

  if (alumni.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-2xl mb-2">🔍</p>
        <p className="font-semibold text-gray-700">No alumni match your filters</p>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your search or clearing filters</p>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '24px',
        }}
      >
        {alumni.map((a) => (
          <AlumniCard
            key={a.id}
            alumni={a}
            onOpen={() => openProfile(a, 'card')}
            onLinkedInClick={() => {
              captureClientEvent('alumni_linkedin_clicked', {
                alumni_id: a.id,
                company: a.current_company,
                source: 'card_cta',
              });
            }}
          />
        ))}
      </div>
      {selected && (
        <AlumniDetailModal
          alumni={selected}
          onClose={() => setSelected(null)}
          onLinkedInClick={() => {
            captureClientEvent('alumni_linkedin_clicked', {
              alumni_id: selected.id,
              company: selected.current_company,
              source: 'profile_modal',
            });
          }}
        />
      )}
    </>
  );
}
