import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { gracefulShutdown } from './lib/prisma.js';
import { createSitReportClient } from './lib/sitReportClient.js';
import { setSitReportClient } from './routes/sitReports.js';

const app = createApp();

// Wire cloud inference client if RunPod credentials are present.
// When absent the route still works — sit-reports are created with
// status='failed' and a cloud_unavailable reason, which is fine for
// local dev and CI. Production deployments set both env vars.
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
} else {
  logger.warn(
    'RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID not set — sit-report generation disabled',
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
