import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

const ipRequestMap = new Map<string, RateLimitRecord>();

// Clean up stale IP records every 10 minutes to prevent memory leak without holding the event loop open
const cleanupTimer = setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [ip, record] of ipRequestMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > oneHourAgo);
    if (record.timestamps.length === 0) {
      ipRequestMap.delete(ip);
    }
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

/**
 * In-memory sliding window rate limiter middleware.
 * Restricts number of requests per IP over a specified time window.
 */
export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}) => {
  const { windowMs, maxRequests, message, keyPrefix } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Rely on Express proxy-aware req.ip (never parse raw spoofable X-Forwarded-For headers)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = keyPrefix ? `${keyPrefix}:${clientIp}` : clientIp;

    const now = Date.now();
    const record = ipRequestMap.get(key) || { timestamps: [] };

    // Discard timestamps outside window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    if (record.timestamps.length >= maxRequests) {
      const oldest = record.timestamps[0];
      const waitSeconds = Math.ceil((windowMs - (now - oldest)) / 1000);

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            message ||
            `Rate limit exceeded. Too many requests from this IP. Please try again in ${waitSeconds} seconds.`,
          retryAfterSeconds: waitSeconds,
        },
      });
    }

    record.timestamps.push(now);
    ipRequestMap.set(key, record);
    next();
  };
};

/**
 * Standard public report submission rate limiter (Max 5 reports per hour per IP)
 */
export const reportCreationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Anti-Abuse Protection: Maximum 5 incident reports per hour per device/IP address.',
  keyPrefix: 'report-creation',
});

/**
 * Authentication brute-force protection for password login (Max 10 attempts per 15 minutes per IP)
 */
export const authLoginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  keyPrefix: 'auth-login',
});

/**
 * Automated cron endpoint protection (Max 2 requests per 10 minutes per IP)
 */
export const cronNewsCrawlRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 2,
  message: 'Anti-Abuse Protection: Cron news crawler can be triggered at most 2 times every 10 minutes.',
  keyPrefix: 'cron-news-crawl',
});

/**
 * Anonymous device session bootstrap/resume protection (Max 20 requests per 15 minutes per IP)
 */
export const authDeviceRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many device authentication requests. Please try again shortly.',
  keyPrefix: 'auth-device',
});

/**
 * Session refresh protection (Max 30 requests per 15 minutes per IP)
 */
export const authRefreshRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many session refresh attempts. Please try again shortly.',
  keyPrefix: 'auth-refresh',
});

/**
 * Community voting anti-flood protection (Max 60 votes per 15 minutes per IP)
 */
export const reportVoteRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 60,
  message: 'Too many vote submissions. Please slow down and try again shortly.',
  keyPrefix: 'report-vote',
});

/**
 * Threaded incident update anti-spam protection (Max 20 updates per 15 minutes per IP)
 */
export const reportUpdateRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many incident updates submitted. Please try again shortly.',
  keyPrefix: 'report-update',
});

/**
 * KYC verification submission protection (Max 10 requests per 15 minutes per IP)
 */
export const userVerifyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many verification submissions. Please try again later.',
  keyPrefix: 'user-verify',
});

/**
 * Spatial safe-path computation protection (Max 120 requests per minute per IP)
 */
export const safeRouteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'Too many safe-route calculations. Please wait a moment and try again.',
  keyPrefix: 'safe-route',
});
