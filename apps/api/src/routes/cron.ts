import { Router, Request, Response } from 'express';
import { triggerNewsCrawler } from '../jobs/newsCrawlerJob';
import { cronNewsCrawlRateLimiter } from '../middleware/rateLimiter';
import { verifyCronSecret } from '../middleware/verifyWebhookSecret';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import { newsObservabilityService } from '../services/newsObservabilityService';

const router = Router();

/**
 * Endpoint called by Vercel Cron, external monitoring heartbeats, or admin triggers
 * to run the news crawler on-demand.
 * Wakes up sleeping server instances and executes fresh news ingestion.
 */
const handleNewsCrawl = async (_req: Request, res: Response) => {
  try {
    console.log('[Cron Route] 🌐 Received automated news crawl request...');
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
  .get(verifyCronSecret, cronNewsCrawlRateLimiter, handleNewsCrawl)
  .post(verifyCronSecret, cronNewsCrawlRateLimiter, handleNewsCrawl);

/**
 * Observability endpoint to inspect crawler telemetry and feed health metrics.
 */
router.get('/crawler-metrics', verifyCronSecret, (_req: Request, res: Response) => {
  const telemetry = newsObservabilityService.getTelemetrySummary();
  return successResponse(res, telemetry, 200);
});

export default router;
