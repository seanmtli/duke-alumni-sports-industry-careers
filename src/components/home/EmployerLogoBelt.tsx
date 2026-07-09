interface EmployerLogoBeltProps {
  logos: { label: string; logo_url: string }[];
}

/** Continuously-scrolling logo strip (Teamworks-style). Pure CSS: the track
 * is duplicated and translated by exactly -50%, so the loop point is
 * seamless. No carousel library needed for a one-directional infinite scroll. */
export function EmployerLogoBelt({ logos }: EmployerLogoBeltProps) {
  if (logos.length === 0) return null;
  const track = [...logos, ...logos];

  return (
    <div className="bg-black py-10 overflow-hidden">
      <div className="flex w-max animate-[logo-scroll_30s_linear_infinite]">
        {track.map(({ label, logo_url }, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${label}-${i}`}
            src={logo_url}
            alt={label}
            title={label}
            className="h-10 w-auto max-w-[120px] object-contain mx-10 opacity-90"
          />
        ))}
      </div>
    </div>
  );
}
