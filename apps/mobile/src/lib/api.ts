/**
 * Typed fetch client for the Phase 5 backend.
 *
 * Everything is parsed with Zod on the way in so that a malformed
 * response from the server cannot crash the UI — we just reject the
 * promise with a structured error. The app then either falls back to
 * cached data or surfaces a toast.
 *
 * Concurrency / retry policy:
 *   - No built-in retry. Callers that need retry wrap this in a
 *     backoff loop (see lib/sync.ts). Keeping this module dumb makes it
 *     much easier to test.
 *   - The default timeout is 15s; the encounters batch uses 30s because
 *     the server validates each row.
 */
import { z } from 'zod';
import {
  SpeciesSchema,
  AntivenomCenterSchema,
  EncounterBatchSchema,
  ErrorResponseSchema,
  type EncounterCreate,
  type Species,
  type AntivenomCenter,
} from '@ishvenom/shared-types';

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const SpeciesListSchema = z.object({ species: z.array(SpeciesSchema) });
const AntivenomListSchema = z.object({
  centers: z.array(AntivenomCenterSchema),
  query: z
    .object({
      lat: z.number(),
      lng: z.number(),
      radius: z.number(),
      limit: z.number(),
    })
    .optional(),
});
const EncounterBatchResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  batchId: z.string().uuid(),
});
export type EncounterBatchResponse = z.infer<typeof EncounterBatchResponseSchema>;

const HealthSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  uptime: z.number(),
});
export type Health = z.infer<typeof HealthSchema>;

export function createApiClient(config: ApiClientConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = config.baseUrl.replace(/\/$/, '');

  async function request<T>(
    path: string,
    init: RequestInit,
    parser: z.ZodSchema<T>,
    overrideTimeoutMs?: number,
  ): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(
      () => controller.abort(),
      overrideTimeoutMs ?? timeoutMs,
    );
    try {
      const res = await fetchImpl(`${base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(init.headers ?? {}),
        },
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) {
        const err = ErrorResponseSchema.safeParse(json);
        if (err.success) {
          throw new ApiError(
            res.status,
            err.data.error.code,
            err.data.error.message,
            err.data.error.details,
          );
        }
        throw new ApiError(res.status, 'http_error', `HTTP ${res.status}`);
      }

      const parsed = parser.safeParse(json);
      if (!parsed.success) {
        throw new ApiError(
          res.status,
          'invalid_response',
          'Server response failed schema validation',
          parsed.error.flatten(),
        );
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new ApiError(0, 'timeout', 'Request timed out');
      }
      throw new ApiError(
        0,
        'network_error',
        (err as Error).message ?? 'Network error',
      );
    } finally {
      clearTimeout(t);
    }
  }

  return {
    health(): Promise<Health> {
      return request('/api/v1/health', { method: 'GET' }, HealthSchema);
    },

    async listSpecies(): Promise<Species[]> {
      const r = await request(
        '/api/v1/species',
        { method: 'GET' },
        SpeciesListSchema,
      );
      return r.species;
    },

    async listAntivenomCenters(params: {
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      limit?: number;
    }): Promise<AntivenomCenter[]> {
      const qs = new URLSearchParams({
        lat: String(params.latitude),
        lng: String(params.longitude),
        radius: String(params.radiusMeters ?? 200_000),
        limit: String(params.limit ?? 20),
      });
      const r = await request(
        `/api/v1/antivenom-centers?${qs.toString()}`,
        { method: 'GET' },
        AntivenomListSchema,
      );
      return r.centers;
    },

    async postEncounterBatch(
      encounters: EncounterCreate[],
    ): Promise<EncounterBatchResponse> {
      const body = EncounterBatchSchema.parse({ encounters });
      return request(
        '/api/v1/encounters',
        { method: 'POST', body: JSON.stringify(body) },
        EncounterBatchResponseSchema,
        30_000,
      );
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
