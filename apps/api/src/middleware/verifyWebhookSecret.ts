import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { errorResponse } from '../utils/responseFormatter';

const timingSafeStringCompare = (expected: string, provided: string): boolean => {
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
