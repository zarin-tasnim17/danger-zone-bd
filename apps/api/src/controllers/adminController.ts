import { Request, Response, NextFunction } from 'express';
import {
  banUser,
  unbanUser,
  purgeReport,
  getModerationLogs,
  getHazardTrends,
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
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const result = await getModerationLogs(page, limit);
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
