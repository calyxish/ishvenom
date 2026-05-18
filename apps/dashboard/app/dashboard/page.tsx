'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getDistricts,
  getOutbreaks,
  getTimeseries,
  type DistrictStat,
  type TimeseriesPoint,
} from '@/lib/api';
import { TimeSeries } from '@/components/TimeSeries';

interface Summary {
  encounters30d: number;
  bites30d: number;
  outbreakCount: number;
  districtCount: number;
}

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[]>([]);
  const [districts, setDistricts] = useState<DistrictStat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([getTimeseries(30), getDistricts(), getOutbreaks(1.5)])
      .then(([ts, dist, out]) => {
        setSeries(ts.series);
        setDistricts(dist.districts);
        const encounters30d = ts.series.reduce((a, b) => a + b.encounters, 0);
        const bites30d      = ts.series.reduce((a, b) => a + b.bites, 0);
        setSummary({
          encounters30d,
          bites30d,
          outbreakCount: out.outbreaks.length,
          districtCount: dist.districts.length,
        });
        setRefreshedAt(new Date());
      })
      .catch((e: Error) => setError(e.message ?? 'Failed to load data'));
  }, []);

  // Top 5 countries by encounter count (computed from districts payload).
  const topCountries = useMemo(() => {
    const totals = new Map<string, { encounters: number; bites: number }>();
    for (const d of districts) {
      const t = totals.get(d.country) ?? { encounters: 0, bites: 0 };
      t.encounters += d.encounterCount;
      t.bites      += d.biteCount;
      totals.set(d.country, t);
    }
    return Array.from(totals.entries())
      .map(([country, t]) => ({ country, ...t }))
      .sort((a, b) => b.encounters - a.encounters)
      .slice(0, 5);
  }, [districts]);

  // Top 3 species (aggregated from district topSpecies).
  const topSpecies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of districts) {
      if (!d.topSpecies) continue;
      counts.set(d.topSpecies, (counts.get(d.topSpecies) ?? 0) + d.encounterCount);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [districts]);

  // Sparkline data (last 14 points of encounter counts, normalized 0-1).
  const sparkEncounters = useMemo(
    () => normaliseSpark(series.slice(-14).map((p) => p.encounters)),
    [series],
  );
  const sparkBites = useMemo(
    () => normaliseSpark(series.slice(-14).map((p) => p.bites)),
    [series],
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl">
      {/* ── Page header ──────────────────────────────────────────── */}
      <header className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-ish-text tracking-tight">
          Overview
        </h2>
        <p className="text-sm text-ish-text-secondary mt-1">
          Last 30 days · All countries
          {refreshedAt && (
            <span className="text-ish-text-muted">
              {' '}· refreshed {timeAgo(refreshedAt)}
            </span>
          )}
        </p>
      </header>

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {summary ? (
          <>
            <StatCard
              label="Encounters (30d)"
              value={summary.encounters30d}
              spark={sparkEncounters}
              sparkColor="var(--ish-accent)"
            />
            <StatCard
              label="Bites (30d)"
              value={summary.bites30d}
              variant="danger"
              spark={sparkBites}
              sparkColor="var(--ish-danger)"
            />
            <StatCard
              label="Active outbreaks"
              value={summary.outbreakCount}
              variant={summary.outbreakCount > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Reporting districts"
              value={summary.districtCount}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border border-ish-border bg-ish-surface rounded-2xl p-5 animate-pulse"
            >
              <div className="h-3 w-24 bg-ish-surface-hover rounded mb-3" />
              <div className="h-8 w-16 bg-ish-surface-hover rounded" />
            </div>
          ))
        )}
      </div>

      {/* ── Daily activity chart ─────────────────────────────────── */}
      <section className="border border-ish-border rounded-2xl p-4 md:p-5 bg-ish-surface mb-6">
        <h3 className="text-sm font-medium text-ish-text-secondary mb-4">
          Daily activity (30d)
        </h3>
        <TimeSeries data={series} />
      </section>

      {/* ── Two-column: top countries + top species ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="border border-ish-border rounded-2xl p-4 md:p-5 bg-ish-surface">
          <h3 className="text-sm font-medium text-ish-text-secondary mb-4">
            Top countries (30d)
          </h3>
          {topCountries.length === 0 ? (
            <p className="text-sm text-ish-text-muted">No data yet.</p>
          ) : (
            <ul className="space-y-3">
              {topCountries.map((c) => {
                const max = topCountries[0]!.encounters;
                const pct = (c.encounters / max) * 100;
                return (
                  <li key={c.country}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium text-ish-text">
                        {c.country}
                      </span>
                      <span className="text-xs text-ish-text-muted tabular-nums">
                        {c.encounters} enc · {c.bites} bites
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ish-surface-hover overflow-hidden">
                      <div
                        className="h-full bg-ish-accent rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="border border-ish-border rounded-2xl p-4 md:p-5 bg-ish-surface">
          <h3 className="text-sm font-medium text-ish-text-secondary mb-4">
            Top species (30d)
          </h3>
          {topSpecies.length === 0 ? (
            <p className="text-sm text-ish-text-muted">No species data yet.</p>
          ) : (
            <ul className="space-y-3">
              {topSpecies.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center justify-between py-1 border-b border-ish-border last:border-0"
                >
                  <span className="text-sm italic text-ish-text">{s.name}</span>
                  <span className="text-xs text-ish-text-muted tabular-nums">
                    {s.count} reports
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function normaliseSpark(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values, 1);
  return values.map((v) => v / max);
}

function StatCard({
  label,
  value,
  variant = 'default',
  spark,
  sparkColor,
}: {
  label: string;
  value: number;
  variant?: 'default' | 'danger' | 'warning';
  spark?: number[];
  sparkColor?: string;
}) {
  const styles = {
    default: 'border-ish-border bg-ish-surface',
    danger:  'border-ish-danger/40 bg-ish-danger-surface',
    warning: 'border-ish-warning/40 bg-ish-warning-surface',
  };
  const valueStyles = {
    default: 'text-ish-text',
    danger:  'text-ish-danger',
    warning: 'text-ish-warning',
  };

  return (
    <div className={`border rounded-2xl p-4 md:p-5 ${styles[variant]}`}>
      <div className="text-[11px] text-ish-text-muted mb-2 uppercase tracking-wide font-medium">
        {label}
      </div>
      <div className={`text-2xl md:text-3xl font-semibold tabular-nums ${valueStyles[variant]}`}>
        {value.toLocaleString()}
      </div>
      {spark && spark.length > 0 && (
        <div className="mt-3 flex items-end gap-0.5 h-6">
          {spark.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(8, v * 100)}%`,
                backgroundColor: sparkColor ?? 'var(--ish-accent)',
                opacity: 0.6 + 0.4 * v,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
