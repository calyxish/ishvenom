'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SitReport } from '@ishvenom/shared-types';
import { createSitReport, getSitReport, pollSitReport } from '../../../../lib/sit-reports';

export default function SitReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [report, setReport] = useState<SitReport | null>(null);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const initial = await getSitReport(id);
        setReport(initial.report);
        if (
          initial.report.status === 'pending' ||
          initial.report.status === 'generating'
        ) {
          const final = await pollSitReport(id, {
            signal: controller.signal,
            onUpdate: (r) => setReport(r),
          });
          setReport(final);
        }
      } catch (e) {
        if ((e as Error).message !== 'aborted') {
          setError((e as Error).message);
        }
      }
    })();
    return () => controller.abort();
  }, [id]);

  if (error)   return <ErrorView message={error} />;
  if (!report) return <Skeleton />;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
      <BackLink />
      <ReportHeader report={report} />
      {report.status === 'failed'    ? <FailedCard report={report} />  :
       report.status === 'ready'     ? <ReadyCard report={report} />    :
                                       <GeneratingCard />}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/sit-reports"
      className="inline-flex items-center gap-1.5 text-xs text-ish-text-secondary hover:text-ish-text transition-colors mb-4"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
      All reports
    </Link>
  );
}

function ReportHeader({ report }: { report: SitReport }) {
  const { scope } = report;
  const since = new Date(scope.since).toISOString().slice(0, 10);
  const until = new Date(scope.until).toISOString().slice(0, 10);
  return (
    <header className="mb-6 border border-ish-border bg-ish-surface rounded-2xl p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-ish-text-muted font-medium">
            {scope.country} · {scope.district ?? 'all districts'}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-ish-text mt-1 tabular-nums">
            {since} → {until}
          </h1>
        </div>
        <StatusPill status={report.status} />
      </div>
      {report.latencyMs ? (
        <div className="text-xs text-ish-text-muted mt-3 font-mono break-words">
          {report.model} · {(report.latencyMs / 1000).toFixed(1)}s · {report.promptTokens}→{report.completionTokens} tokens
        </div>
      ) : null}
    </header>
  );
}

function StatusPill({ status }: { status: SitReport['status'] }) {
  const styles: Record<string, string> = {
    pending:    'bg-ish-warning-surface text-ish-warning border-ish-warning/50',
    generating: 'bg-ish-warning-surface text-ish-warning border-ish-warning/50',
    ready:      'bg-ish-success-surface text-ish-success border-ish-success/50',
    failed:     'bg-ish-danger-surface text-ish-danger border-ish-danger/50',
  };
  return (
    <span
      className={`shrink-0 inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold border uppercase tracking-wide ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

function GeneratingCard() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-ish-warning/60 bg-ish-warning-surface p-5 md:p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-ish-warning animate-pulse" />
        <span className="text-ish-warning font-semibold">Generating</span>
        <span className="text-xs text-ish-text-muted tabular-nums ml-auto">
          {seconds}s elapsed
        </span>
      </div>
      <p className="text-ish-text-secondary text-sm leading-relaxed">
        Gemma 4 is synthesizing the situation report from district-level encounter data.
        Cold-start workers can take up to 90 seconds; warm calls return in about 6.
      </p>
      {/* Indeterminate progress bar */}
      <div className="mt-4 h-1 w-full rounded-full bg-ish-surface-hover overflow-hidden">
        <div className="h-full w-1/3 bg-ish-warning rounded-full animate-[slide_2s_ease-in-out_infinite]" />
      </div>
      <style jsx>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}

function FailedCard({ report }: { report: SitReport }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  async function onRetry() {
    setRetrying(true);
    try {
      const res = await createSitReport({ scope: report.scope });
      router.push(`/dashboard/sit-reports/${res.report.id}`);
    } catch {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ish-danger bg-ish-danger-surface p-5 md:p-6">
      <h2 className="text-ish-danger font-semibold mb-2">Generation failed</h2>
      <pre className="text-xs text-ish-text-secondary whitespace-pre-wrap font-mono break-words [&]:overflow-x-auto">
        {report.error ?? 'Unknown error'}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ish-danger hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-opacity"
      >
        {retrying ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  );
}

function ReadyCard({ report }: { report: SitReport }) {
  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-ish-border bg-ish-surface p-5 md:p-6 text-ish-text leading-relaxed text-sm whitespace-pre-wrap break-words [&_pre]:overflow-x-auto">
        {report.markdown ?? ''}
      </article>

      {report.structured ? (
        <div className="rounded-2xl border border-ish-border bg-ish-surface p-5 md:p-6">
          <h3 className="text-ish-text-muted uppercase text-xs font-bold tracking-wider mb-4">
            Recommendations
          </h3>
          <ol className="space-y-3">
            {report.structured.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 h-6 w-6 rounded-full bg-ish-accent/15 text-ish-accent text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-ish-text-secondary leading-relaxed">{rec}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl animate-pulse">
      <div className="h-3 w-32 bg-ish-surface rounded mb-3" />
      <div className="h-6 w-80 max-w-full bg-ish-surface rounded mb-8" />
      <div className="h-64 bg-ish-surface border border-ish-border rounded-2xl" />
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
      <div className="rounded-2xl border border-ish-danger bg-ish-danger-surface p-6 text-ish-danger text-sm">
        Failed to load report: {message}
      </div>
    </div>
  );
}
