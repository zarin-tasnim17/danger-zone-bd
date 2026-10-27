import { Request, Response } from 'express';
import * as reportService from '../services/reportService';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import { ReportCategory, ReportSeverity } from '@prisma/client';

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
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message, statusCode);
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

    const filters = {
      category: req.query.category as ReportCategory | undefined,
      severity: req.query.severity as ReportSeverity | undefined,
      isNightReport: req.query.isNightReport !== undefined 
        ? req.query.isNightReport === 'true' 
        : undefined
    };

    const reports = await reportService.fetchReportsInBounds(bounds, filters);
    return successResponse(res, reports, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message, statusCode);
  }
};

export const getReportById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = await reportService.fetchReportById(id);
    return successResponse(res, report, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message, statusCode);
  }
};

export const resolveReportHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const updatedReport = await reportService.resolveReport(id, userId, userRole);
    return successResponse(res, updatedReport, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message, statusCode);
  }
};
