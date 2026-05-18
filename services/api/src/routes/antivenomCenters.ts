/**
 * GET /api/v1/antivenom-centers?lat=X&lng=Y&radius=50000&limit=10
 *
 * Returns antivenom centers within `radius` meters of (lat, lng), ordered
 * by distance ascending. Default radius: 200 km. Default limit: 20.
 *
 * Uses PostGIS ST_DWithin with geography cast for accurate meter distances.
 * See ../lib/geo.ts for the raw query.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AntivenomCenterSchema } from '@ishvenom/shared-types';
import { findNearbyAntivenomCenters } from '../lib/geo.js';
import { publicLimiter } from '../middleware/rateLimit.js';

const router: Router = Router();

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().positive().max(1_000_000).default(200_000),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/antivenom-centers',
  publicLimiter,
  async (req: Request, res: Response) => {
    const parsed = QuerySchema.safeParse(req.query);
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

    const { lat, lng, radius, limit } = parsed.data;
    const rows = await findNearbyAntivenomCenters(
      { latitude: lat, longitude: lng },
      radius,
      limit,
    );

    const body = rows.map((r) =>
      AntivenomCenterSchema.parse({
        id: r.id,
        name: r.name,
        country: r.country,
        latitude: r.latitude,
        longitude: r.longitude,
        antivenomsStocked: r.antivenomsStocked as string[],
        phone: r.phone,
        lastVerified: r.lastVerified ? r.lastVerified.toISOString() : null,
        distanceMeters: Math.round(r.distanceMeters),
      }),
    );

    res.status(200).json({
      centers: body,
      query: { lat, lng, radius, limit },
    });
  },
);

export { router as antivenomCentersRouter };
