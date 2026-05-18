/**
 * POST /api/v1/sit-reports              — create + trigger generation
 * GET  /api/v1/sit-reports               — list for current officer
 * GET  /api/v1/sit-reports/:id           — full detail
 *
 * Generation model: fire-and-forget in-process.
 *   1. POST validates scope, checks cohort size, creates a row with
 *      status = 'pending' and returns 202 immediately.
 *   2. A background promise calls the RunPod client, parses the
 *      output, and updates the row to 'generating' → 'ready' | 'failed'.
 *   3. The dashboard polls GET /sit-reports/:id every ~3s while
 *      status is pending or generating.
 *
 * In-process is acceptable at hackathon scale. If we ever run more
 * than one API instance, this needs to move into a proper worker +
 * queue (BullMQ + Redis would be the natural choice, but deliberately
 * out of scope here).
 */
import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  SitReportCreateSchema,
  SitReportSchema,
  type SitReport,
} from '@ishvenom/shared-types';
import { prisma } from '../lib/prisma.js';
import { getDistrictStats } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  buildSitReportPrompt,
  CohortTooSmallError,
  type DistrictAggregate,
  type SitReportPromptInput,
} from '../lib/sitReportPrompt.js';
import { parseSitReportOutput } from '../lib/sitReportParser.js';
import type { SitReportClient } from '../lib/sitReportClient.js';

const router: Router = Router();
const DEFAULT_MODEL = 'google/gemma-4-31b-it';

/** Injected by the app bootstrap so tests can swap it for a mock. */
let sitReportClient: SitReportClient | null = null;
export function setSitReportClient(client: SitReportClient | null): void {
  sitReportClient = client;
}

// ─── POST /sit-reports ────────────────────────────────────────────────

router.post(
  '/sit-reports',
  writeLimiter,
  async (req: Request, res: Response) => {
    const parsed = SitReportCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Body failed SitReportCreateSchema validation',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    // Auth wall removed for demo access — use authenticated user or nil UUID.
    const userId = req.user?.id ?? '00000000-0000-0000-0000-000000000000';

    const { scope, model } = parsed.data;

    let promptInput: SitReportPromptInput;
    try {
      promptInput = await assemblePromptInput(scope);
    } catch (err) {
      if (err instanceof CohortTooSmallError) {
        res.status(422).json({
          error: {
            code: 'cohort_too_small',
            message: `Only ${err.cohortSize} encounters in scope — minimum is 5 to protect patient anonymity`,
            details: { cohortSize: err.cohortSize },
          },
        });
        return;
      }
      throw err;
    }

    const row = await prisma.sitReport.create({
      data: {
        createdByUserId: userId,
        scopeCountry: scope.country,
        scopeDistrict: scope.district,
        scopeSince: new Date(scope.since),
        scopeUntil: new Date(scope.until),
        status: 'pending',
        model: model ?? DEFAULT_MODEL,
      },
    });

    // Fire-and-forget. Errors land in the row, not the HTTP response.
    void runGeneration(row.id, promptInput).catch((err: Error) => {
      logger.error(
        { err, sitReportId: row.id },
        'Unhandled error in sit-report background job',
      );
    });

    res.status(202).json({ report: rowToApi(row) });
  },
);

// ─── GET /sit-reports ─────────────────────────────────────────────────

const ListQuerySchema = z.object({
  country: z.string().length(2).optional(),
  district: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/sit-reports',
  async (req: Request, res: Response) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Query parameters failed validation',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const where = {
      ...(parsed.data.country !== undefined && { scopeCountry: parsed.data.country }),
      ...(parsed.data.district !== undefined && { scopeDistrict: parsed.data.district }),
    };

    const rows = await prisma.sitReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parsed.data.limit,
    });

    const total = await prisma.sitReport.count({ where });

    res.status(200).json({
      reports: rows.map(rowToApi),
      total,
    });
  },
);

