'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { getDistricts, getSpecies, type DistrictStat } from '@/lib/api';

// MapLibre touches window — client-only load required.
const IncidentMap = dynamic(
  () => import('@/components/IncidentMap').then((m) => m.IncidentMap),
  { ssr: false, loading: () => <MapLoading /> },
);

export default function MapPage() {
  const [districts, setDistricts] = useState<DistrictStat[]>([]);
  const [speciesNames, setSpeciesNames] = useState<string[]>([]);
  const [country, setCountry] = useState<string>('all');
  const [species, setSpecies] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getDistricts(), getSpecies()])
      .then(([d, s]) => {
        setDistricts(d.districts);
        setSpeciesNames(s.species.map((sp) => sp.scientificName).sort());
      })
      .catch((e: Error) => setError(e.message ?? 'Failed to load map data'));
  }, []);

  const countries = useMemo(
    () => Array.from(new Set(districts.map((d) => d.country))).sort(),
    [districts],
  );

  const filtered = useMemo(() => {
    return districts.filter((d) => {
      if (country !== 'all' && d.country !== country) return false;
      if (species !== 'all' && d.topSpecies !== species) return false;
      return true;
    });
  }, [districts, country, species]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl">
      <header className="mb-4">
        <h2 className="text-2xl md:text-3xl font-bold text-ish-text tracking-tight">
          Incident map
        </h2>
        <p className="text-sm text-ish-text-secondary mt-1">
          Encounters aggregated by country centroid. Circle size = count, colour = bite ratio.
        </p>
      </header>

      {error && (
        <div className="mb-4 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Filters bar ──────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
        <FilterSelect
          label="Country"
          value={country}
          onChange={setCountry}
          options={[
            { value: 'all', label: `All (${countries.length})` },
            ...countries.map((c) => ({ value: c, label: c })),
          ]}
        />
        <FilterSelect
          label="Top species"
          value={species}
          onChange={setSpecies}
          options={[
            { value: 'all', label: `All (${speciesNames.length})` },
            ...speciesNames.map((s) => ({ value: s, label: s })),
          ]}
        />
        <button
          type="button"
          onClick={() => {
            setCountry('all');
            setSpecies('all');
          }}
          className="text-xs text-ish-text-secondary hover:text-ish-text underline-offset-2 hover:underline sm:ml-auto self-start sm:self-center"
        >
          Clear filters
        </button>
      </div>

      {/* ── Map + legend overlay ─────────────────────────────────── */}
      <div className="relative border border-ish-border rounded-2xl overflow-hidden h-[60vh] min-h-[400px] md:h-[600px]">
        <IncidentMap districts={filtered} />

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-ish-surface/95 border border-ish-border rounded-xl px-3 py-2.5 text-[11px] backdrop-blur-sm">
          <div className="text-ish-text-muted uppercase tracking-wide font-medium mb-1.5">
            Bite ratio
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-gradient-to-r from-ish-accent via-ish-warning to-ish-danger" />
            <span className="text-ish-text-secondary">low → high</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-ish-text-muted">
        {filtered.length} of {districts.length} {districts.length === 1 ? 'district' : 'districts'} shown
      </div>
    </div>
  );
}

// ─── Filter select (themed dropdown) ────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-ish-text-muted uppercase tracking-wide font-medium">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-ish-surface border border-ish-border rounded-xl px-3 py-2 text-sm text-ish-text focus:outline-none focus:ring-2 focus:ring-ish-accent focus:border-transparent min-w-[160px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MapLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-ish-surface text-ish-text-muted text-sm">
      Loading map…
    </div>
  );
}
