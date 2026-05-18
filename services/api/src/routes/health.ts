import { Router, type Request, type Response } from 'express';
import { HealthResponseSchema } from '@ishvenom/shared-types';

const router: Router = Router();

const STARTED_AT = Date.now();
const VERSION = '0.1.0';

router.get('/health', (_req: Request, res: Response) => {
  const body = HealthResponseSchema.parse({
    ok: true as const,
    version: VERSION,
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
  });
  res.status(200).json(body);
});

export { router as healthRouter };
