/**
 * Local SQLite database for IshVenom mobile.
 *
 * Four tables:
 *   species             — cached catalog from /api/v1/species (seeded once)
 *   antivenom_centers   — cached list for offline nearest-clinic lookup
 *   encounters_queue    — outbox of encounters waiting to sync
 *   kv                  — small key/value store (last sync time, schema version, etc.)
 *
 * Design notes:
 *   - All writes are idempotent: species and antivenom_centers use `INSERT OR REPLACE`.
 *   - encounters_queue rows carry a `synced_at` timestamp. On successful
 *     batch upload, we mark rows synced; we do NOT delete them, so users
 *     can see their own history. A background task prunes rows older
 *     than 90 days.
 *   - The schema version is tracked in kv.schema_version. When it changes,
 *     we run migrations in order — see `migrate()`.
 */
import * as SQLite from 'expo-sqlite';
import type { Language } from '@ishvenom/shared-types';

const DB_NAME = 'ishvenom.db';
const CURRENT_SCHEMA_VERSION = 2;

export interface StoredSpecies {
  id: string;
  scientificName: string;
  commonNames: Record<string, string>;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
  antivenomName: string | null;
  description?: Record<string, string>;
  imageUrl?: string;
}

export interface StoredAntivenomCenter {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  antivenomsStocked: string[];
  phone: string | null;
  lastVerified: string | null;
}

export interface QueuedEncounter {
  id: string;
  createdAt: string;
  deviceId: string;
  speciesGuess: string | null;
  confidence: number | null;
  latitude: number;
  longitude: number;
  district: string | null;
  country: string;
  language: Language;
  actionTaken:
    | 'first_aid_given'
    | 'clinic_referred'
    | 'traditional_treatment'
    | 'no_action'
    | 'unknown';
  wasBite: boolean;
  imagePath: string | null;
  imageHash: string | null;
  syncedAt: string | null;
  metadata: Record<string, unknown> | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const row = (await db.getFirstAsync<{ value: string } | null>(
    'SELECT value FROM kv WHERE key = ?',
    ['schema_version'],
  )) as { value: string } | null;
  const current = row ? Number(row.value) : 0;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS species (
        id TEXT PRIMARY KEY,
        scientific_name TEXT NOT NULL UNIQUE,
        common_names_json TEXT NOT NULL,
        venomous TEXT NOT NULL,
        antivenom_name TEXT,
        description_json TEXT,
        image_url TEXT
      );

      CREATE TABLE IF NOT EXISTS antivenom_centers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        antivenoms_stocked_json TEXT NOT NULL,
        phone TEXT,
        last_verified TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_av_country
        ON antivenom_centers(country);

      CREATE TABLE IF NOT EXISTS encounters_queue (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        device_id TEXT NOT NULL,
        species_guess TEXT,
        confidence REAL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        district TEXT,
        country TEXT NOT NULL,
        language TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        was_bite INTEGER NOT NULL,
        synced_at TEXT,
        metadata_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_queue_unsynced
        ON encounters_queue(synced_at) WHERE synced_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_queue_created
        ON encounters_queue(created_at DESC);
    `);
  }

  if (current < 2) {
    // Add photo columns to encounters already on disk.
    // ALTER TABLE … ADD COLUMN is safe to run on an empty table too.
    await db.execAsync(`
      ALTER TABLE encounters_queue ADD COLUMN image_path TEXT;
      ALTER TABLE encounters_queue ADD COLUMN image_hash TEXT;
    `);
  }

  await db.runAsync(
    'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
    ['schema_version', String(CURRENT_SCHEMA_VERSION)],
  );
}

// ---------- species ----------

export async function upsertSpecies(list: StoredSpecies[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const s of list) {
      await db.runAsync(
        `INSERT OR REPLACE INTO species
          (id, scientific_name, common_names_json, venomous, antivenom_name, description_json, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.scientificName,
          JSON.stringify(s.commonNames),
          s.venomous,
          s.antivenomName,
          s.description ? JSON.stringify(s.description) : null,
          s.imageUrl ?? null,
        ],
      );
    }
  });
}

export async function getSpeciesByScientificName(
  name: string,
): Promise<StoredSpecies | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    'SELECT * FROM species WHERE scientific_name = ?',
    [name],
  )) as Record<string, unknown> | null;
  if (!row) return null;
  return rowToSpecies(row);
}

