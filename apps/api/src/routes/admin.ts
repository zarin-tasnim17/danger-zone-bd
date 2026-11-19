import { Router, Request, Response } from 'express';
import { ModerationAction, ReportCategory, ReportSeverity, ReportStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';
import { successResponse } from '../utils/responseFormatter';
import { newsObservabilityService } from '../services/newsObservabilityService';
import { verifyReport, reclassifyReport } from '../services/adminService';
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
  getUsersHandler,
  getAdminReportsHandler,
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

const userBanReasonSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .min(3, { message: 'Reason must be at least 3 characters' })
      .max(500, { message: 'Reason cannot exceed 500 characters' }),
  }).strict(),
  params: z.object({
    id: z.string().min(1, { message: 'User identifier is required' }).max(120),
  }).passthrough(),
});

const approveSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid UUID is required' }),
  }).passthrough(),
});

const usersQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    role: z.nativeEnum(Role).optional(),
    isBanned: z.enum(['true', 'false']).optional(),
    isVerified: z.enum(['true', 'false']).optional(),
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
    sortBy: z.enum(['createdAt', 'trustScore', 'lastReportAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).strict(),
});

const adminReportsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(100).optional(),
    category: z.nativeEnum(ReportCategory).optional(),
    severity: z.nativeEnum(ReportSeverity).optional(),
    status: z.nativeEnum(ReportStatus).optional(),
    userId: z.string().uuid().optional(),
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
  }).strict(),
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

const verifyReportSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid UUID is required' }),
  }).passthrough(),
  body: z.object({
    reason: z
      .string()
      .min(3, { message: 'Reason must be at least 3 characters' })
      .max(500, { message: 'Reason cannot exceed 500 characters' })
      .optional(),
  }).strict().optional(),
});

const reclassifyReportSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Valid UUID is required' }),
  }).passthrough(),
  body: z
    .object({
      category: z.nativeEnum(ReportCategory).optional(),
      severity: z.nativeEnum(ReportSeverity).optional(),
      reason: z.string().max(500).optional(),
    })
    .strict()
    .refine((data) => data.category !== undefined || data.severity !== undefined, {
      message: 'At least one of category or severity must be provided',
    }),
});

// All routes require authentication and ADMIN role
router.use(requireAuth, requireRole(['ADMIN']));

router.get('/users', validateRequest(usersQuerySchema), getUsersHandler);
router.post('/users/:id/ban', validateRequest(userBanReasonSchema), banUserHandler);
router.post('/users/:id/unban', validateRequest(userBanReasonSchema), unbanUserHandler);

router.get('/reports', validateRequest(adminReportsQuerySchema), getAdminReportsHandler);
router.post('/reports/:id/purge', validateRequest(reasonSchema), purgeReportHandler);
router.patch('/reports/:id/verify', validateRequest(verifyReportSchema), async (req: Request, res: Response, next) => {
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    const reason = req.body?.reason || 'Incident verified by administrator';
    const result = await verifyReport(adminId, id, reason);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
});
router.patch('/reports/:id/reclassify', validateRequest(reclassifyReportSchema), async (req: Request, res: Response, next) => {
  try {
    const adminId = (req as any).user.id;
    const { id } = req.params;
    const { category, severity, reason } = req.body;
    const result = await reclassifyReport(adminId, id, { category, severity, reason });
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
});
router.get('/logs', validateRequest(logsQuerySchema), getLogsHandler);
router.get('/analytics/trends', validateRequest(trendsQuerySchema), getTrendsHandler);
router.get('/verifications', getVerificationsHandler);
router.post('/verifications/:id/approve', validateRequest(approveSchema), approveVerificationHandler);
router.post('/verifications/:id/reject', validateRequest(reasonSchema), rejectVerificationHandler);
router.post('/news/crawl', triggerNewsCrawlHandler);
router.get('/crawler-metrics', (_req: Request, res: Response) => {
  const telemetry = newsObservabilityService.getTelemetrySummary();
  return successResponse(res, telemetry, 200);
});

export default router;
