import { Router } from 'express';
import { createReport, getReports, getReportById, resolveReportHandler } from '../controllers/reportController';
import { voteOnReport } from '../controllers/voteController';
import { addUpdateHandler, getUpdatesHandler } from '../controllers/reportUpdateController';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

import { reportCreationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const reportSchema = z.object({
  body: z.object({
    category: z.enum(['MUGGING', 'THEFT', 'UNLIT_ROAD', 'EXTORTION', 'DRUG_ACTIVITY']),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    description: z.string().optional(),
  }).strict(),
  headers: z.object({
    'x-device-lat': z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    'x-device-lng': z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string")
  }).passthrough()
});

const boundsSchema = z.object({
  query: z.object({
    minLng: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    minLat: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    maxLng: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    maxLat: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a number string"),
    category: z.enum(['MUGGING', 'THEFT', 'UNLIT_ROAD', 'EXTORTION', 'DRUG_ACTIVITY']).optional(),
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
router.get('/:id', validateRequest(reportIdSchema), getReportById);
router.patch('/:id/resolve', requireAuth, validateRequest(reportIdSchema), resolveReportHandler);
router.post('/:id/vote', requireAuth, validateRequest(voteSchema), voteOnReport);

// Threaded Context Updates for active incidents
router.post('/:id/updates', requireAuth, validateRequest(addUpdateSchema), addUpdateHandler);
router.get('/:id/updates', validateRequest(reportIdSchema), getUpdatesHandler);

export default router;
