import { Router, Request, Response, NextFunction } from 'express';
import { triggerNewsCrawler } from '../jobs/newsCrawlerJob';
import { cronNewsCrawlRateLimiter } from '../middleware/rateLimiter';
import { verifyCronSecret } from '../middleware/verifyWebhookSecret';
import { extractAccessToken, verifyActiveAccessToken } from '../middleware/requireAuth';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import { newsObservabilityService } from '../services/newsObservabilityService';
import { ensureDatabaseSchema } from '../db/ensureSchema';

const router = Router();

/**
 * Middleware verifying either:
 * 1. Valid CRON_SECRET header (automated Vercel Cron jobs and server schedulers)
 * 2. An authenticated ADMIN user session (on-demand manual trigger fallback)
 * Fails closed with 401 Unauthorized if neither credential is valid.
 */
const verifyCronSecretOrAdmin = async (req: Request, res: Response, next: NextFunction) => {
  let isCronValid = false;
  const mockRes: any = {
    status() { return mockRes; },
    json() { return mockRes; },
  };

  verifyCronSecret(req, mockRes, () => {
    isCronValid = true;
  });

  if (isCronValid) {
    return next();
  }

  // Fallback: Check if request is authenticated as an administrator
  const token = extractAccessToken(req);
  if (token) {
    try {
      const user = await verifyActiveAccessToken(token);
      if (user && user.role === 'ADMIN') {
        req.user = user;
        return next();
      }
    } catch {
      // Fall through to 401
    }
  }

  return errorResponse(res, 'Unauthorized: Missing or invalid cron secret', 401);
};

/**
 * Endpoint called by Vercel Cron, external monitoring heartbeats, or admin triggers
 * to run the news crawler on-demand.
 * Wakes up sleeping server instances and executes fresh news ingestion.
 */
const handleNewsCrawl = async (_req: Request, res: Response) => {
  try {
    console.log('[Cron Route] 🌐 Received automated news crawl request...');
    // Ensure database columns activeTimeStart / activeTimeEnd are aligned
    await ensureDatabaseSchema();
    const result = await triggerNewsCrawler();

    return successResponse(
      res,
      {
        message: 'News crawler executed successfully',
        timestamp: new Date().toISOString(),
        ...result,
        telemetry: (result as any).telemetry || null,
      },
      200
    );
  } catch (error: any) {
    console.error('[Cron Route] ❌ News crawl execution failed:', error);
    return errorResponse(res, error.message || 'News crawler failed', 500);
  }
};

router
  .route('/news-crawl')
  .get(verifyCronSecretOrAdmin, cronNewsCrawlRateLimiter, handleNewsCrawl)
  .post(verifyCronSecretOrAdmin, cronNewsCrawlRateLimiter, handleNewsCrawl);

/**
 * Observability endpoint to inspect crawler telemetry and feed health metrics.
 */
router.get('/crawler-metrics', verifyCronSecret, (_req: Request, res: Response) => {
  const telemetry = newsObservabilityService.getTelemetrySummary();
  return successResponse(res, telemetry, 200);
});

export default router;
