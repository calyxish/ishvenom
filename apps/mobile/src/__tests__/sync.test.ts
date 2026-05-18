import { flush, resetSyncSingleton, type SyncDeps } from '../lib/sync';
import type { QueuedEncounter } from '../lib/db';

function mkRow(id: string): QueuedEncounter {
  return {
    id,
    createdAt: '2026-04-08T12:00:00.000Z',
    deviceId: 'device-hash-1234567890',
    speciesGuess: 'Bitis arietans',
    confidence: 0.82,
    latitude: 5.6,
    longitude: -0.19,
    district: null,
    country: 'GH',
    language: 'en',
    actionTaken: 'first_aid_given',
    wasBite: true,
    imagePath: null,
    imageHash: null,
    syncedAt: null,
    metadata: null,
  };
}

function makeDeps(overrides: Partial<SyncDeps>): SyncDeps {
  return {
    api: {
      postEncounterBatch: jest.fn(async () => ({
        accepted: 0,
        rejected: 0,
        batchId: '00000000-0000-4000-8000-000000000000',
      })),
    } as unknown as SyncDeps['api'],
    listUnsynced: jest.fn(async () => []),
    markSynced: jest.fn(async () => {}),
    isOnline: jest.fn(async () => true),
    ...overrides,
  };
}

beforeEach(() => {
  resetSyncSingleton();
});

test('skips when offline', async () => {
  const deps = makeDeps({ isOnline: async () => false });
  const res = await flush(deps);
  expect(res.skipped).toBe(true);
  expect(res.reason).toBe('offline');
  expect(deps.listUnsynced).not.toHaveBeenCalled();
});

test('no-op when queue is empty', async () => {
  const deps = makeDeps({ listUnsynced: async () => [] });
  const res = await flush(deps);
  expect(res.skipped).toBe(false);
  expect(res.batches).toBe(0);
  expect(res.attempted).toBe(0);
});

test('uploads a batch and marks rows synced when server accepts all', async () => {
  const rows = [mkRow('a'), mkRow('b'), mkRow('c')];
  let calls = 0;
  const listUnsynced = jest.fn(async () => (calls++ === 0 ? rows : []));
  const markSynced = jest.fn(async () => {});
  const postEncounterBatch = jest.fn(async () => ({
    accepted: 3,
    rejected: 0,
    batchId: '00000000-0000-4000-8000-000000000000',
  }));
  const deps = makeDeps({
    listUnsynced,
    markSynced,
    api: { postEncounterBatch } as unknown as SyncDeps['api'],
  });
  const res = await flush(deps);
  expect(res.attempted).toBe(3);
  expect(res.accepted).toBe(3);
  expect(res.batches).toBe(1);
  expect(markSynced).toHaveBeenCalledWith(['a', 'b', 'c']);
});

test('stops and does not mark synced when server rejects any row', async () => {
  const rows = [mkRow('a'), mkRow('b')];
  const listUnsynced = jest.fn(async () => rows);
  const markSynced = jest.fn(async () => {});
  const postEncounterBatch = jest.fn(async () => ({
    accepted: 1,
    rejected: 1,
    batchId: '00000000-0000-4000-8000-000000000000',
  }));
  const deps = makeDeps({
    listUnsynced,
    markSynced,
    api: { postEncounterBatch } as unknown as SyncDeps['api'],
  });
  const res = await flush(deps);
  expect(res.batches).toBe(1);
  expect(res.rejected).toBe(1);
  expect(markSynced).not.toHaveBeenCalled();
});

test('concurrent flush calls share the same in-flight promise', async () => {
  const listUnsynced = jest.fn(async () => []);
  const deps = makeDeps({ listUnsynced });
  const [a, b] = await Promise.all([flush(deps), flush(deps)]);
  expect(a).toBe(b);
  expect(listUnsynced).toHaveBeenCalledTimes(1);
});
