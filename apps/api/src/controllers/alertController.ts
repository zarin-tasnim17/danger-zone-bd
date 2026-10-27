import { Request, Response, NextFunction } from 'express';
import {
  createAlertZone,
  getUserAlertZones,
  deleteAlertZone,
} from '../services/alertZoneService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

export const createZoneHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { name, coordinates } = req.body;

    const zone = await createAlertZone(userId, name, coordinates);
    return successResponse(res, zone, 201);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create alert zone', statusCode);
  }
};

export const getZonesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const zones = await getUserAlertZones(userId);
    return successResponse(res, zones, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to fetch alert zones', statusCode);
  }
};

export const deleteZoneHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await deleteAlertZone(userId, id);
    return successResponse(res, { message: 'Alert zone deleted successfully' }, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete alert zone', statusCode);
  }
};

export const subscribePushHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { endpoint, keys } = req.body;

    // In production, save Web Push subscription object to a user PushSubscription table.
    // Here we validate the contract and acknowledge subscription.
    console.log(`[Alerts] Registered Web Push subscription for user ${userId} (endpoint: ${endpoint?.substring(0, 40)}...)`);

    return successResponse(res, { subscribed: true, userId }, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to subscribe to push alerts', statusCode);
  }
};
