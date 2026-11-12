import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { errorResponse } from '../utils/responseFormatter';

export const timingSafeStringCompare = (expected: string, provided: string): boolean => {
  // Compare fixed 32-byte SHA-256 digests so timingSafeEqual never throws RangeError or leaks secret length
  const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
  const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
  return crypto.timingSafeEqual(expectedDigest, providedDigest);
};

/**
 * Verifies the shared `x-webhook-secret` header for incoming storage webhook callbacks.
 * Strictly fails closed (401 Unauthorized) whenever `STORAGE_WEBHOOK_SECRET` is unset,
 * empty, missing from the request headers, or invalid.
 */
export const verifyStorageWebhookSecret = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const configuredSecret =
    'STORAGE_WEBHOOK_SECRET' in process.env
      ? process.env.STORAGE_WEBHOOK_SECRET
      : env.STORAGE_WEBHOOK_SECRET;
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    console.warn('[Webhook Auth] STORAGE_WEBHOOK_SECRET is not configured; failing closed.');
    return errorResponse(res, 'Unauthorized: Missing or invalid webhook secret', 401);
  }

  const rawHeader = req.headers['x-webhook-secret'];
  if (typeof rawHeader !== 'string' || rawHeader.length === 0) {
    return errorResponse(res, 'Unauthorized: Missing or invalid webhook secret', 401);
  }

  if (!timingSafeStringCompare(configuredSecret, rawHeader)) {
    return errorResponse(res, 'Unauthorized: Missing or invalid webhook secret', 401);
  }

  return next();
};

/**
 * Verifies incoming automated cron trigger headers (`x-cron-secret` or `Authorization: Bearer <secret>`).
 * Strictly fails closed (401 Unauthorized) whenever `CRON_SECRET` is unset, empty, missing, or invalid.
 */
export const verifyCronSecret = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const rawConfiguredSecret =
    'CRON_SECRET' in process.env ? process.env.CRON_SECRET : env.CRON_SECRET;
  const configuredSecret = rawConfiguredSecret?.trim();

  if (!configuredSecret) {
    console.warn('[Cron Auth] CRON_SECRET is not configured; failing closed.');
    return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
  }

  const cronHeader = req.headers['x-cron-secret'];
  const authHeader = req.headers['authorization'];

  const matchesCronHeader =
    typeof cronHeader === 'string' &&
    cronHeader.length > 0 &&
    timingSafeStringCompare(configuredSecret, cronHeader);

  const matchesBearerHeader =
    typeof authHeader === 'string' &&
    authHeader.startsWith('Bearer ') &&
    authHeader.length > 'Bearer '.length &&
    timingSafeStringCompare(configuredSecret, authHeader.slice('Bearer '.length));

  if (!matchesCronHeader && !matchesBearerHeader) {
    return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
  }

  return next();
};
