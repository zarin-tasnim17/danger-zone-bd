import { Request, Response } from 'express';
import * as reportUpdateService from '../services/reportUpdateService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const addUpdateHandler = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id: reportId } = req.params;
    const { content } = req.body;

    const update = await reportUpdateService.addReportUpdate(userId, reportId, content);
    return successResponse(res, update, 201);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to post context update', statusCode);
  }
};

export const getUpdatesHandler = async (req: Request, res: Response) => {
  try {
    const { id: reportId } = req.params;
    const updates = await reportUpdateService.getReportUpdates(reportId);
    return successResponse(res, updates, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to fetch context updates', statusCode);
  }
};
