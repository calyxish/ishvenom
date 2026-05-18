'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SitReport } from '@ishvenom/shared-types';
import { listSitReports } from '../../../lib/sit-reports';
import { SitReportCard } from '../../../components/SitReportCard';

type StatusFilter = 'all' | 'generating' | 'ready' | 'failed';

export default function SitReportsPage() {
  const [reports, setReports] = useState<SitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<StatusFilter>('all');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await listSitReports({ limit: 50 });
        if (!cancelled) setReports(res.reports);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return reports;
    if (filter === 'generating') {
      return reports.filter((r) => r.status === 'pending' || r.status === 'generating');
    }
    return reports.filter((r) => r.status === filter);
  }, [reports, filter]);

  // Status counts for filter chips.
  const counts = useMemo(() => ({
    all:        reports.length,
    generating: reports.filter((r) => r.status === 'pending' || r.status === 'generating').length,
    ready:      reports.filter((r) => r.status === 'ready').length,
    failed:     reports.filter((r) => r.status === 'failed').length,
  }), [reports]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-ish-text tracking-tight">
            Situation reports
          </h1>
          <p className="text-sm text-ish-text-secondary mt-1">
            AI-synthesized district-level summaries from encounter data
          </p>
        </div>
        <Link
          href="/dashboard/sit-reports/new"
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-ish-accent hover:bg-ish-accent-hover text-white text-sm font-semibold transition-colors text-center"
        >
          + Generate report
        </Link>
      </header>

      {/* ── Status filter chips ─────────────────────────────────── */}
      {reports.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5 bg-ish-surface border border-ish-border rounded-xl p-1 w-fit">
          {(['all', 'generating', 'ready', 'failed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                filter === s
                  ? 'bg-ish-accent text-white'
                  : 'text-ish-text-secondary hover:text-ish-text hover:bg-ish-surface-hover',
              ].join(' ')}
            >
              {s} <span className="opacity-70 tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border border-ish-border bg-ish-surface rounded-2xl p-5 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 bg-ish-surface-hover rounded" />
                  <div className="h-4 w-48 bg-ish-surface-hover rounded" />
                  <div className="h-3 w-32 bg-ish-surface-hover rounded" />
                </div>
                <div className="h-6 w-20 bg-ish-surface-hover rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          Failed to load reports: {error}
        </div>
      )}

      {/* Empty state — no reports yet at all */}
      {!loading && !error && reports.length === 0 && (
        <div className="border border-ish-border bg-ish-surface rounded-2xl p-8 md:p-12 text-center">
          <p className="text-ish-text font-semibold">No situation reports yet</p>
          <p className="text-ish-text-secondary text-sm mt-1.5 max-w-md mx-auto">
            Generate your first AI-synthesized report from the last 7, 30, or 90 days of encounter data.
          </p>
          <Link
            href="/dashboard/sit-reports/new"
            className="mt-5 inline-block px-4 py-2.5 rounded-xl bg-ish-accent hover:bg-ish-accent-hover text-white text-sm font-semibold transition-colors"
          >
            + Generate your first report
          </Link>
        </div>
      )}

      {/* Empty filtered state */}
      {!loading && !error && reports.length > 0 && filtered.length === 0 && (
        <div className="border border-ish-border bg-ish-surface rounded-2xl p-8 text-center">
          <p className="text-sm text-ish-text-secondary">
            No reports with status “{filter}”.
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="mt-3 text-xs text-ish-accent hover:text-ish-accent-hover underline-offset-2 hover:underline"
          >
            Show all
          </button>
        </div>
      )}

      {/* Report list */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <SitReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
