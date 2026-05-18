'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-ish-text mb-1">
        Generate situation report
      </h1>
      <p className="text-sm text-ish-text-secondary mb-8">
        Reports are synthesized by Gemma 4 31B on a serverless GPU. Cold starts
        take up to 90 seconds; warm calls return in about 6 seconds.
      </p>

      <div className="space-y-5">
        {/* Country */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-ish-text-muted mb-2 font-medium">
            Country
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full rounded-xl bg-ish-surface border border-ish-border px-4 py-3 text-ish-text focus:outline-none focus:border-ish-accent transition-colors"
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
          <label className="block text-xs uppercase tracking-wider text-ish-text-muted mb-2 font-medium">
            District <span className="normal-case text-ish-text-muted font-normal">(optional)</span>
          </label>
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Leave blank for national summary"
            className="w-full rounded-xl bg-ish-surface border border-ish-border px-4 py-3 text-ish-text placeholder-ish-text-muted focus:outline-none focus:border-ish-accent transition-colors"
          />
        </div>

        {/* Window presets */}
        <div>
          <label className="block text-xs uppercase tracking-wider text-ish-text-muted mb-2 font-medium">
            Window
          </label>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                className={`flex-1 px-3 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                  days === p.days
                    ? 'bg-ish-accent border-ish-accent text-ish-text'
                    : 'bg-ish-surface border-ish-border text-ish-text-secondary hover:border-ish-accent/40 hover:text-ish-text'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
          className="w-full rounded-xl bg-ish-accent hover:bg-ish-accent-hover disabled:opacity-40 text-ish-text font-semibold py-4 transition-colors"
        >
          {submitting ? 'Generating…' : 'Generate report'}
        </button>
      </div>
    </div>
  );
}
