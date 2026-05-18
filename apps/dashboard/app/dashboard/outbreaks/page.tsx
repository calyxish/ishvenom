'use client';

import { useEffect, useState } from 'react';
import { getOutbreaks, type OutbreakRow } from '@/lib/api';

export default function OutbreaksPage() {
  const [threshold, setThreshold] = useState(1.5);
  const [outbreaks, setOutbreaks] = useState<OutbreakRow[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    getOutbreaks(threshold)
      .then((r) => setOutbreaks(r.outbreaks))
      .catch((e: Error) => setError(e.message ?? 'Failed to load outbreaks'))
      .finally(() => setLoading(false));
  }, [threshold]);

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-bold text-ish-text mb-1">Outbreak alerts</h2>
      <p className="text-sm text-ish-text-secondary mb-8">
        Districts where the last 7 days of encounters exceed{' '}
        <span className="text-ish-accent font-semibold">
          {(threshold * 100).toFixed(0)}%
        </span>{' '}
        of the preceding 4-week baseline, per species.
      </p>

      {/* Threshold slider */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-ish-surface border border-ish-border rounded-2xl">
        <label htmlFor="threshold" className="text-sm text-ish-text-secondary shrink-0">
          Threshold ratio
        </label>
        <input
          id="threshold"
          type="range"
          min="1.0"
          max="3.0"
          step="0.1"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="flex-1 max-w-xs accent-ish-accent"
        />
        <span className="text-sm font-semibold text-ish-text tabular-nums w-12">
          {threshold.toFixed(1)}×
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border border-ish-border bg-ish-surface rounded-2xl p-5 animate-pulse"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-ish-surface-hover rounded" />
                  <div className="h-4 w-32 bg-ish-surface-hover rounded" />
                  <div className="h-3 w-48 bg-ish-surface-hover rounded" />
                </div>
                <div className="h-8 w-16 bg-ish-surface-hover rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && outbreaks.length === 0 && (
        <div className="border border-ish-border bg-ish-surface rounded-2xl p-12 text-center">
          <p className="text-ish-text-secondary text-sm">
            No active outbreaks above the current threshold.
          </p>
          <p className="text-ish-text-muted text-xs mt-1">
            Lower the threshold slider to see more signals.
          </p>
        </div>
      )}

      {/* Alert cards */}
      {!loading && outbreaks.length > 0 && (
        <div className="space-y-3">
          {outbreaks.map((o, i) => (
            <OutbreakCard
              key={`${o.country}-${o.district}-${o.speciesGuess}-${i}`}
              outbreak={o}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OutbreakCard({ outbreak: o }: { outbreak: OutbreakRow }) {
  // Severity by ratio
  const isCritical = o.ratio >= 5 || o.ratio >= 999;
  const isWarning  = !isCritical && o.ratio >= 2;

  const cardStyle = isCritical
    ? 'border-ish-danger bg-ish-danger-surface'
    : isWarning
    ? 'border-ish-warning/60 bg-ish-warning-surface'
    : 'border-ish-border bg-ish-surface';

  const ratioStyle = isCritical
    ? 'text-ish-danger'
    : isWarning
    ? 'text-ish-warning'
    : 'text-ish-accent';

  const ratioLabel = o.ratio >= 999 ? 'NEW' : `${o.ratio.toFixed(1)}×`;

  return (
    <div className={`border rounded-2xl p-5 flex items-start justify-between gap-6 transition-colors ${cardStyle}`}>
      {/* Left — location + species */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ish-text-muted">
            {o.country}
          </span>
          {o.district && (
            <>
              <span className="text-ish-border">·</span>
              <span className="text-xs text-ish-text-secondary">{o.district}</span>
            </>
          )}
        </div>
        <p className="text-sm font-semibold text-ish-text italic truncate">
          {o.speciesGuess ?? 'Unknown species'}
        </p>
        <p className="text-xs text-ish-text-muted mt-1">
          {o.recentCount} encounters in last 7d · baseline avg {o.baselineAvg.toFixed(1)}/day
        </p>
      </div>

      {/* Right — ratio badge */}
      <div className="shrink-0 text-right">
        <div className={`text-2xl font-bold tabular-nums ${ratioStyle}`}>
          {ratioLabel}
        </div>
        <div className="text-[10px] text-ish-text-muted uppercase tracking-wide mt-0.5">
          above baseline
        </div>
      </div>
    </div>
  );
}