// ─── GET /sit-reports/:id ─────────────────────────────────────────────

router.get(
  '/sit-reports/:id',
  async (req: Request, res: Response) => {
    const row = await prisma.sitReport.findUnique({
      where: { id: req.params['id'] as string },
    });
    if (!row) {
      res.status(404).json({
        error: { code: 'not_found', message: 'Situation report not found' },
      });
      return;
    }
    res.status(200).json({ report: rowToApi(row) });
  },
);

// ─── helpers ──────────────────────────────────────────────────────────

async function assemblePromptInput(scope: {
  country: string;
  district: string | null;
  since: string;
  until: string;
}): Promise<SitReportPromptInput> {
  const districtRows = await getDistrictStats({
    since: new Date(scope.since),
    until: new Date(scope.until),
    country: scope.country,
  });

  const aggregates: DistrictAggregate[] = districtRows.map((r) => ({
    country: r.country,
    district: r.district,
    encounterCount: Number(r.encounterCount),
    biteCount: Number(r.biteCount),
    topSpecies: Array.isArray(r.topSpecies)
      ? r.topSpecies.map((s: { scientificName: string; count: number }) => ({
          scientificName: s.scientificName,
          count: s.count,
        }))
      : [],
    baselineRatio: Number((r as { baselineRatio?: number }).baselineRatio ?? 1),
  }));

  const nationalTotals = aggregates.reduce(
    (acc, r) => ({
      encounters: acc.encounters + r.encounterCount,
      bites: acc.bites + r.biteCount,
    }),
    { encounters: 0, bites: 0 },
  );

  return {
    scope: {
      country: scope.country,
      district: scope.district,
      since: scope.since,
      until: scope.until,
    },
    districtRows: aggregates,
    nationalTotals,
  };
}

async function runGeneration(
  id: string,
  promptInput: SitReportPromptInput,
): Promise<void> {
  if (!sitReportClient) {
    await prisma.sitReport.update({
      where: { id },
      data: {
        status: 'failed',
        error: 'cloud_unavailable: RunPod client is not configured on this instance',
      },
    });
    return;
  }

  await prisma.sitReport.update({
    where: { id },
    data: { status: 'generating' },
  });

  try {
    const prompt = buildSitReportPrompt(promptInput);
    const gen = await sitReportClient.generate({
      prompt,
      maxTokens: 1200,
      temperature: 0.3,
    });
    const parsed = parseSitReportOutput(gen.text);

    await prisma.sitReport.update({
      where: { id },
      data: {
        status: 'ready',
        markdown: parsed.markdown,
        structured: parsed.structured !== null ? (parsed.structured as Prisma.InputJsonValue) : Prisma.DbNull,
        promptTokens: gen.promptTokens,
        completionTokens: gen.completionTokens,
        latencyMs: gen.latencyMs,
        error: null,
      },
    });
  } catch (err) {
    logger.warn(
      { err, sitReportId: id },
      'Sit report generation failed; marking row failed',
    );
    await prisma.sitReport.update({
      where: { id },
      data: {
        status: 'failed',
        error: (err as Error).message ?? 'unknown_error',
      },
    });
  }
}

function rowToApi(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  scopeCountry: string;
  scopeDistrict: string | null;
  scopeSince: Date;
  scopeUntil: Date;
  status: string;
  model: string;
  markdown: string | null;
  structured: unknown;
  error: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
}): SitReport {
  return SitReportSchema.parse({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdByUserId: row.createdByUserId,
    status: row.status,
    scope: {
      country: row.scopeCountry,
      district: row.scopeDistrict,
      since: row.scopeSince.toISOString(),
      until: row.scopeUntil.toISOString(),
    },
    model: row.model,
    markdown: row.markdown,
    structured: row.structured ?? null,
    error: row.error,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    latencyMs: row.latencyMs,
  });
}

export { router as sitReportsRouter };
