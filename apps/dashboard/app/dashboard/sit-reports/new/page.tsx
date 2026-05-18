'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { SitReportCreate } from '@ishvenom/shared-types';
import { createSitReport } from '../../../../lib/sit-reports';

const COUNTRIES = [
  { code: 'GH', name: 'Ghana' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'SN', name: 'Senegal' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'SD', name: 'Sudan' },
];

const PRESETS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function windowFromDays(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  return { since: since.toISOString(), until: until.toISOString() };
}

export default function NewSitReportPage() {
  const router = useRouter();
  const [country, setCountry]       = useState('GH');
  const [district, setDistrict]     = useState('');
  const [days, setDays]             = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const countryName = COUNTRIES.find((c) => c.code === country)?.name ?? country;
  const districtLabel = district.trim() === '' ? 'national summary' : district.trim();
  const preset = PRESETS.find((p) => p.days === days);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { since, until } = windowFromDays(days);
      const body: SitReportCreate = {
        scope: {
          country,
          district: district.trim() === '' ? null : district.trim(),
          since,
          until,
        },
      };
      const res = await createSitReport(body);
      router.push(`/dashboard/sit-reports/${res.report.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl">
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

      <h1 className="text-2xl md:text-3xl font-bold text-ish-text tracking-tight">
        Generate situation report
      </h1>
      <p className="text-sm text-ish-text-secondary mt-1 mb-6 max-w-lg">
        Reports are synthesized by Gemma 4 from district-level encounter data.
        Warm calls return in about 6 seconds; cold starts can take up to 90.
      </p>

      <div className="space-y-5">
        {/* Country */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-ish-text-muted mb-1.5 font-medium">
            Country
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl bg-ish-surface border border-ish-border px-3.5 py-2.5 text-sm text-ish-text focus:outline-none focus:ring-2 focus:ring-ish-accent focus:border-transparent transition-colors"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* District */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-ish-text-muted mb-1.5 font-medium">
            District{' '}
            <span className="normal-case text-ish-text-muted font-normal">
              (optional)
            </span>
          </label>
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Leave blank for national summary"
            className="w-full rounded-xl bg-ish-surface border border-ish-border px-3.5 py-2.5 text-sm text-ish-text placeholder:text-ish-text-muted focus:outline-none focus:ring-2 focus:ring-ish-accent focus:border-transparent transition-colors"
          />
        </div>

        {/* Window presets */}
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-ish-text-muted mb-1.5 font-medium">
            Time window
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  days === p.days
                    ? 'bg-ish-accent border-ish-accent text-white'
                    : 'bg-ish-surface border-ish-border text-ish-text-secondary hover:border-ish-accent/40 hover:text-ish-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scope preview */}
        <div className="border border-ish-border bg-ish-surface rounded-2xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-ish-text-muted mb-1.5 font-medium">
            Scope preview
          </div>
          <p className="text-sm text-ish-text leading-relaxed">
            Report will cover{' '}
            <span className="font-semibold">{districtLabel}</span> in{' '}
            <span className="font-semibold">{countryName}</span> over the{' '}
            <span className="font-semibold">{preset?.label.toLowerCase() ?? 'selected window'}</span>.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-ish-danger bg-ish-danger-surface text-ish-danger text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full rounded-xl bg-ish-accent hover:bg-ish-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 transition-colors"
        >
          {submitting ? 'Generating…' : 'Generate report'}
        </button>
      </div>
    </div>
  );
}
