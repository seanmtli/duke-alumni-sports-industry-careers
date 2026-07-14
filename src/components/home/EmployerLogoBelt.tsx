import { CompanyLogo } from '@/components/ui/CompanyLogo';

interface EmployerLogoBeltProps {
  logos: { label: string; src: string }[];
}

/** Continuously-scrolling logo strip (Teamworks-style). Pure CSS: the track
 * is duplicated and translated by exactly -50%, so the loop point is
 * seamless. No carousel library needed for a one-directional infinite scroll. */
export function EmployerLogoBelt({ logos }: EmployerLogoBeltProps) {
  if (logos.length === 0) return null;
  const track = [...logos, ...logos];

  return (
    <div className="bg-white border-y border-gray-100 py-8 overflow-hidden">
      <div className="flex w-max items-center animate-[logo-scroll_30s_linear_infinite]">
        {track.map(({ label, src }, i) => (
          <div
            key={`${label}-${i}`}
            className="mx-10 flex h-12 w-[140px] flex-shrink-0 items-center justify-center"
          >
            <CompanyLogo
              src={src}
              alt={label}
              title={label}
              width={160}
              height={160}
              className="h-10 w-auto max-w-[120px] object-contain"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
