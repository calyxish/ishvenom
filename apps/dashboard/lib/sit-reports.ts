/**
 * Dashboard API client for situation reports.
 *
 * Thin typed wrappers over fetch. The existing lib/api.ts base client
 * handles auth cookies / session; this module only adds the sit-report
 * specific calls. Import from here instead of lib/api.ts when you need
 * typed SitReport responses.
 */
import type {
  SitReport,
  SitReportCreate,
  SitReportListResponse,
} from '@ishvenom/shared-types';
import { API_BASE } from './api';

async function jsonFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

export async function listSitReports(params: {
  country?: string;
  district?: string;
  limit?: number;
}): Promise<SitReportListResponse> {
  const qs = new URLSearchParams();
  if (params.country) qs.set('country', params.country);
  if (params.district) qs.set('district', params.district);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return jsonFetch<SitReportListResponse>(`/sit-reports${suffix}`);
}

export async function createSitReport(
  body: SitReportCreate,
): Promise<{ report: SitReport }> {
  return jsonFetch<{ report: SitReport }>('/sit-reports', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getSitReport(id: string): Promise<{ report: SitReport }> {
  return jsonFetch<{ report: SitReport }>(`/sit-reports/${id}`);
}

/**
 * Poll a single report until it reaches a terminal state. Cancellable
 * by aborting the AbortController. Backs off linearly from the initial
 * interval, which keeps the first few polls snappy (good for warm
 * workers) while avoiding thrashing on cold starts.
 */
export async function pollSitReport(
  id: string,
  opts: {
    signal?: AbortSignal;
    initialIntervalMs?: number;
    maxIntervalMs?: number;
    onUpdate?: (r: SitReport) => void;
  } = {},
): Promise<SitReport> {
  let interval = opts.initialIntervalMs ?? 1500;
  const maxInterval = opts.maxIntervalMs ?? 6000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (opts.signal?.aborted) throw new Error('aborted');
    const { report } = await getSitReport(id);
    opts.onUpdate?.(report);
    if (report.status === 'ready' || report.status === 'failed') {
      return report;
    }
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, interval);
      opts.signal?.addEventListener('abort', () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      });
    });
    interval = Math.min(maxInterval, Math.round(interval * 1.35));
  }
}
