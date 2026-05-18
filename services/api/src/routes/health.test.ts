import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { HealthResponseSchema } from '@ishvenom/shared-types';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('returns 200 with a valid HealthResponse', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    const parsed = HealthResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ok).toBe(true);
      expect(parsed.data.version).toMatch(/^\d+\.\d+\.\d+/);
    }
  });
});
