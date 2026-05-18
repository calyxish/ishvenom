import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import type { HttpLogger, Options as HttpLoggerOptions } from 'pino-http';
type PinoHttpFactory = (opts?: HttpLoggerOptions) => HttpLogger;
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';
import { encountersRouter } from './routes/encounters.js';
import { speciesRouter } from './routes/species.js';
import { antivenomCentersRouter } from './routes/antivenomCenters.js';
import { statsRouter } from './routes/stats.js';
import { authRouter } from './routes/auth.js';
import { sitReportsRouter } from './routes/sitReports.js';
import { errorHandler } from './middleware/error.js';

export function createApp(): Express {
  const app = express();

  // Trust the first proxy hop (Railway/Render/Vercel all add one).
  app.set('trust proxy', 1);

  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use((pinoHttp as unknown as PinoHttpFactory)({ logger }));

  // Public (Phase 1)
  app.use('/api/v1', healthRouter);

  // Phase 5 routes
  app.use('/api/v1', authRouter);
  app.use('/api/v1', encountersRouter);
  app.use('/api/v1', speciesRouter);
  app.use('/api/v1', antivenomCentersRouter);
  app.use('/api/v1', statsRouter);
  app.use('/api/v1', sitReportsRouter);

  app.use(errorHandler);

  return app;
}
