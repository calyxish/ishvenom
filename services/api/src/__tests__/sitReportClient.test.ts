import {
  createSitReportClient,
  RunPodError,
  type SitReportClientConfig,
} from '../lib/sitReportClient.js';

type FetchCall = { url: string; init?: RequestInit };

function makeFetch(responses: Array<{ ok: boolean; status: number; json: unknown }>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses[i++];
    if (!r) throw new Error(`unexpected fetch call #${calls.length}: ${url}`);
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.json,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function baseConfig(extra: Partial<SitReportClientConfig> = {}): SitReportClientConfig {
  let t = 1000;
  return {
    endpointId: 'endpoint-xyz',
    apiKey: 'rp-test-key',
    pollIntervalMs: 10,
    maxWaitMs: 5000,
    now: () => {
      t += 5;
      return t;
    },
    sleep: async () => {},
    ...extra,
  };
}

test('happy path: submit then one poll returns COMPLETED with text', async () => {
  const { fetchImpl, calls } = makeFetch([
    { ok: true, status: 200, json: { id: 'job-1', status: 'IN_QUEUE' } },
    {
      ok: true,
      status: 200,
      json: {
        id: 'job-1',
        status: 'COMPLETED',
        output: {
          text: '# Report\n\nEverything is fine.',
          latency_ms: 4321,
          model: 'gemma-4-31b',
          tokens: { prompt: 500, completion: 220 },
        },
      },
    },
  ]);
  const client = createSitReportClient(baseConfig({ fetchImpl }));

  const res = await client.generate({ prompt: 'hello' });
  expect(res.text).toContain('Everything is fine');
  expect(res.latencyMs).toBe(4321);
  expect(res.promptTokens).toBe(500);
  expect(res.completionTokens).toBe(220);
  expect(calls[0].url).toContain('/v2/endpoint-xyz/run');
  expect(calls[1].url).toContain('/v2/endpoint-xyz/status/job-1');
});

test('waits through IN_QUEUE + IN_PROGRESS before COMPLETED', async () => {
  const { fetchImpl } = makeFetch([
    { ok: true, status: 200, json: { id: 'job-2' } },
    { ok: true, status: 200, json: { id: 'job-2', status: 'IN_QUEUE' } },
    { ok: true, status: 200, json: { id: 'job-2', status: 'IN_PROGRESS' } },
    {
      ok: true,
      status: 200,
      json: {
        id: 'job-2',
        status: 'COMPLETED',
        output: { text: 'done', latency_ms: 10, model: 'gemma-4-31b' },
      },
    },
  ]);
  const client = createSitReportClient(baseConfig({ fetchImpl }));
  const res = await client.generate({ prompt: 'hi' });
  expect(res.text).toBe('done');
});

test('throws RunPodError with job_failed when status is FAILED', async () => {
  const { fetchImpl } = makeFetch([
    { ok: true, status: 200, json: { id: 'job-3' } },
    {
      ok: true,
      status: 200,
      json: { id: 'job-3', status: 'FAILED', error: 'OOM' },
    },
  ]);
  const client = createSitReportClient(baseConfig({ fetchImpl }));
  await expect(client.generate({ prompt: 'hi' })).rejects.toThrow(RunPodError);
  await expect(client.generate({ prompt: 'hi' }).catch((e) => e.code)).resolves;
});

test('throws submit_failed on non-2xx submit response', async () => {
  const { fetchImpl } = makeFetch([
    { ok: false, status: 500, json: { message: 'runpod down' } },
  ]);
  const client = createSitReportClient(baseConfig({ fetchImpl }));
  try {
    await client.generate({ prompt: 'hi' });
    fail('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(RunPodError);
    expect((err as RunPodError).code).toBe('submit_failed');
    expect((err as RunPodError).status).toBe(500);
  }
});

test('times out when polling exceeds maxWaitMs', async () => {
  // Respond IN_PROGRESS forever.
  const fetchImpl = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'job-4', status: 'IN_PROGRESS' }),
    }) as unknown as Response) as unknown as typeof fetch;
  // First call returns submit response, then poll.
  let first = true;
  const wrapped = (async (url: string, init?: RequestInit) => {
    if (first) {
      first = false;
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'job-4' }),
      } as unknown as Response;
    }
    return fetchImpl(url, init);
  }) as unknown as typeof fetch;

  let t = 0;
  const client = createSitReportClient({
    endpointId: 'e',
    apiKey: 'k',
    fetchImpl: wrapped,
    pollIntervalMs: 1,
    maxWaitMs: 50,
    now: () => {
      t += 20;
      return t;
    },
    sleep: async () => {},
  });
  try {
    await client.generate({ prompt: 'hi' });
    fail('should have thrown');
  } catch (err) {
    expect((err as RunPodError).code).toBe('timeout');
  }
});
