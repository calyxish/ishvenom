'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { getDistricts, type DistrictStat } from '@/lib/api';

// MapLibre touches window — client-only load required.
const IncidentMap = dynamic(
  () => import('@/components/IncidentMap').then((m) => m.IncidentMap),
  { ssr: false, loading: () => <MapLoading /> },
);

export default function MapPage() {
  const [districts, setDistricts] = useState<DistrictStat[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDistricts()
      .then((d) => setDistricts(d.districts))
      .catch((e: Error) => setError(e.message ?? 'Failed to load districts'));
  }, []);

  return (
    <div className="p-8 max-w-6xl">
      <h2 className="text-2xl font-bold text-ish-text mb-1">Incident map</h2>
      <p className="text-sm text-ish-text-secondary mb-6">
        Encounters aggregated by country centroid. Circle size = count; colour = bite ratio (blue → amber → red).
      </p>

      {error && (
        <div className="mb-4 text-sm text-ish-danger bg-ish-danger-surface border border-ish-danger rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div className="border border-ish-border rounded-2xl overflow-hidden h-[600px]">
        <IncidentMap districts={districts} />
      </div>

      <div className="mt-3 text-xs text-ish-text-muted">
        {districts.length} {districts.length === 1 ? 'district' : 'districts'} reporting
      </div>
    </div>
  );
}

function MapLoading() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-ish-surface text-ish-text-muted text-sm">
      Loading map…
    </div>
  );
}
