'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SitReport } from '@ishvenom/shared-types';
import { listSitReports } from '../../../lib/sit-reports';
import { SitReportCard } from '../../../components/SitReportCard';

export default function SitReportsPage() {
  const [reports, setReports] = useState<SitReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

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

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ish-text">Situation reports</h1>
          <p className="text-sm text-ish-text-secondary mt-1">
            AI-synthesized district-level summaries from encounter data.
          </p>
        </div>
        <Link
          href="/dashboard/sit-reports/new"
          className="px-4 py-2 rounded-xl bg-ish-accent hover:bg-ish-accent-hover text-ish-text text-sm font-semibold transition-colors"
        >
          + Generate
        </Link>
      </div>

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

      {/* Empty state */}
      {!loading && !error && reports.length === 0 && (
        <div className="border border-ish-border bg-ish-surface rounded-2xl p-12 text-center">
          <p className="text-ish-text-secondary text-sm">No situation reports yet.</p>
          <p className="text-ish-text-muted text-xs mt-1">
            Click <span className="text-ish-accent font-medium">+ Generate</span> to create your first one.
          </p>
        </div>
      )}

      {/* Report list */}
      {!loading && reports.length > 0 && (
        <div className="grid gap-3">
          {reports.map((r) => (
            <SitReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