export async function listAllSpecies(): Promise<StoredSpecies[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync('SELECT * FROM species')) as Array<
    Record<string, unknown>
  >;
  return rows.map(rowToSpecies);
}

function rowToSpecies(row: Record<string, unknown>): StoredSpecies {
  return {
    id: String(row.id),
    scientificName: String(row.scientific_name),
    commonNames: JSON.parse(String(row.common_names_json)),
    venomous: row.venomous as StoredSpecies['venomous'],
    antivenomName: (row.antivenom_name as string | null) ?? null,
    description: row.description_json
      ? JSON.parse(String(row.description_json))
      : undefined,
    ...(row.image_url ? { imageUrl: row.image_url as string } : {}),
  };
}

// ---------- antivenom centers ----------

export async function upsertAntivenomCenters(
  list: StoredAntivenomCenter[],
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const c of list) {
      await db.runAsync(
        `INSERT OR REPLACE INTO antivenom_centers
          (id, name, country, latitude, longitude, antivenoms_stocked_json, phone, last_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.name,
          c.country,
          c.latitude,
          c.longitude,
          JSON.stringify(c.antivenomsStocked),
          c.phone,
          c.lastVerified,
        ],
      );
    }
  });
}

export async function getAntivenomCentersByCountry(
  country: string,
): Promise<StoredAntivenomCenter[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    'SELECT * FROM antivenom_centers WHERE country = ?',
    [country],
  )) as Array<Record<string, unknown>>;
  return rows.map(rowToCenter);
}

export async function getAllAntivenomCenters(): Promise<StoredAntivenomCenter[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    'SELECT * FROM antivenom_centers',
  )) as Array<Record<string, unknown>>;
  return rows.map(rowToCenter);
}

function rowToCenter(row: Record<string, unknown>): StoredAntivenomCenter {
  return {
    id: String(row.id),
    name: String(row.name),
    country: String(row.country),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    antivenomsStocked: JSON.parse(String(row.antivenoms_stocked_json)),
    phone: (row.phone as string | null) ?? null,
    lastVerified: (row.last_verified as string | null) ?? null,
  };
}

// ---------- encounters queue ----------

export async function enqueueEncounter(
  e: Omit<QueuedEncounter, 'syncedAt'>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO encounters_queue
      (id, created_at, device_id, species_guess, confidence, latitude,
       longitude, district, country, language, action_taken, was_bite,
       image_path, image_hash, synced_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      e.id,
      e.createdAt,
      e.deviceId,
      e.speciesGuess,
      e.confidence,
      e.latitude,
      e.longitude,
      e.district,
      e.country,
      e.language,
      e.actionTaken,
      e.wasBite ? 1 : 0,
      e.imagePath ?? null,
      e.imageHash ?? null,
      e.metadata ? JSON.stringify(e.metadata) : null,
    ],
  );
}

export async function listUnsyncedEncounters(
  limit = 100,
): Promise<QueuedEncounter[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    `SELECT * FROM encounters_queue
     WHERE synced_at IS NULL
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  )) as Array<Record<string, unknown>>;
  return rows.map(rowToEncounter);
}

export async function markEncountersSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE encounters_queue SET synced_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids],
  );
}

export async function listRecentEncounters(
  limit = 50,
): Promise<QueuedEncounter[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    'SELECT * FROM encounters_queue ORDER BY created_at DESC LIMIT ?',
    [limit],
  )) as Array<Record<string, unknown>>;
  return rows.map(rowToEncounter);
}

function rowToEncounter(row: Record<string, unknown>): QueuedEncounter {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    deviceId: String(row.device_id),
    speciesGuess: (row.species_guess as string | null) ?? null,
    confidence:
      row.confidence == null ? null : Number(row.confidence),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    district: (row.district as string | null) ?? null,
    country: String(row.country),
    language: row.language as Language,
    actionTaken: row.action_taken as QueuedEncounter['actionTaken'],
    wasBite: Number(row.was_bite) === 1,
    imagePath: (row.image_path as string | null) ?? null,
    imageHash: (row.image_hash as string | null) ?? null,
    syncedAt: (row.synced_at as string | null) ?? null,
    metadata: row.metadata_json
      ? JSON.parse(String(row.metadata_json))
      : null,
  };
}

// ---------- kv store ----------

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    'SELECT value FROM kv WHERE key = ?',
    [key],
  )) as { value: string } | null;
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
    [key, value],
  );
}
