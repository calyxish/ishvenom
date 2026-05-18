/**
 * seedData — populates SQLite with bundled static data on first launch.
 *
 * Seeds: species catalog (20 priority species) + antivenom centers (24 hospitals).
 *
 * Uses kv version keys so it only re-seeds when bundled data changes.
 * Safe to call on every app start — cheap no-op if versions match.
 */
import { upsertSpecies, upsertAntivenomCenters, kvGet, kvSet, type StoredSpecies, type StoredAntivenomCenter } from './db';

const SPECIES_SEED_VERSION = '2026-04-v1';
const ANTIVENOM_SEED_VERSION = '2024-11-v1';

// ─── Species ──────────────────────────────────────────────────────────────────

interface RawSpecies {
  id: string;
  scientific_name: string;
  common_names: Record<string, string>;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
  antivenom?: string;
}

interface RawSpeciesFile {
  species: RawSpecies[];
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RAW_SPECIES = (require('../../assets/data/species.json') as RawSpeciesFile).species;

function toStoredSpecies(r: RawSpecies): StoredSpecies {
  return {
    id: r.id,
    scientificName: r.scientific_name,
    commonNames: r.common_names,
    venomous: r.venomous,
    antivenomName: r.antivenom ?? null,
  };
}

export async function seedSpecies(): Promise<void> {
  const stored = await kvGet('species_seed_version');
  if (stored === SPECIES_SEED_VERSION) return;
  await upsertSpecies(RAW_SPECIES.map(toStoredSpecies));
  await kvSet('species_seed_version', SPECIES_SEED_VERSION);
}

// ─── Antivenom centers ────────────────────────────────────────────────────────

interface RawCenter {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  antivenoms_stocked: string[];
  phone: string;
  last_verified: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RAW_CENTERS: RawCenter[] = require('../../assets/data/antivenom-centers.json') as RawCenter[];

function toStoredCenter(r: RawCenter): StoredAntivenomCenter {
  return {
    id: r.id,
    name: r.name,
    country: r.country,
    latitude: r.latitude,
    longitude: r.longitude,
    antivenomsStocked: r.antivenoms_stocked,
    phone: r.phone ?? null,
    lastVerified: r.last_verified ?? null,
  };
}

export async function seedAntivenomCenters(): Promise<void> {
  const stored = await kvGet('antivenom_seed_version');
  if (stored === ANTIVENOM_SEED_VERSION) return;
  await upsertAntivenomCenters(RAW_CENTERS.map(toStoredCenter));
  await kvSet('antivenom_seed_version', ANTIVENOM_SEED_VERSION);
}
