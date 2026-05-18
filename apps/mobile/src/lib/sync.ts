/**
 * Sync engine for the offline encounter queue.
 *
 * Invariants:
 *   1. Rows are NEVER deleted by the sync engine. We only flip
 *      synced_at from NULL → ISO timestamp on successful upload.
 *      (Pruning old synced rows is a separate maintenance job.)
 *   2. A batch that the server partially rejects is retried whole on
 *      the next run, because we don't yet know which rows were rejected.
 *      The API accepts the same batchId idempotently — see Phase 5 route.
 *   3. If the network is down, flush() resolves with a no-op result,
 *      not an error. Errors are reserved for real failures the caller
 *      should react to (auth broken, server 5xx after retries, etc.).
 *   4. Only one flush runs at a time. Concurrent calls await the
 *      in-flight promise.
 *
 * This module is intentionally decoupled from React and from the DB
 * module's singleton: the caller injects both, which makes unit tests
 * trivial (see __tests__/sync.test.ts).
 */
import type { EncounterCreate, Language } from '@ishvenom/shared-types';
import type { ApiClient, EncounterBatchResponse } from './api';
import type { QueuedEncounter } from './db';

export interface SyncDeps {
  api: ApiClient;
  listUnsynced: (limit: number) => Promise<QueuedEncounter[]>;
  markSynced: (ids: string[]) => Promise<void>;
  isOnline: () => Promise<boolean>;
  now?: () => Date;
}

export interface SyncResult {
  attempted: number;
  accepted: number;
  rejected: number;
  batches: number;
  skipped: boolean;
  reason?: string;
}

const BATCH_SIZE = 50;
const MAX_BATCHES_PER_RUN = 10;

let inflight: Promise<SyncResult> | null = null;

export function resetSyncSingleton(): void {
  inflight = null;
}

export async function flush(deps: SyncDeps): Promise<SyncResult> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      return await run(deps);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function run(deps: SyncDeps): Promise<SyncResult> {
  const online = await deps.isOnline();
  if (!online) {
    return {
      attempted: 0,
      accepted: 0,
      rejected: 0,
      batches: 0,
      skipped: true,
      reason: 'offline',
    };
  }

  let totalAttempted = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let batches = 0;

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
    const rows = await deps.listUnsynced(BATCH_SIZE);
    if (rows.length === 0) break;

    const payload: EncounterCreate[] = rows.map(toEncounterCreate);
    let res: EncounterBatchResponse;
    try {
      res = await deps.api.postEncounterBatch(payload);
    } catch (err) {
      // Propagate — the caller decides whether to retry or surface.
      throw err;
    }

    batches += 1;
    totalAttempted += rows.length;
    totalAccepted += res.accepted;
    totalRejected += res.rejected;

    // Conservative: only mark rows synced if the server accepted ALL of them.
    // Otherwise we don't know which rows failed, so retry the whole batch.
    if (res.rejected === 0) {
      await deps.markSynced(rows.map((r) => r.id));
    } else {
      break;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return {
    attempted: totalAttempted,
    accepted: totalAccepted,
    rejected: totalRejected,
    batches,
    skipped: false,
  };
}

function toEncounterCreate(r: QueuedEncounter): EncounterCreate {
  return {
    deviceId: r.deviceId,
    speciesGuess: r.speciesGuess,
    confidence: r.confidence,
    latitude: r.latitude,
    longitude: r.longitude,
    district: r.district,
    country: r.country,
    language: r.language as Language,
    actionTaken: r.actionTaken,
    wasBite: r.wasBite,
    metadata: r.metadata ?? undefined,
  };
}
