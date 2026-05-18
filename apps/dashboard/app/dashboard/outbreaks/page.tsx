'use client';

import { useEffect, useMemo, useState } from 'react';
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

  // Group outbreaks by severity for visual hierarchy.
  const grouped = useMemo(() => {
    const critical: OutbreakRow[] = [];
    const warning:  OutbreakRow[] = [];
    const watch:    OutbreakRow[] = [];
    for (const o of outbreaks) {
      if (o.ratio >= 3 || o.ratio >= 999) critical.push(o);
      else if (o.ratio >= 1.5)           warning.push(o);
      else                                watch.push(o);
    }
    return { critical, warning, watch };
  }, [outbreaks]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl">
      {/* ── Header + threshold filter ────────────────────────────── */}
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-ish-text tracking-tight">
            Outbreak alerts
          </h2>
          <p className="text-sm text-ish-text-secondary mt-1 max-w-xl">
            Districts where 7-day encounter counts exceed{' '}
            <span className="text-ish-accent font-semibold">
              {threshold.toFixed(1)}×
            </span>{' '}
            the preceding 4-week baseline, per species.
          </p>
        </div>

        {/* Compact threshold slider in the header */}
        <div className="flex items-center gap-3 bg-ish-surface border border-ish-border rounded-2xl px-3 py-2 md:min-w-[260px]">
          <label htmlFor="threshold" className="text-[11px] text-ish-text-muted uppercase tracking-wide shrink-0">
            Threshold
          </label>
          <input
            id="threshold"
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="flex-1 accent-ish-accent"
          />
          <span className="text-sm font-semibold text-ish-text tabular-nums w-10 text-right">
            {threshold.toFixed(1)}×
          </span>
        </div>
      </header>

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

      {/* Empty state — positive message in success surface */}
      {!loading && !error && outbreaks.length === 0 && (
        <div className="border border-ish-success/40 bg-ish-success-surface rounded-2xl p-8 md:p-10 text-center">
          <svg
            className="mx-auto mb-3 text-ish-success"
            width="40" height="40" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-ish-success font-semibold">
            No outbreaks above threshold
          </p>
          <p className="text-ish-text-secondary text-xs mt-1.5">
            Surveillance is normal. Lower the threshold slider to see weaker signals.
          </p>
        </div>
      )}

      {/* Grouped sections */}
      {!loading && outbreaks.length > 0 && (
        <div className="space-y-6">
          {grouped.critical.length > 0 && (
            <Section
              label="Critical"
              hint="ratio ≥ 3.0× — immediate attention recommended"
              variant="danger"
              count={grouped.critical.length}
              items={grouped.critical}
            />
          )}
          {grouped.warning.length > 0 && (
            <Section
              label="Warning"
              hint="ratio 1.5–3.0× — investigate"
              variant="warning"
              count={grouped.warning.length}
              items={grouped.warning}
            />
          )}
          {grouped.watch.length > 0 && (
            <Section
              label="Watch"
              hint="just above threshold"
              variant="default"
              count={grouped.watch.length}
              items={grouped.watch}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  hint,
  variant,
  count,
  items,
}: {
  label: string;
  hint: string;
  variant: 'danger' | 'warning' | 'default';
  count: number;
  items: OutbreakRow[];
}) {
  const labelColor = {
    danger:  'text-ish-danger',
    warning: 'text-ish-warning',
    default: 'text-ish-text-secondary',
  }[variant];

  return (
    <section>
      <div className="flex items-baseline gap-2 mb-3">
        <h3 className={`text-sm font-bold uppercase tracking-wider ${labelColor}`}>
          {label}
        </h3>
        <span className="text-xs text-ish-text-muted tabular-nums">
          {count}
        </span>
        <span className="text-xs text-ish-text-muted ml-1 hidden sm:inline">
          · {hint}
        </span>
      </div>
      <div className="space-y-3">
        {items.map((o, i) => (
          <OutbreakCard
            key={`${o.country}-${o.district}-${o.speciesGuess}-${i}`}
            outbreak={o}
          />
        ))}
      </div>
    </section>
  );
}

function OutbreakCard({ outbreak: o }: { outbreak: OutbreakRow }) {
  const isCritical = o.ratio >= 3 || o.ratio >= 999;
  const isWarning  = !isCritical && o.ratio >= 1.5;

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
    <div
      className={`border rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6 transition-colors ${cardStyle}`}
    >
      {/* Left — location + species */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-ish-text-muted">
            {o.country}
          </span>
          {o.district && (
            <>
              <span className="text-ish-border">·</span>
              <span className="text-xs text-ish-text-secondary truncate">
                {o.district}
              </span>
            </>
          )}
        </div>
        <p className="text-sm font-semibold text-ish-text italic break-words">
          {o.speciesGuess ?? 'Unknown species'}
        </p>
        <p className="text-xs text-ish-text-muted mt-1">
          {o.recentCount} encounters in last 7d · baseline {o.baselineAvg.toFixed(1)}/day
        </p>
      </div>

      {/* Right — ratio badge */}
      <div className="shrink-0 flex md:flex-col items-baseline md:items-end justify-between md:justify-start gap-1">
        <div className={`text-2xl font-bold tabular-nums ${ratioStyle}`}>
          {ratioLabel}
        </div>
        <div className="text-[10px] text-ish-text-muted uppercase tracking-wide">
          above baseline
        </div>
      </div>
    </div>
  );
}
