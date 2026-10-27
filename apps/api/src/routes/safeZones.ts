import { Router } from 'express';
import { z } from 'zod';
import {
  getSafeZonesHandler,
  createSafeZoneHandler,
  deleteSafeZoneHandler,
} from '../controllers/safeZoneController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

const safeZoneQuerySchema = z.object({
  query: z.object({
    minLng: z.string().optional(),
    minLat: z.string().optional(),
    maxLng: z.string().optional(),
    maxLat: z.string().optional(),
    lat: z.string().optional(),
    lng: z.string().optional(),
    radius: z.string().optional(),
    type: z.enum(['HOSPITAL', 'POLICE_BOX', 'PHARMACY']).optional(),
  }).passthrough(),
});

const createSafeZoneSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    type: z.enum(['HOSPITAL', 'POLICE_BOX', 'PHARMACY']),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).strict(),
});

const safeZoneIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid UUID is required' }),
  }).passthrough(),
});

// Public safe zones lookup
router.get('/', validateRequest(safeZoneQuerySchema), getSafeZonesHandler);

// Admin-only safe zone creation
router.post('/', requireAuth, requireRole(['ADMIN']), validateRequest(createSafeZoneSchema), createSafeZoneHandler);

// Admin-only safe zone deletion
router.delete('/:id', requireAuth, requireRole(['ADMIN']), validateRequest(safeZoneIdSchema), deleteSafeZoneHandler);

export default router;
