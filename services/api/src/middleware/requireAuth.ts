/**
 * requireAuth middleware.
 *
 * Reads the Bearer token from Authorization, hashes it, looks up the
 * matching session, and attaches `req.user` + `req.session` on success.
 * On failure, responds 401 with an ErrorResponseSchema body.
 */
import type { NextFunction, Request, Response } from 'express';
import { hashToken, isSessionExpired, parseBearer } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      session?: {
        id: string;
        expiresAt: Date;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = parseBearer(req.headers.authorization);
  if (!token) {
    res.status(401).json({
      error: { code: 'unauthorized', message: 'Missing bearer token' },
    });
    return;
  }

  const id = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!session) {
    res.status(401).json({
      error: { code: 'unauthorized', message: 'Invalid session' },
    });
    return;
  }

  if (isSessionExpired(session)) {
    logger.info({ sessionId: session.id }, 'Rejecting expired session');
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {
      /* best effort cleanup */
    });
    res.status(401).json({
      error: { code: 'session_expired', message: 'Session expired' },
    });
    return;
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
  req.session = { id: session.id, expiresAt: session.expiresAt };
  next();
}

/**
 * requireRole — use AFTER requireAuth to gate on role.
 *
 *     router.get('/foo', requireAuth, requireRole(['ADMIN']), handler);
 */
export function requireRole(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'unauthorized', message: 'Not authenticated' },
      });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'forbidden',
          message: `Requires one of: ${allowed.join(', ')}`,
        },
      });
      return;
    }
    next();
  };
}
