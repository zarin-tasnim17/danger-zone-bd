import { Router } from 'express';
import { createReport, getReports } from '../controllers/reportController';
import { voteOnReport } from '../controllers/voteController';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

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
  }).strict()
});

const voteSchema = z.object({
  body: z.object({
    voteType: z.literal(1).or(z.literal(-1))
  }).strict(),
  params: z.object({
    id: z.string().uuid()
  }).passthrough()
});

router.post('/', requireAuth, validateRequest(reportSchema), createReport);
router.get('/', validateRequest(boundsSchema), getReports);
router.post('/:id/vote', requireAuth, validateRequest(voteSchema), voteOnReport);

export default router;
