import { Router } from 'express';
import { z } from 'zod';
import { calculateSafeRouteHandler } from '../controllers/routingController';
import { validateRequest } from '../middleware/validateRequest';
import { safeRouteRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const safeRouteSchema = z.object({
  body: z.object({
    startLat: z.number().min(-90).max(90),
    startLng: z.number().min(-180).max(180),
    endLat: z.number().min(-90).max(90),
    endLng: z.number().min(-180).max(180),
  }).strict(),
});

// Safe Route Pathfinding endpoint
router.post('/safe-path', safeRouteRateLimiter, validateRequest(safeRouteSchema), calculateSafeRouteHandler);

export default router;
