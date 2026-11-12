import { Router, Request, Response } from 'express';
import { triggerNewsCrawler } from '../jobs/newsCrawlerJob';
import { cronNewsCrawlRateLimiter } from '../middleware/rateLimiter';
import { verifyCronSecret } from '../middleware/verifyWebhookSecret';
import { successResponse, errorResponse } from '../utils/responseFormatter';

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
  .get(cronNewsCrawlRateLimiter, verifyCronSecret, handleNewsCrawl)
  .post(cronNewsCrawlRateLimiter, verifyCronSecret, handleNewsCrawl);

export default router;
