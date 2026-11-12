import { Router } from 'express';
import { createReport, getReports, getReportById, resolveReportHandler } from '../controllers/reportController';
import { voteOnReport } from '../controllers/voteController';
import { addUpdateHandler, getUpdatesHandler } from '../controllers/reportUpdateController';
import { requireAuth, optionalAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';
import { REPORT_CATEGORIES } from '@repo/shared';

import {
  reportCreationRateLimiter,
  reportUpdateRateLimiter,
  reportVoteRateLimiter,
} from '../middleware/rateLimiter';

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
    description: z
      .string()
      .trim()
      .min(1, 'Description cannot be empty if provided')
      .max(1000, 'Description cannot exceed 1000 characters')
      .optional(),
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

const coordQueryParam = (min: number, max: number, label: string) =>
  z.string().trim().refine((val) => {
    if (!/^-?\d+(?:\.\d+)?$/.test(val)) return false;
    const num = Number(val);
    return Number.isFinite(num) && num >= min && num <= max;
  }, `${label} must be a valid number between ${min} and ${max}`);

const boundsSchema = z.object({
  query: z.object({
    minLng: coordQueryParam(-180, 180, 'minLng'),
    minLat: coordQueryParam(-90, 90, 'minLat'),
    maxLng: coordQueryParam(-180, 180, 'maxLng'),
    maxLat: coordQueryParam(-90, 90, 'maxLat'),
    category: z.enum(REPORT_CATEGORIES).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    isNightReport: z.enum(['true', 'false']).optional(),
  }).passthrough().refine(
    (q) => Number(q.minLng) < Number(q.maxLng) && Number(q.minLat) < Number(q.maxLat),
    { message: 'Inverted bounding box: minLng must be less than maxLng and minLat must be less than maxLat' }
  )
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
    content: z.string().trim().min(2, 'Update must be at least 2 characters').max(500, 'Update cannot exceed 500 characters')
  }).strict(),
  params: z.object({
    id: z.string().uuid({ message: 'Valid report UUID is required' })
  }).passthrough()
});

router.post('/', requireAuth, reportCreationRateLimiter, validateRequest(reportSchema), createReport);
router.get('/', validateRequest(boundsSchema), getReports);
router.get('/:id', optionalAuth, validateRequest(reportIdSchema), getReportById);
router.patch('/:id/resolve', requireAuth, validateRequest(reportIdSchema), resolveReportHandler);
router.post('/:id/vote', requireAuth, reportVoteRateLimiter, validateRequest(voteSchema), voteOnReport);

// Threaded Context Updates for active incidents
router.post('/:id/updates', requireAuth, reportUpdateRateLimiter, validateRequest(addUpdateSchema), addUpdateHandler);
router.get('/:id/updates', validateRequest(reportIdSchema), getUpdatesHandler);

export default router;
