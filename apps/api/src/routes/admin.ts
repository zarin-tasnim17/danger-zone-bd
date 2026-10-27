import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';
import {
  banUserHandler,
  unbanUserHandler,
  purgeReportHandler,
  getLogsHandler,
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

const logsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }).passthrough(),
});

// All routes require authentication and ADMIN role
router.use(requireAuth, requireRole(['ADMIN']));

router.post('/users/:id/ban', validateRequest(reasonSchema), banUserHandler);
router.post('/users/:id/unban', validateRequest(reasonSchema), unbanUserHandler);
router.post('/reports/:id/purge', validateRequest(reasonSchema), purgeReportHandler);
router.get('/logs', validateRequest(logsQuerySchema), getLogsHandler);

export default router;
