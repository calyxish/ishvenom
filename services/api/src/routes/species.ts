/**
 * GET /api/v1/species        — full catalog (for mobile SQLite seed)
 * GET /api/v1/species/:name  — one species by scientific name
 *
 * The catalog is small (~20 rows) so we don't paginate. Clients
 * download-once and then refresh lazily using `If-Modified-Since`.
 */
import { Router, type Request, type Response } from 'express';
import { SpeciesSchema } from '@ishvenom/shared-types';
import { prisma } from '../lib/prisma.js';
import { publicLimiter } from '../middleware/rateLimit.js';

const router: Router = Router();

router.get('/species', publicLimiter, async (_req: Request, res: Response) => {
  const rows = await prisma.species.findMany({
    orderBy: { scientificName: 'asc' },
  });

  const body = rows.map((r) =>
    SpeciesSchema.parse({
      id: r.id,
      scientificName: r.scientificName,
      commonNames: r.commonNames,
      venomous: r.venomous,
      antivenomName: r.antivenomName,
      description: r.description ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
    }),
  );

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ species: body });
});

router.get(
  '/species/:name',
  publicLimiter,
  async (req: Request, res: Response) => {
    const row = await prisma.species.findUnique({
      where: { scientificName: req.params['name'] as string },
    });
    if (!row) {
      res.status(404).json({
        error: { code: 'not_found', message: 'Species not found' },
      });
      return;
    }
    const body = SpeciesSchema.parse({
      id: row.id,
      scientificName: row.scientificName,
      commonNames: row.commonNames,
      venomous: row.venomous,
      antivenomName: row.antivenomName,
      description: row.description ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
    });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(body);
  },
);

export { router as speciesRouter };
