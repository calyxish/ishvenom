/**
 * emergency.ts — pure logic for the emergency response section.
 *
 * No React, no UI imports — fully testable under plain Jest.
 * All functions are synchronous except resolveNearestClinic which
 * queries SQLite and sorts by distance.
 *
 * Three responsibilities:
 *   1. calculateUrgency  — maps venomLevel to a display config (label, colorKey)
 *   2. buildEmergencySms — builds the pre-filled SMS body
 *   3. resolveNearestClinic — picks the best clinic for this encounter
 */
import { getAllAntivenomCenters, type StoredAntivenomCenter, type QueuedEncounter } from './db';
import { nearestCenter, formatDistance } from './geo';

// ─── Urgency ─────────────────────────────────────────────────────────────────

export type VenomLevel = 'non_venomous' | 'mildly_venomous' | 'deadly' | null;

/**
 * Semantic keys into the design-system color tokens.
 * The component maps these to actual `colors.*` values via useTheme().
 */
export type UrgencyColorKey = 'danger' | 'warning' | 'success';

export interface UrgencyConfig {
  label: string;
  colorKey: UrgencyColorKey;
}

const URGENCY_MAP: Record<NonNullable<VenomLevel> | '__null__', UrgencyConfig> = {
  deadly: {
    label: 'SEEK MEDICAL HELP IMMEDIATELY',
    colorKey: 'danger',
  },
  mildly_venomous: {
    label: 'MONITOR — SEEK HELP IF SYMPTOMS DEVELOP',
    colorKey: 'warning',
  },
  non_venomous: {
    label: 'LOW RISK — MONITOR THE PATIENT',
    colorKey: 'success',
  },
  __null__: {
    label: 'SEEK MEDICAL ADVICE',
    colorKey: 'danger',
  },
};

export function calculateUrgency(venomLevel: VenomLevel): UrgencyConfig {
  return URGENCY_MAP[venomLevel ?? '__null__'];
}

// ─── SMS ─────────────────────────────────────────────────────────────────────

/**
 * Builds the pre-filled SMS body per the design spec.
 * Caller must pass this to SMS.sendSMSAsync — this module does not import expo-sms.
 */
export function buildEmergencySms(encounter: QueuedEncounter): string {
  const species = encounter.speciesGuess ?? 'unknown';
  const lat = encounter.latitude.toFixed(5);
  const lng = encounter.longitude.toFixed(5);
  const time = new Date(encounter.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    `SNAKEBITE EMERGENCY. Species: ${species}. ` +
    `Location: ${lat}, ${lng}. ` +
    `Time bitten: ${time}. Please send help.`
  );
}

// ─── Nearest clinic ──────────────────────────────────────────────────────────

export interface ResolvedClinic extends StoredAntivenomCenter {
  distanceMeters: number | null;
  formattedDistance: string | null;
}

/**
 * Loads all clinics from SQLite and picks the best one for this encounter:
 *   - If the encounter has a real GPS fix: sort by haversine distance, return nearest.
 *   - If GPS is (0, 0) / unavailable: return first clinic matching the country,
 *     or any clinic if none match, or null if the table is empty.
 *
 * Distance fields are null when GPS was unavailable (no misleading "0 m" shown).
 */
export async function resolveNearestClinic(
  encounter: QueuedEncounter,
): Promise<ResolvedClinic | null> {
  const all = await getAllAntivenomCenters();
  if (all.length === 0) return null;

  const hasLocation = encounter.latitude !== 0 || encounter.longitude !== 0;

  if (hasLocation) {
    const result = nearestCenter(
      { latitude: encounter.latitude, longitude: encounter.longitude },
      all,
    );
    if (!result) return null;
    return {
      ...result,
      formattedDistance: formatDistance(result.distanceMeters),
    };
  }

  // No GPS — prefer a clinic in the user's country, fall back to first in list
  const fallback =
    all.find((c) => c.country === encounter.country) ?? all[0] ?? null;
  if (!fallback) return null;
  return { ...fallback, distanceMeters: null, formattedDistance: null };
}

// ─── Elapsed time formatting ─────────────────────────────────────────────────

/**
 * Format an elapsed-seconds counter as HH:MM:SS (e.g. "01:23:45").
 * Used by the live bite timer on the result screen.
 */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    ':' +
    String(sec).padStart(2, '0')
  );
}
