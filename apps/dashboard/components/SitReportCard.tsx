'use client';
import Link from 'next/link';
import type { SitReport } from '@ishvenom/shared-types';

// Tailwind classes per status — no hardcoded hex
const STATUS_CLASSES: Record<SitReport['status'], string> = {
  pending:    'text-ish-text-muted   border-ish-text-muted',
  generating: 'text-ish-warning      border-ish-warning',
  ready:      'text-ish-success      border-ish-success',
  failed:     'text-ish-danger       border-ish-danger',
};

export function SitReportCard({ report }: { report: SitReport }) {
  const { scope, status, createdAt, structured, latencyMs } = report;
  const since = new Date(scope.since).toISOString().slice(0, 10);
  const until = new Date(scope.until).toISOString().slice(0, 10);

  return (
    <Link
      href={`/dashboard/sit-reports/${report.id}`}
      className="block rounded-2xl border border-ish-border bg-ish-surface p-5 hover:border-ish-accent/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left — scope + summary */}
        <div>
          <div className="text-xs uppercase tracking-wider text-ish-text-muted">
            {scope.country} · {scope.district ?? 'all districts'}
          </div>
          <div className="text-base font-semibold text-ish-text mt-1">
            {since} → {until}
          </div>
          {structured ? (
            <div className="text-xs text-ish-text-secondary mt-2">
              {structured.totalEncounters} encounters · {structured.totalBites} bites · {structured.hotspots.length} hotspots
            </div>
          ) : (
            <div className="text-xs text-ish-text-muted mt-2">
              Created {new Date(createdAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Right — status badge + latency */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${STATUS_CLASSES[status]}`}
          >
            {status}
          </span>
          {latencyMs ? (
            <span className="text-[10px] text-ish-text-muted">
              {(latencyMs / 1000).toFixed(1)}s
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
