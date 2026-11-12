import { Router } from 'express';
import { createReport, getReports, getReportById, resolveReportHandler } from '../controllers/reportController';
import { voteOnReport } from '../controllers/voteController';
import { addUpdateHandler, getUpdatesHandler } from '../controllers/reportUpdateController';
import { requireAuth, optionalAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import { REPORT_CATEGORIES } from '@repo/shared';

import { reportCreationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const parseFiniteHeaderNumber = (val: string): number => {
  const trimmed = val.trim();
  return trimmed.length === 0 ? Number.NaN : Number(trimmed);
};

const optionalCoordHeader = (min: number, max: number, label: string) =>
  z
    .string()
    .refine((val) => {
      const num = parseFiniteHeaderNumber(val);
      return Number.isFinite(num) && num >= min && num <= max;
    }, `${label} must be a valid number between ${min} and ${max}`)
    .optional();

const reportSchema = z.object({
  body: z.object({
    category: z.enum(REPORT_CATEGORIES),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    description: z.string().optional(),
  }).strict(),
  headers: z.object({
    'x-device-lat': optionalCoordHeader(-90, 90, 'x-device-lat'),
    'x-device-lng': optionalCoordHeader(-180, 180, 'x-device-lng'),
    'x-device-accuracy': z
      .string()
      .refine((val) => {
        const num = parseFiniteHeaderNumber(val);
        return Number.isFinite(num) && num >= 0;
      }, 'x-device-accuracy must be a non-negative number string')
      .optional(),
    'x-gps-source': z.enum(['hardware', 'manual']).optional(),
  }).passthrough().refine(
    (headers) => (headers['x-device-lat'] === undefined) === (headers['x-device-lng'] === undefined),
    { message: 'x-device-lat and x-device-lng must both be provided together or both omitted' }
  )
});

const boundsSchema = z.object({
  query: z.object({
    minLng: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    minLat: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    maxLng: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    maxLat: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    category: z.enum(REPORT_CATEGORIES).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    isNightReport: z.enum(['true', 'false']).optional(),
  }).passthrough()
});

const reportIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid report UUID is required' })
  }).passthrough()
});

const voteSchema = z.object({
  body: z.object({
    voteType: z.literal(1).or(z.literal(-1))
  }).strict(),
  params: z.object({
    id: z.string().uuid()
  }).passthrough()
});

const addUpdateSchema = z.object({
  body: z.object({
    content: z.string().min(2, 'Update must be at least 2 characters').max(500, 'Update cannot exceed 500 characters')
  }).strict(),
  params: z.object({
    id: z.string().uuid({ message: 'Valid report UUID is required' })
  }).passthrough()
});

router.post('/', requireAuth, reportCreationRateLimiter, validateRequest(reportSchema), createReport);
router.get('/', validateRequest(boundsSchema), getReports);
router.get('/:id', optionalAuth, validateRequest(reportIdSchema), getReportById);
router.patch('/:id/resolve', requireAuth, validateRequest(reportIdSchema), resolveReportHandler);
router.post('/:id/vote', requireAuth, validateRequest(voteSchema), voteOnReport);

// Threaded Context Updates for active incidents
router.post('/:id/updates', requireAuth, validateRequest(addUpdateSchema), addUpdateHandler);
router.get('/:id/updates', validateRequest(reportIdSchema), getUpdatesHandler);

export default router;
