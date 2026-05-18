import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import type { ErrorResponse } from '@ishvenom/shared-types';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const body: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed validation.',
        details: err.flatten(),
      },
    };
    res.status(400).json(body);
    return;
  }

  logger.error({ err }, 'Unhandled error');
  const body: ErrorResponse = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
  };
  res.status(500).json(body);
}
