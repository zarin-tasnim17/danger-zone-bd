import { Request, Response } from 'express';
import * as safeRouteService from '../services/safeRouteService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const calculateSafeRouteHandler = async (req: Request, res: Response) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.body;

    const route = await safeRouteService.calculateSafeRoute(
      { latitude: startLat, longitude: startLng },
      { latitude: endLat, longitude: endLng }
    );

    return successResponse(res, route, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to calculate safe route', statusCode);
  }
};
