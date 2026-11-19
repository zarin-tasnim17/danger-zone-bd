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

export const DEFAULT_CRON_SECRET = 'danger-zone-bd-cron-crawler-secret-2026';

/**
 * Verifies incoming automated cron trigger headers (`Authorization: Bearer <secret>`).
 * Strictly fails closed (401 Unauthorized):
 * - Rejects query parameter tokens (?key=..., ?secret=..., ?cron_secret=...).
 * - In production (NODE_ENV === 'production'), if CRON_SECRET is unset or empty, immediately rejects with 401 (never falls back to DEFAULT_CRON_SECRET).
 * - Enforces constant-time comparison via timingSafeStringCompare.
 */
export const verifyCronSecret = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Strictly reject query parameter tokens
  if (
    req.query.key !== undefined ||
    req.query.secret !== undefined ||
    req.query.cron_secret !== undefined
  ) {
    return errorResponse(
      res,
      'Unauthorized: Query parameter authentication is forbidden. Use Authorization: Bearer <secret>',
      401
    );
  }

  // 2. In production, fail-closed if CRON_SECRET is unset or empty (do not fallback to DEFAULT_CRON_SECRET)
  const isProduction = process.env.NODE_ENV === 'production';
  const processSecret = process.env.CRON_SECRET?.trim();

  if (isProduction) {
    if (!processSecret || processSecret.length === 0) {
      console.warn('[Cron Auth] CRON_SECRET is unconfigured in production environment; failing closed.');
      return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
    }
  }

  const configuredSecret = processSecret || env.CRON_SECRET?.trim() || DEFAULT_CRON_SECRET;
  if (!configuredSecret || configuredSecret.length === 0) {
    return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
  }

  // 3. Extract Bearer token from Authorization header (or x-cron-secret for legacy test compatibility)
  const authHeader = req.headers['authorization'];
  const cronHeader = req.headers['x-cron-secret'];

  let providedToken: string | null = null;

  if (typeof authHeader === 'string') {
    if (!authHeader.startsWith('Bearer ') || authHeader.length <= 'Bearer '.length) {
      return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
    }
    providedToken = authHeader.slice('Bearer '.length).trim();
  } else if (typeof cronHeader === 'string' && cronHeader.trim().length > 0) {
    providedToken = cronHeader.trim();
  }

  if (!providedToken || providedToken.length === 0) {
    return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
  }

  // 4. Constant-time digest comparison
  const effectiveSecret = isProduction ? (processSecret as string) : configuredSecret;
  if (!timingSafeStringCompare(effectiveSecret, providedToken)) {
    return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
  }

  return next();
};
