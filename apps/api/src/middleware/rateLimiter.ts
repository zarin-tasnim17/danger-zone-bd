import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

const ipRequestMap = new Map<string, RateLimitRecord>();

// Clean up stale IP records every 10 minutes to prevent memory leak
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [ip, record] of ipRequestMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => t > oneHourAgo);
    if (record.timestamps.length === 0) {
      ipRequestMap.delete(ip);
    }
  }
}, 10 * 60 * 1000);

/**
 * In-memory sliding window rate limiter middleware.
 * Restricts number of requests per IP over a specified time window.
 */
export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) => {
  const { windowMs, maxRequests, message } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client IP
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const record = ipRequestMap.get(clientIp) || { timestamps: [] };

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
    ipRequestMap.set(clientIp, record);
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
});
