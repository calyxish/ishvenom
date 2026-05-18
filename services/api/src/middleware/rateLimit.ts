/**
 * Rate limiting buckets.
 *
 * Three tiers, from most restrictive to least:
 *
 *   writeLimiter    — unauthenticated writes (login attempts, encounter
 *                     batch uploads). 30 req/15 min per IP.
 *   publicLimiter   — cheap public reads (species, antivenom centers).
 *                     300 req/15 min per IP.
 *   authLimiter     — dashboard reads that require a session. 600 req/15
 *                     min per IP (because a single dashboard user can
 *                     legitimately hit the API a lot).
 *
 * All limiters can be swapped for a Redis-backed store in production by
 * passing `store` — left out here to keep local dev dependency-free.
 */
import rateLimit from 'express-rate-limit';

const FIFTEEN_MIN = 15 * 60 * 1000;

export const writeLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many writes. Please try again in a few minutes.',
    },
  },
});

export const publicLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Too many requests' },
  },
});

export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Too many requests' },
  },
});
