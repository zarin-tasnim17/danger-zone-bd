import { Request, Response } from 'express';
import * as reportService from '../services/reportService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const createReport = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const payload = req.body;
    
    const deviceGps = {
      latitude: parseFloat(req.headers['x-device-lat'] as string),
      longitude: parseFloat(req.headers['x-device-lng'] as string)
    };

    const report = await reportService.createReport(userId, payload as any, deviceGps);
    return successResponse(res, report, 201);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};

export const getReports = async (req: Request, res: Response) => {
  try {
    const bounds = {
      minLng: parseFloat(req.query.minLng as string),
      minLat: parseFloat(req.query.minLat as string),
      maxLng: parseFloat(req.query.maxLng as string),
      maxLat: parseFloat(req.query.maxLat as string)
    };
    const reports = await reportService.fetchReportsInBounds(bounds);
    return successResponse(res, reports, 200);
  } catch (error: any) {
    return errorResponse(res, error.message, 400);
  }
};
