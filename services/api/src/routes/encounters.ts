/**
 * POST /api/v1/encounters
 *
 * Batched sync endpoint for the mobile app. A CHW's phone accumulates
 * encounter records in an offline queue (AsyncStorage) and flushes them
 * here when connectivity returns.
 *
 * Privacy rules (enforced server-side, not just client-side):
 *   - Every coordinate is truncated to ~1.1 km precision on ingest.
 *   - The `deviceId` field is already a client-side hash; we never try
 *     to reverse it.
 *   - The raw JSON body is NOT logged — only counts, country, and IDs.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { EncounterBatchSchema } from '@ishvenom/shared-types';
import { Prisma } from '@prisma/client';
import { insertEncounterRaw, truncateCoordinate } from '../lib/geo.js';
import { logger } from '../lib/logger.js';
import { writeLimiter } from '../middleware/rateLimit.js';

const router: Router = Router();

const BatchResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  batchId: z.string().uuid(),
});

router.post(
  '/encounters',
  writeLimiter,
  async (req: Request, res: Response) => {
    const parsed = EncounterBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Body failed EncounterBatchSchema validation',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    const batchId = randomUUID();
    let accepted = 0;
    let rejected = 0;

    for (const e of parsed.data.encounters) {
      try {
        const truncated = truncateCoordinate({
          latitude: e.latitude,
          longitude: e.longitude,
        });
        await insertEncounterRaw({
          id: randomUUID(),
          deviceId: e.deviceId,
          speciesGuess: e.speciesGuess,
          confidence: e.confidence,
          latitude: truncated.latitude,
          longitude: truncated.longitude,
          district: e.district,
          country: e.country,
          language: e.language,
          actionTaken: e.actionTaken,
          wasBite: e.wasBite,
          metadata: (e.metadata as Prisma.InputJsonValue | undefined) ?? null,
        });
        accepted += 1;
      } catch (err) {
        rejected += 1;
        logger.error(
          { err, batchId, country: e.country },
          'Failed to insert encounter',
        );
      }
    }

    logger.info(
      { batchId, accepted, rejected, total: parsed.data.encounters.length },
      'Encounter batch processed',
    );

    const body = BatchResponseSchema.parse({ accepted, rejected, batchId });
    res.status(201).json(body);
  },
);

export { router as encountersRouter };
