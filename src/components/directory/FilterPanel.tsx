'use client';

import type { FilterState, CompanyType, School } from '@/types/alumni';
import type { LocationOptions } from '@/lib/filterAlumni';
import { COMPANY_TYPES, SCHOOLS } from '@/lib/constants';

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  locationOptions: LocationOptions;
}

function MultiCheckbox<T extends string>({
  label,
  options,
  selected,
  onToggle,
  displayMap,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  displayMap?: Partial<Record<T, string>>;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{label}</p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label key={opt} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt)}
                className="rounded border-gray-300 text-[#003087] focus:ring-[#003087] focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer"
              />
              <span className={`text-sm leading-tight transition-colors ${
                checked ? 'text-[#003087] font-medium' : 'text-gray-600 group-hover:text-gray-900'
              }`}>
                {displayMap?.[opt] ?? opt}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function LocationFilter({
  locationOptions,
  selected,
  onChange,
}: {
  locationOptions: LocationOptions;
  selected: string[];
  onChange: (locations: string[]) => void;
}) {
  const { usCities, countries } = locationOptions;

  const allUSSelected = usCities.length > 0 && usCities.every((c) => selected.includes(c));
  const someUSSelected = usCities.some((c) => selected.includes(c));

  function toggleAllUS() {
    if (allUSSelected) {
      onChange(selected.filter((l) => !usCities.includes(l)));
    } else {
      const nonUS = selected.filter((l) => !usCities.includes(l));
      onChange([...nonUS, ...usCities]);
    }
  }

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  }

  const checkboxClass =
    'rounded border-gray-300 text-[#003087] focus:ring-[#003087] focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer';

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Location</p>

      {/* United States section */}
      {usCities.length > 0 && (
        <div className="mb-3">
          {/* "United States" toggle-all row */}
          <label className="flex items-center gap-2 cursor-pointer group mb-1.5">
            <input
              type="checkbox"
              checked={allUSSelected}
              ref={(el) => { if (el) el.indeterminate = someUSSelected && !allUSSelected; }}
              onChange={toggleAllUS}
              className={checkboxClass}
            />
            <span className={`text-sm font-semibold leading-tight transition-colors ${
              someUSSelected ? 'text-[#003087]' : 'text-gray-700 group-hover:text-gray-900'
            }`}>
              United States
            </span>
          </label>

          {/* City sub-options */}
          <div className="pl-4 space-y-1.5">
            {usCities.map((city) => {
              const checked = selected.includes(city);
              return (
                <label key={city} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(city)}
                    className={checkboxClass}
                  />
                  <span className={`text-sm leading-tight transition-colors ${
                    checked ? 'text-[#003087] font-medium' : 'text-gray-600 group-hover:text-gray-900'
                  }`}>
                    {city}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* International section */}
      {countries.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">International</p>
          <div className="pl-4 space-y-1.5">
            {countries.map((country) => {
              const checked = selected.includes(country);
              return (
                <label key={country} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(country)}
                    className={checkboxClass}
                  />
                  <span className={`text-sm leading-tight transition-colors ${
                    checked ? 'text-[#003087] font-medium' : 'text-gray-600 group-hover:text-gray-900'
                  }`}>
                    {country}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterPanel({ filters, onChange, locationOptions }: FilterPanelProps) {
  function toggle<T extends string>(key: keyof FilterState, value: T) {
    const current = filters[key] as T[];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  function setGradYear(index: 0 | 1, value: number) {
    const next: [number, number] = [...filters.gradYearRange] as [number, number];
    next[index] = value;
    onChange({ ...filters, gradYearRange: next });
  }

  return (
    <aside className="w-full">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Grad Year
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1970}
            max={filters.gradYearRange[1]}
            value={filters.gradYearRange[0]}
            onChange={(e) => setGradYear(0, Number(e.target.value))}
            className="w-20 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#003087]"
          />
          <span className="text-gray-400 text-sm">–</span>
          <input
            type="number"
            min={filters.gradYearRange[0]}
            max={new Date().getFullYear()}
            value={filters.gradYearRange[1]}
            onChange={(e) => setGradYear(1, Number(e.target.value))}
            className="w-20 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#003087]"
          />
        </div>
      </div>

      <MultiCheckbox
        label="Company Type"
        options={COMPANY_TYPES}
        selected={filters.companyTypes}
        onToggle={(v) => toggle<CompanyType>('companyTypes', v)}
      />
      <MultiCheckbox
        label="School"
        options={SCHOOLS}
        selected={filters.schools}
        onToggle={(v) => toggle<School>('schools', v)}
        displayMap={{ Other: 'Other School' }}
      />
      <LocationFilter
        locationOptions={locationOptions}
        selected={filters.locations}
        onChange={(locations) => onChange({ ...filters, locations })}
      />
    </aside>
  );
}
