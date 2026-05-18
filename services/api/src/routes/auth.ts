/**
 * Auth routes for dashboard users.
 *
 * POST /api/v1/auth/register — create a new account (locked behind an
 *                              invite token in production; see env.ts)
 * POST /api/v1/auth/login    — exchange email + password for a session token
 * POST /api/v1/auth/logout   — invalidate the current session
 * GET  /api/v1/auth/me       — return the authenticated user's profile
 *
 * Registration is throttled by `writeLimiter` to blunt credential stuffing.
 * Login is additionally throttled per-IP by the same limiter.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  generateSession,
  hashPassword,
  hashToken,
  parseBearer,
  verifyPassword,
} from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { logger } from '../lib/logger.js';

const router: Router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  inviteToken: z.string().optional(),
});

router.post(
  '/auth/register',
  writeLimiter,
  async (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: 'Body failed validation',
          details: parsed.error.flatten(),
        },
      });
      return;
    }

    // In production, require a valid invite token.
    if (env.NODE_ENV === 'production') {
      if (parsed.data.inviteToken !== env.REGISTRATION_INVITE_TOKEN) {
        res.status(403).json({
          error: {
            code: 'forbidden',
            message: 'Registration requires a valid invite token',
          },
        });
        return;
      }
    }

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await prisma.user.create({
        data: {
          email: parsed.data.email.toLowerCase(),
          passwordHash,
          role: 'HEALTH_OFFICER',
        },
        select: { id: true, email: true, role: true, createdAt: true },
      });
      logger.info({ userId: user.id }, 'New user registered');
      res.status(201).json({ user });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        res.status(409).json({
          error: {
            code: 'conflict',
            message: 'Email already in use',
          },
        });
        return;
      }
      throw err;
    }
  },
);

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/auth/login', writeLimiter, async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'Body failed validation',
      },
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  // Always run verifyPassword even if user is null, to avoid timing attacks.
  const stored = user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$invalid';
  const ok = await verifyPassword(parsed.data.password, stored);

  if (!user || !ok) {
    res.status(401).json({
      error: {
        code: 'invalid_credentials',
        message: 'Invalid email or password',
      },
    });
    return;
  }

  const session = generateSession();
  await prisma.session.create({
    data: {
      id: session.id,
      userId: user.id,
      expiresAt: session.expiresAt,
    },
  });

  logger.info({ userId: user.id }, 'User logged in');
  res.status(200).json({
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: { id: user.id, email: user.email, role: user.role },
  });
});

router.post('/auth/logout', async (req: Request, res: Response) => {
  const token = parseBearer(req.headers.authorization);
  if (!token) {
    res.status(204).end();
    return;
  }
  const id = hashToken(token);
  await prisma.session.delete({ where: { id } }).catch(() => {
    // Token either expired or never existed — either way, logout is a no-op.
  });
  res.status(204).end();
});

router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

export { router as authRouter };
