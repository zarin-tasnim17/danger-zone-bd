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
      const minLngNum = parseFloat(minLng as string);
      const minLatNum = parseFloat(minLat as string);
      const maxLngNum = parseFloat(maxLng as string);
      const maxLatNum = parseFloat(maxLat as string);
      if (
        !Number.isFinite(minLngNum) ||
        !Number.isFinite(minLatNum) ||
        !Number.isFinite(maxLngNum) ||
        !Number.isFinite(maxLatNum)
      ) {
        const error: any = new Error('Invalid bounding box coordinates');
        error.statusCode = 400;
        throw error;
      }
      const bounds = {
        minLng: minLngNum,
        minLat: minLatNum,
        maxLng: maxLngNum,
        maxLat: maxLatNum,
      };
      const zones = await safeZoneService.fetchSafeZonesInBounds(bounds, safeZoneType);
      return successResponse(res, zones, 200);
    }

    // Nearby Radius Proximity query
    if (lat || lng) {
      if (!lat || !lng) {
        const error: any = new Error('Both lat and lng must be provided together for proximity queries');
        error.statusCode = 400;
        throw error;
      }
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const radiusMeters = radius ? parseFloat(radius as string) : 5000;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusMeters)) {
        const error: any = new Error('Invalid latitude, longitude, or radius');
        error.statusCode = 400;
        throw error;
      }

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
