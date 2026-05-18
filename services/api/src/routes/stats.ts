/**
 * Stats endpoints — dashboard-facing, public for demo/judge access.
 *
 * GET /api/v1/stats/districts              — encounter counts per district
 * GET /api/v1/stats/outbreaks              — districts exceeding baseline
 * GET /api/v1/stats/timeseries?days=30     — daily totals for charts
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getDistrictStats, getOutbreaks } from '../lib/geo.js';

const router: Router = Router();

// ── /districts ────────────────────────────────────────────────────────
const DistrictsQuerySchema = z.object({
  since:   z.string().datetime().optional(),
  until:   z.string().datetime().optional(),
  species: z.string().optional(),
});

router.get(
  '/stats/districts',
  async (req: Request, res: Response) => {
    const parsed = DistrictsQuerySchema.safeParse(req.query);
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

    const rows = await getDistrictStats({
      ...(parsed.data.since   !== undefined && { since:   new Date(parsed.data.since) }),
      ...(parsed.data.until   !== undefined && { until:   new Date(parsed.data.until) }),
      ...(parsed.data.species !== undefined && { species: parsed.data.species }),
    });

    res.status(200).json({
      districts: rows.map((r) => ({
        country:       r.country,
        district:      r.district,
        encounterCount: Number(r.encounterCount),
        biteCount:     Number(r.biteCount),
        topSpecies:    r.topSpecies,
      })),
    });
  },
);

// ── /outbreaks ────────────────────────────────────────────────────────
const OutbreaksQuerySchema = z.object({
  threshold: z.coerce.number().positive().max(10).default(1.5),
});

router.get(
  '/stats/outbreaks',
  async (req: Request, res: Response) => {
    const parsed = OutbreaksQuerySchema.safeParse(req.query);
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

    const rows = await getOutbreaks({ thresholdRatio: parsed.data.threshold });
    res.status(200).json({
      threshold: parsed.data.threshold,
      outbreaks: rows.map((r) => ({
        country:     r.country,
        district:    r.district,
        speciesGuess: r.speciesGuess,
        recentCount: Number(r.recentCount),
        baselineAvg: r.baselineAvg,
        ratio:       r.ratio,
      })),
    });
  },
);

// ── /timeseries ───────────────────────────────────────────────────────
const TimeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

interface TimeseriesRow {
  day:        Date;
  encounters: bigint;
  bites:      bigint;
}

router.get(
  '/stats/timeseries',
  async (req: Request, res: Response) => {
    const parsed = TimeseriesQuerySchema.safeParse(req.query);
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

    const days = parsed.data.days;
    const rows = await prisma.$queryRaw<TimeseriesRow[]>`
      SELECT
        date_trunc('day', "createdAt") AS "day",
        COUNT(*)::bigint AS "encounters",
        SUM(CASE WHEN "wasBite" THEN 1 ELSE 0 END)::bigint AS "bites"
      FROM "Encounter"
      WHERE "createdAt" >= NOW() - (${days}::int || ' days')::interval
      GROUP BY date_trunc('day', "createdAt")
      ORDER BY "day" ASC
    `;

    res.status(200).json({
      days,
      series: rows.map((r) => ({
        day:        r.day.toISOString(),
        encounters: Number(r.encounters),
        bites:      Number(r.bites),
      })),
    });
  },
);

export { router as statsRouter };
