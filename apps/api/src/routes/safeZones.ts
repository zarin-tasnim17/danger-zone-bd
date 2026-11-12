import { Router } from 'express';
import { z } from 'zod';
import { SAFE_ZONE_TYPES } from '@repo/shared';
import {
  getSafeZonesHandler,
  createSafeZoneHandler,
  deleteSafeZoneHandler,
} from '../controllers/safeZoneController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

const coordParam = (min: number, max: number, label: string) =>
  z.string().trim().refine((val) => {
    if (!/^-?\d+(?:\.\d+)?$/.test(val)) return false;
    const num = Number(val);
    return Number.isFinite(num) && num >= min && num <= max;
  }, `${label} must be a valid number between ${min} and ${max}`);

const radiusParam = z.string().trim().refine((val) => {
  if (!/^\d+(?:\.\d+)?$/.test(val)) return false;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 && num <= 500000;
}, 'radius must be a positive number up to 500000 meters');

const safeZoneQuerySchema = z.object({
  query: z.object({
    minLng: coordParam(-180, 180, 'minLng').optional(),
    minLat: coordParam(-90, 90, 'minLat').optional(),
    maxLng: coordParam(-180, 180, 'maxLng').optional(),
    maxLat: coordParam(-90, 90, 'maxLat').optional(),
    lat: coordParam(-90, 90, 'lat').optional(),
    lng: coordParam(-180, 180, 'lng').optional(),
    radius: radiusParam.optional(),
    type: z.enum(SAFE_ZONE_TYPES).optional(),
  }).passthrough().superRefine((q, ctx) => {
    const hasBboxAny = q.minLng !== undefined || q.minLat !== undefined || q.maxLng !== undefined || q.maxLat !== undefined;
    const hasBboxAll = q.minLng !== undefined && q.minLat !== undefined && q.maxLng !== undefined && q.maxLat !== undefined;
    if (hasBboxAny && !hasBboxAll) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'All bounding box coordinates (minLng, minLat, maxLng, maxLat) must be provided together',
      });
    }
    if (hasBboxAll && (Number(q.minLng) >= Number(q.maxLng) || Number(q.minLat) >= Number(q.maxLat))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Inverted bounding box: minLng must be less than maxLng and minLat must be less than maxLat',
      });
    }
    const hasPointAny = q.lat !== undefined || q.lng !== undefined;
    const hasPointAll = q.lat !== undefined && q.lng !== undefined;
    if (hasPointAny && !hasPointAll) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Both lat and lng must be provided together for proximity queries',
      });
    }
  }),
});

const createSafeZoneSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    type: z.enum(SAFE_ZONE_TYPES),
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
