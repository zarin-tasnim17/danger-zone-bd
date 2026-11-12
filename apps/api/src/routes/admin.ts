import { Router } from 'express';
import { ModerationAction } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';
import {
  banUserHandler,
  unbanUserHandler,
  purgeReportHandler,
  getLogsHandler,
  getTrendsHandler,
  getVerificationsHandler,
  approveVerificationHandler,
  rejectVerificationHandler,
  triggerNewsCrawlHandler,
} from '../controllers/adminController';

const router = Router();

// Validation Schemas
const reasonSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, { message: 'Reason must be at least 3 characters' })
      .max(500, { message: 'Reason cannot exceed 500 characters' }),
  }).strict(),
  params: z.object({
    id: z.string().uuid({ message: 'Valid UUID is required' }),
  }).passthrough(),
});

const approveSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid UUID is required' }),
  }).passthrough(),
});

const logsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, 'page must be a positive integer')
      .optional(),
    limit: z
      .string()
      .trim()
      .regex(/^[1-9]\d*$/, 'limit must be a positive integer between 1 and 100')
      .refine((val) => Number(val) >= 1 && Number(val) <= 100, 'limit must be between 1 and 100')
      .optional(),
    action: z.nativeEnum(ModerationAction).optional(),
  }).strict(),
});

const trendsQuerySchema = z.object({
  query: z.object({}).strict(),
});

// All routes require authentication and ADMIN role
router.use(requireAuth, requireRole(['ADMIN']));

router.post('/users/:id/ban', validateRequest(reasonSchema), banUserHandler);
router.post('/users/:id/unban', validateRequest(reasonSchema), unbanUserHandler);
router.post('/reports/:id/purge', validateRequest(reasonSchema), purgeReportHandler);
router.get('/logs', validateRequest(logsQuerySchema), getLogsHandler);
router.get('/analytics/trends', validateRequest(trendsQuerySchema), getTrendsHandler);
router.get('/verifications', getVerificationsHandler);
router.post('/verifications/:id/approve', validateRequest(approveSchema), approveVerificationHandler);
router.post('/verifications/:id/reject', validateRequest(reasonSchema), rejectVerificationHandler);
router.post('/news/crawl', triggerNewsCrawlHandler);

export default router;
