/**
 * Geographic helpers. Pure, testable, no RN imports — so these can run
 * under plain Jest + ts-jest without needing the Expo mock environment.
 *
 * Two jobs:
 *   1. Haversine distance between two (lat, lng) points, in meters.
 *   2. Pick the nearest antivenom center from a cached list.
 *
 * Privacy note: the `truncateForSync` helper mirrors the server-side
 * truncation in services/api/src/lib/geo.ts, so the app can show users
 * exactly what will leave their device.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface AntivenomCenterLite {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestCenter<T extends AntivenomCenterLite>(
  position: LatLng,
  centers: readonly T[],
): (T & { distanceMeters: number }) | null {
  if (centers.length === 0) return null;
  let best: (T & { distanceMeters: number }) | null = null;
  for (const c of centers) {
    const distanceMeters = haversineMeters(position, {
      latitude: c.latitude,
      longitude: c.longitude,
    });
    if (!best || distanceMeters < best.distanceMeters) {
      best = { ...c, distanceMeters };
    }
  }
  return best;
}

export function topNearest<T extends AntivenomCenterLite>(
  position: LatLng,
  centers: readonly T[],
  n: number,
): Array<T & { distanceMeters: number }> {
  return centers
    .map((c) => ({
      ...c,
      distanceMeters: haversineMeters(position, {
        latitude: c.latitude,
        longitude: c.longitude,
      }),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, Math.max(0, n));
}

/**
 * Mirror of server-side truncateCoordinate from services/api/src/lib/geo.ts.
 * Rounds to ~1.1 km precision so two users in the same village produce
 * the same coordinate and cannot be distinguished from each other.
 */
export function truncateForSync(p: LatLng): LatLng {
  return {
    latitude: Math.round(p.latitude * 100) / 100,
    longitude: Math.round(p.longitude * 100) / 100,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  if (meters < 10_000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}
