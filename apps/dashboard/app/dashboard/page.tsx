'use client';

import { useEffect, useState } from 'react';
import { getDistricts, getOutbreaks, getTimeseries } from '@/lib/api';
import { TimeSeries } from '@/components/TimeSeries';

interface Summary {
  encounters30d: number;
  bites30d: number;
  outbreakCount: number;
  districtCount: number;
}

export default function OverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<
    { day: string; encounters: number; bites: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTimeseries(30), getDistricts(), getOutbreaks(1.5)])
      .then(([ts, dist, out]) => {
        setSeries(ts.series);
        const encounters30d = ts.series.reduce((a, b) => a + b.encounters, 0);
        const bites30d = ts.series.reduce((a, b) => a + b.bites, 0);
        setSummary({
          encounters30d,
          bites30d,
          outbreakCount: out.outbreaks.length,
          districtCount: dist.districts.length,
        });
      })
      .catch((e: Error) => setError(e.message ?? 'Failed to load data'));
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-bold text-ish-text mb-1">Overview</h2>
      <p className="text-sm text-ish-text-secondary mb-8">
        Last 30 days · All countries
      </p>

      {/* Error banner */}
      {error && (
        <div className="mb-6 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Stat cards — skeleton while loading */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {summary ? (
          <>
            <StatCard label="Encounters (30d)" value={summary.encounters30d} />
            <StatCard label="Bites (30d)" value={summary.bites30d} variant="danger" />
            <StatCard
              label="Active outbreaks"
              value={summary.outbreakCount}
              variant={summary.outbreakCount > 0 ? 'warning' : 'default'}
            />
            <StatCard label="Reporting districts" value={summary.districtCount} />
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

      {/* Chart */}
      <section className="border border-ish-border rounded-2xl p-5 bg-ish-surface">
        <h3 className="text-sm font-medium text-ish-text-secondary mb-4">
          Daily activity (30d)
        </h3>
        <TimeSeries data={series} />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'danger' | 'warning';
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
    <div className={`border rounded-2xl p-5 ${styles[variant]}`}>
      <div className="text-xs text-ish-text-muted mb-2 uppercase tracking-wide font-medium">
        {label}
      </div>
      <div className={`text-3xl font-semibold tabular-nums ${valueStyles[variant]}`}>
        {value}
      </div>
    </div>
  );
}
