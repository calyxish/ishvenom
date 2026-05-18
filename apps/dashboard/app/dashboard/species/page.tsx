'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSpecies, type SpeciesRow } from '@/lib/api';

type VenomFilter = 'all' | 'deadly' | 'mildly_venomous' | 'non_venomous';

export default function SpeciesPage() {
  const [species, setSpecies] = useState<SpeciesRow[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [venomFilter, setVenomFilter] = useState<VenomFilter>('all');

  useEffect(() => {
    getSpecies()
      .then((r) => setSpecies(r.species))
      .catch((e: Error) => setError(e.message ?? 'Failed to load species'));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return species.filter((s) => {
      if (venomFilter !== 'all' && s.venomous !== venomFilter) return false;
      if (!q) return true;
      if (s.scientificName.toLowerCase().includes(q)) return true;
      return Object.values(s.commonNames).some(
        (n) => typeof n === 'string' && n.toLowerCase().includes(q),
      );
    });
  }, [species, search, venomFilter]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl">
      <header className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-ish-text tracking-tight">
          Species catalog
        </h2>
        <p className="text-sm text-ish-text-secondary mt-1">
          {species.length > 0
            ? `${species.length} medically significant snake species tracked by IshVenom`
            : 'Medically significant snake species tracked by IshVenom'}
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-6 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Search + filter row ──────────────────────────────────── */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ish-text-muted"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by scientific or common name…"
            className="w-full bg-ish-surface border border-ish-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-ish-text placeholder:text-ish-text-muted focus:outline-none focus:ring-2 focus:ring-ish-accent focus:border-transparent"
          />
        </div>

        <div className="flex gap-1.5 bg-ish-surface border border-ish-border rounded-xl p-1">
          {(['all', 'deadly', 'mildly_venomous', 'non_venomous'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVenomFilter(v)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                venomFilter === v
                  ? 'bg-ish-accent text-white'
                  : 'text-ish-text-secondary hover:text-ish-text hover:bg-ish-surface-hover',
              ].join(' ')}
            >
              {v === 'all'
                ? 'All'
                : v === 'deadly'
                ? 'Deadly'
                : v === 'mildly_venomous'
                ? 'Mild'
                : 'Non-venomous'}
            </button>
          ))}
        </div>
      </div>

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

      {/* Empty filtered state */}
      {species.length > 0 && filtered.length === 0 && (
        <div className="border border-ish-border bg-ish-surface rounded-2xl p-8 text-center">
          <p className="text-sm text-ish-text-secondary">
            No species match your search.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setVenomFilter('all');
            }}
            className="mt-3 text-xs text-ish-accent hover:text-ish-accent-hover underline-offset-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Species grid */}
      {filtered.length > 0 && (
        <>
          <div className="mb-3 text-xs text-ish-text-muted">
            Showing {filtered.length} of {species.length}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <SpeciesCard key={s.id} species={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SpeciesCard({ species: s }: { species: SpeciesRow }) {
  // Left accent stripe colored by venom severity.
  const stripe: Record<string, string> = {
    deadly:          'before:bg-ish-danger',
    mildly_venomous: 'before:bg-ish-warning',
    non_venomous:    'before:bg-ish-success',
  };
  const stripeClass = stripe[s.venomous] ?? 'before:bg-ish-text-muted';

  return (
    <div
      className={[
        'relative border border-ish-border bg-ish-surface rounded-2xl p-5 pl-6 flex flex-col gap-3 hover:border-ish-accent/40 transition-colors',
        'before:content-[""] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:rounded-full',
        stripeClass,
      ].join(' ')}
    >
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
