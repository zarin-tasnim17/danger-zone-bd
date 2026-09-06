import { prisma } from '../db/prisma';
import { ReportCategory, ReportSeverity } from '@prisma/client';
import { isWithinDistance, getReportsInBounds, BoundingBox } from '../db/spatialUtils';

export const createReport = async (
  userId: string,
  payload: {
    category: ReportCategory;
    severity: ReportSeverity;
    latitude: number;
    longitude: number;
    description?: string;
  },
  deviceGps: { latitude: number; longitude: number }
) => {
  // Critical Business Rule: Proximity validation (max 200m)
  const isCloseEnough = await isWithinDistance(
    payload.latitude, payload.longitude,
    deviceGps.latitude, deviceGps.longitude,
    200
  );

  if (!isCloseEnough) {
    throw new Error('Submitted coordinate is too far from your actual GPS location (max 200m).');
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expiry in 24h

  // Insert report. Trigger handles the "location" geography point.
  const report = await prisma.report.create({
    data: {
      userId,
      category: payload.category,
      severity: payload.severity,
      latitude: payload.latitude,
      longitude: payload.longitude,
      description: payload.description,
      expiresAt
    }
  });

  return report;
};

export const fetchReportsInBounds = async (bounds: BoundingBox) => {
  // Fetch from PostGIS
  // PII is already stripped by the custom SELECT in getReportsInBounds
  const reports: any = await getReportsInBounds(bounds);
  return reports;
};
