'use client';
import { use, useEffect, useState } from 'react';
import type { SitReport } from '@ishvenom/shared-types';
import { getSitReport, pollSitReport } from '../../../../lib/sit-reports';

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
    <div className="p-8 max-w-3xl">
      <ReportHeader report={report} />
      {report.status === 'failed'    ? <FailedCard error={report.error} />  :
       report.status === 'ready'     ? <ReadyCard report={report} />        :
                                       <GeneratingCard />}
    </div>
  );
}

function ReportHeader({ report }: { report: SitReport }) {
  const { scope } = report;
  const since = new Date(scope.since).toISOString().slice(0, 10);
  const until = new Date(scope.until).toISOString().slice(0, 10);
  return (
    <div className="mb-8">
      <div className="text-xs uppercase tracking-wider text-ish-text-muted">
        {scope.country} · {scope.district ?? 'all districts'}
      </div>
      <h1 className="text-2xl font-bold text-ish-text mt-1">
        {since} → {until}
      </h1>
      {report.latencyMs ? (
        <div className="text-xs text-ish-text-muted mt-2 font-mono">
          {report.model} · {(report.latencyMs / 1000).toFixed(1)}s · {report.promptTokens}→{report.completionTokens} tokens
        </div>
      ) : null}
    </div>
  );
}

function GeneratingCard() {
  return (
    <div className="rounded-2xl border border-ish-warning bg-ish-warning-surface p-6">
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 rounded-full bg-ish-warning animate-pulse" />
        <span className="text-ish-warning font-semibold">Generating…</span>
      </div>
      <p className="text-ish-text-secondary text-sm mt-2">
        Gemma 4 31B is synthesizing the report. Cold-start workers can take
        up to 90 seconds.
      </p>
    </div>
  );
}

function FailedCard({ error }: { error: string | null }) {
  return (
    <div className="rounded-2xl border border-ish-danger bg-ish-danger-surface p-6">
      <h2 className="text-ish-danger font-semibold mb-2">Generation failed</h2>
      <pre className="text-xs text-ish-text-secondary whitespace-pre-wrap">
        {error ?? 'Unknown error'}
      </pre>
    </div>
  );
}

function ReadyCard({ report }: { report: SitReport }) {
  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-ish-border bg-ish-surface p-6 text-ish-text-secondary whitespace-pre-wrap leading-relaxed text-sm">
        {report.markdown ?? ''}
      </article>

      {report.structured ? (
        <div className="rounded-2xl border border-ish-border bg-ish-surface p-6">
          <h3 className="text-ish-text-muted uppercase text-xs font-bold tracking-wider mb-4">
            Recommendations
          </h3>
          <ul className="space-y-3">
            {report.structured.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-ish-accent font-bold shrink-0">{i + 1}.</span>
                <span className="text-ish-text-secondary">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="p-8 max-w-3xl animate-pulse">
      <div className="h-3 w-32 bg-ish-surface rounded mb-3" />
      <div className="h-6 w-80 bg-ish-surface rounded mb-8" />
      <div className="h-64 bg-ish-surface border border-ish-border rounded-2xl" />
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="p-8 max-w-3xl">
      <div className="rounded-2xl border border-ish-danger bg-ish-danger-surface p-6 text-ish-danger text-sm">
        Failed to load report: {message}
      </div>
    </div>
  );
}
