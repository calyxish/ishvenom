import { z } from 'zod';
import 'dotenv/config';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32).default('dev-only-change-me-dev-only-change-me'),
  REDIS_URL: z.string().url().optional(),

  // Phase 5 additions
  REGISTRATION_INVITE_TOKEN: z
    .string()
    .min(16, 'REGISTRATION_INVITE_TOKEN must be at least 16 chars in production')
    .default('dev-only-invite-token-do-not-use-in-prod'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Cloud inference — optional. When neither RunPod nor Google AI credentials
  // are present, sit-report generation is disabled gracefully (rows are
  // created with status='failed', cloud_unavailable reason).
  //
  // Resolution order at startup (see services/api/src/index.ts):
  //   1. RunPod (if both RUNPOD_* set) — preferred for production scale
  //   2. Google AI Gemma 4 (if GOOGLE_AI_KEY set) — simple fallback, no
  //      worker to deploy
  //   3. Disabled
  RUNPOD_API_KEY: z.string().optional(),
  RUNPOD_ENDPOINT_ID: z.string().optional(),
  GOOGLE_AI_KEY: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment variables:',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

// Production-only guards. We allow the default invite token in dev/test so
// local `pnpm dev` boots with no setup, but refuse to start in production
// without a real secret.
if (parsed.data.NODE_ENV === 'production') {
  if (parsed.data.SESSION_SECRET === 'dev-only-change-me-dev-only-change-me') {
    // eslint-disable-next-line no-console
    console.error('❌ SESSION_SECRET must be set in production');
    process.exit(1);
  }
  if (
    parsed.data.REGISTRATION_INVITE_TOKEN ===
    'dev-only-invite-token-do-not-use-in-prod'
  ) {
    // eslint-disable-next-line no-console
    console.error('❌ REGISTRATION_INVITE_TOKEN must be set in production');
    process.exit(1);
  }
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
