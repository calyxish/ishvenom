/**
 * RunPod serverless client for the cloud inference worker.
 *
 * We POST to /v2/<endpoint_id>/run (async), then poll /v2/<endpoint_id>/status/<job_id>
 * until the job reaches COMPLETED, FAILED, CANCELLED, or TIMED_OUT, or
 * we exceed our own wall-clock budget.
 *
 * Why async + poll instead of /runsync
 * ------------------------------------
 * /runsync has a 30-second ceiling on RunPod serverless. A cold A100
 * worker loading Gemma 4 31B + running a 1 k-token report comfortably
 * blows past that on first invocation. The async path handles cold
 * starts cleanly and still returns in 2-4 seconds for warm workers.
 *
 * Testing
 * -------
 * This module accepts an injected `fetch` implementation so unit tests
 * drive the full state machine (queued → in_progress → completed)
 * without touching the network — see sitReportClient.test.ts.
 */
import { z } from 'zod';

export interface SitReportClientConfig {
  endpointId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Maximum wall-clock time to wait for a completed job, in ms. Default 120s. */
  maxWaitMs?: number;
  /** Interval between status polls, in ms. Default 2s. */
  pollIntervalMs?: number;
  /** Clock injector for tests. */
  now?: () => number;
  /** Sleep injector for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const RunJobResponseSchema = z.object({
  id: z.string(),
  status: z.string().optional(),
});

const StatusResponseSchema = z.object({
  id: z.string(),
  status: z.enum([
    'IN_QUEUE',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'TIMED_OUT',
  ]),
  output: z
    .object({
      text: z.string().optional(),
      latency_ms: z.number().optional(),
      model: z.string().optional(),
      tokens: z
        .object({
          prompt: z.number().optional(),
          completion: z.number().optional(),
        })
        .optional(),
      error: z.string().optional(),
    })
    .nullable()
    .optional(),
  error: z.string().optional(),
});

export interface SitReportGenerationResult {
  text: string;
  latencyMs: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class RunPodError extends Error {
  public readonly code: string;
  public readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'RunPodError';
    this.code = code;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export interface SitReportGenerateRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
}

export function createSitReportClient(config: SitReportClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const maxWaitMs = config.maxWaitMs ?? 120_000;
  const pollIntervalMs = config.pollIntervalMs ?? 2_000;
  const now = config.now ?? (() => Date.now());
  const sleep =
    config.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const base = `https://api.runpod.ai/v2/${config.endpointId}`;
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${config.apiKey}`,
  };

  async function submit(body: SitReportGenerateRequest): Promise<string> {
    const res = await fetchImpl(`${base}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: {
          prompt: body.prompt,
          max_tokens: body.maxTokens ?? 1200,
          temperature: body.temperature ?? 0.3,
          top_p: body.topP ?? 0.9,
          stop: body.stop ?? ['<end_of_turn>'],
        },
      }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new RunPodError(
        'submit_failed',
        `RunPod submit returned ${res.status}`,
        res.status,
      );
    }
    const parsed = RunJobResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new RunPodError(
        'invalid_submit_response',
        'RunPod submit response failed schema',
      );
    }
    return parsed.data.id;
  }

  async function poll(jobId: string): Promise<SitReportGenerationResult> {
    const started = now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const elapsed = now() - started;
      if (elapsed >= maxWaitMs) {
        throw new RunPodError(
          'timeout',
          `RunPod job ${jobId} did not complete within ${maxWaitMs}ms`,
        );
      }

      const res = await fetchImpl(`${base}/status/${jobId}`, {
        method: 'GET',
        headers,
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        throw new RunPodError(
          'status_failed',
          `RunPod status returned ${res.status}`,
          res.status,
        );
      }
      const parsed = StatusResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new RunPodError(
          'invalid_status_response',
          'RunPod status response failed schema',
        );
      }
      const { status, output, error } = parsed.data;

      if (status === 'COMPLETED') {
        if (!output || !output.text) {
          throw new RunPodError(
            'empty_output',
            'RunPod job completed with no text',
          );
        }
        if (output.error) {
          throw new RunPodError('handler_error', output.error);
        }
        return {
          text: output.text,
          latencyMs: output.latency_ms ?? 0,
          model: output.model ?? 'gemma-4-31b',
          promptTokens: output.tokens?.prompt ?? 0,
          completionTokens: output.tokens?.completion ?? 0,
        };
      }

      if (
        status === 'FAILED' ||
        status === 'CANCELLED' ||
        status === 'TIMED_OUT'
      ) {
        throw new RunPodError(
          `job_${status.toLowerCase()}`,
          error ?? `RunPod job ended with status ${status}`,
        );
      }

      // Still IN_QUEUE or IN_PROGRESS — wait then poll again.
      await sleep(pollIntervalMs);
    }
  }

  return {
    async generate(
      body: SitReportGenerateRequest,
    ): Promise<SitReportGenerationResult> {
      const jobId = await submit(body);
      return poll(jobId);
    },
    // Exposed for tests.
    _submit: submit,
    _poll: poll,
  };
}

export type SitReportClient = ReturnType<typeof createSitReportClient>;
