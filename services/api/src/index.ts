import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { gracefulShutdown } from './lib/prisma.js';
import { createSitReportClient } from './lib/sitReportClient.js';
import { createGoogleAiSitReportClient } from './lib/googleAiSitReportClient.js';
import { setSitReportClient } from './routes/sitReports.js';

const app = createApp();

// ── Cloud inference client wiring ────────────────────────────────────
// Preference order:
//   1. RunPod (queue + poll, scales to dedicated GPU workers).
//   2. Google AI Gemma 4 (synchronous REST, easier ops, smaller token quotas).
// When neither is configured the route still works — sit-reports are
// created with status='failed' and a cloud_unavailable reason, which is
// fine for local dev and CI.

if (env.RUNPOD_API_KEY && env.RUNPOD_ENDPOINT_ID) {
  const client = createSitReportClient({
    apiKey: env.RUNPOD_API_KEY,
    endpointId: env.RUNPOD_ENDPOINT_ID,
  });
  setSitReportClient(client);
  logger.info(
    { endpointId: env.RUNPOD_ENDPOINT_ID },
    'RunPod sit-report client initialized',
  );
} else if (env.GOOGLE_AI_KEY) {
  const client = createGoogleAiSitReportClient({
    apiKey: env.GOOGLE_AI_KEY,
  });
  setSitReportClient(client);
  logger.info(
    { provider: 'google-ai', model: 'gemma-4-26b-a4b-it' },
    'Google AI Gemma 4 sit-report client initialized',
  );
} else {
  logger.warn(
    'No cloud inference client configured (set RUNPOD_* or GOOGLE_AI_KEY) — sit-report generation disabled',
  );
}

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, '🐍 IshVenom API listening');
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(async () => {
    await gracefulShutdown();
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after 10s');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
