import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import {
  createZoneHandler,
  getZonesHandler,
  deleteZoneHandler,
  subscribePushHandler,
} from '../controllers/alertController';

const router = Router();

const createZoneSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Zone name is required').max(100, 'Zone name cannot exceed 100 characters'),
    coordinates: z
      .array(
        z.tuple([
          z.number().min(-180).max(180),
          z.number().min(-90).max(90),
        ])
      )
      .min(4, 'Polygon must contain at least 4 coordinate pairs (closed ring)'),
  }).strict(),
});

const deleteZoneSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid zone UUID is required' }),
  }).passthrough(),
});

const subscribePushSchema = z.object({
  body: z.object({
    endpoint: z.string().url({ message: 'Valid push service endpoint URL is required' }),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .optional(),
  }).passthrough(),
});

router.post('/zones', requireAuth, validateRequest(createZoneSchema), createZoneHandler);
router.get('/zones', requireAuth, getZonesHandler);
router.delete('/zones/:id', requireAuth, validateRequest(deleteZoneSchema), deleteZoneHandler);
router.post('/subscribe', requireAuth, validateRequest(subscribePushSchema), subscribePushHandler);

export default router;
