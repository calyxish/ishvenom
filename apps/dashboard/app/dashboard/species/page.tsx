'use client';

import { useEffect, useState } from 'react';
import { getSpecies, type SpeciesRow } from '@/lib/api';

export default function SpeciesPage() {
  const [species, setSpecies] = useState<SpeciesRow[]>([]);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getSpecies()
      .then((r) => setSpecies(r.species))
      .catch((e: Error) => setError(e.message ?? 'Failed to load species'));
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-bold text-ish-text mb-1">Species catalog</h2>
      <p className="text-sm text-ish-text-secondary mb-8">
        {species.length > 0
          ? `${species.length} medically significant snake species tracked by IshVenom.`
          : 'Medically significant snake species tracked by IshVenom.'}
      </p>

      {/* Error banner */}
      {error && (
        <div className="mb-6 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {!error && species.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border border-ish-border bg-ish-surface rounded-2xl p-5 animate-pulse"
            >
              <div className="h-3 w-32 bg-ish-surface-hover rounded mb-2" />
              <div className="h-4 w-40 bg-ish-surface-hover rounded mb-4" />
              <div className="h-3 w-20 bg-ish-surface-hover rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Species grid */}
      {species.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {species.map((s) => (
            <SpeciesCard key={s.id} species={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SpeciesCard({ species: s }: { species: SpeciesRow }) {
  return (
    <div className="border border-ish-border bg-ish-surface rounded-2xl p-5 flex flex-col gap-3 hover:border-ish-accent/40 transition-colors">
      {/* Scientific name + venom badge */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ish-text italic leading-snug">
          {s.scientificName}
        </p>
        <VenomBadge venomous={s.venomous} />
      </div>

      {/* Common name */}
      {s.commonNames.en && (
        <p className="text-sm text-ish-text-secondary">
          {s.commonNames.en}
        </p>
      )}

      {/* Other common names (fr, ar, etc.) */}
      {Object.entries(s.commonNames)
        .filter(([lang]) => lang !== 'en')
        .length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(s.commonNames)
            .filter(([lang, name]) => lang !== 'en' && name)
            .map(([lang, name]) => (
              <span
                key={lang}
                className="text-[11px] text-ish-text-muted border border-ish-border rounded-lg px-2 py-0.5"
              >
                {lang.toUpperCase()}: {name}
              </span>
            ))}
        </div>
      )}

      {/* Antivenom */}
      <div className="mt-auto pt-3 border-t border-ish-border">
        <span className="text-[11px] uppercase tracking-wide text-ish-text-muted font-medium">
          Antivenom
        </span>
        <p className="text-xs text-ish-text-secondary mt-0.5">
          {s.antivenomName ?? 'Not specified'}
        </p>
      </div>
    </div>
  );
}

function VenomBadge({ venomous }: { venomous: string }) {
  const styles: Record<string, string> = {
    deadly:          'bg-ish-danger-surface text-ish-danger border-ish-danger/50',
    mildly_venomous: 'bg-ish-warning-surface text-ish-warning border-ish-warning/50',
    non_venomous:    'bg-ish-success-surface text-ish-success border-ish-success/50',
  };
  const labels: Record<string, string> = {
    deadly:          'DEADLY',
    mildly_venomous: 'MILD',
    non_venomous:    'NON-VENOMOUS',
  };
  const cls   = styles[venomous]  ?? styles.non_venomous;
  const label = labels[venomous] ?? venomous.replace(/_/g, ' ').toUpperCase();

  return (
    <span
      className={`shrink-0 inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${cls}`}
    >
      {label}
    </span>
  );
}
