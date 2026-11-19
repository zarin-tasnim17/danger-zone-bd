import { Request, Response, NextFunction } from 'express';
import { ModerationAction, ReportCategory, ReportSeverity, ReportStatus, Role } from '@prisma/client';
import {
  banUser,
  unbanUser,
  purgeReport,
  getModerationLogs,
  getHazardTrends,
  getAdminUsers,
  getAdminReports,
} from '../services/adminService';
import { getPendingVerifications, rejectVerification, approveVerification } from '../services/userService';
import { triggerNewsCrawler } from '../jobs';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const banUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await banUser(adminId, id, reason);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to ban user', statusCode);
  }
};

export const unbanUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await unbanUser(adminId, id, reason);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to unban user', statusCode);
  }
};

export const purgeReportHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await purgeReport(adminId, id, reason);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to purge report', statusCode);
  }
};

export const getLogsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPage = req.query.page as string | undefined;
    const rawLimit = req.query.limit as string | undefined;
    const action = req.query.action as ModerationAction | undefined;

    const page = rawPage !== undefined ? Number(rawPage) : 1;
    const limit = rawLimit !== undefined ? Number(rawLimit) : 20;

    const result = await getModerationLogs(page, limit, action);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve audit logs', statusCode);
  }
};

export const getTrendsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trends = await getHazardTrends();
    return successResponse(res, trends, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to calculate hazard trends', statusCode);
  }
};

export const getVerificationsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const verifications = await getPendingVerifications();
    return successResponse(res, verifications, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to fetch pending verifications', statusCode);
  }
};

export const approveVerificationHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;

    const result = await approveVerification(adminId, id);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to approve verification', statusCode);
  }
};

export const rejectVerificationHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await rejectVerification(adminId, id, reason);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to reject verification', statusCode);
  }
};

export const triggerNewsCrawlHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await triggerNewsCrawler();
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return errorResponse(res, error.message || 'News crawler failed', statusCode);
  }
};

export const getUsersHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const role = req.query.role as Role | undefined;
    const isBanned = req.query.isBanned !== undefined ? req.query.isBanned === 'true' : undefined;
    const isVerified = req.query.isVerified !== undefined ? req.query.isVerified === 'true' : undefined;
    const page = req.query.page !== undefined ? Number(req.query.page) : 1;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 20;
    const sortBy = req.query.sortBy as 'createdAt' | 'trustScore' | 'lastReportAt' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

    const result = await getAdminUsers({
      search,
      role,
      isBanned,
      isVerified,
      page,
      limit,
      sortBy,
      sortOrder,
    });
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve users', statusCode);
  }
};

export const getAdminReportsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as ReportCategory | undefined;
    const severity = req.query.severity as ReportSeverity | undefined;
    const status = req.query.status as ReportStatus | undefined;
    const userId = req.query.userId as string | undefined;
    const page = req.query.page !== undefined ? Number(req.query.page) : 1;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 20;

    const result = await getAdminReports({
      search,
      category,
      severity,
      status,
      userId,
      page,
      limit,
    });
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve reports', statusCode);
  }
};
