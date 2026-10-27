import { Request, Response } from 'express';
import * as safeZoneService from '../services/safeZoneService';
import { successResponse, errorResponse } from '../utils/responseFormatter';
import { SafeZoneType } from '@prisma/client';

export const getSafeZonesHandler = async (req: Request, res: Response) => {
  try {
    const { minLng, minLat, maxLng, maxLat, lat, lng, radius, type } = req.query;

    const safeZoneType = type as SafeZoneType | undefined;

    // Viewport Bounding Box query
    if (minLng && minLat && maxLng && maxLat) {
      const bounds = {
        minLng: parseFloat(minLng as string),
        minLat: parseFloat(minLat as string),
        maxLng: parseFloat(maxLng as string),
        maxLat: parseFloat(maxLat as string),
      };
      const zones = await safeZoneService.fetchSafeZonesInBounds(bounds, safeZoneType);
      return successResponse(res, zones, 200);
    }

    // Nearby Radius Proximity query
    if (lat && lng) {
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusMeters = radius ? parseFloat(radius as string) : 5000;

      const zones = await safeZoneService.fetchNearbySafeZones(latitude, longitude, radiusMeters, safeZoneType);
      return successResponse(res, zones, 200);
    }

    // Default: fetch all prominent safe zones in Bangladesh bounds
    const defaultBounds = {
      minLng: 88.0,
      minLat: 20.5,
      maxLng: 93.0,
      maxLat: 27.0,
    };
    const zones = await safeZoneService.fetchSafeZonesInBounds(defaultBounds, safeZoneType);
    return successResponse(res, zones, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to fetch safe zones', statusCode);
  }
};

export const createSafeZoneHandler = async (req: Request, res: Response) => {
  try {
    const { name, type, latitude, longitude } = req.body;
    const newZone = await safeZoneService.createSafeZone({
      name,
      type,
      latitude,
      longitude,
    });
    return successResponse(res, newZone, 201);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create safe zone', statusCode);
  }
};

export const deleteSafeZoneHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await safeZoneService.deleteSafeZone(id);
    return successResponse(res, result, 200);
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete safe zone', statusCode);
  }
};
