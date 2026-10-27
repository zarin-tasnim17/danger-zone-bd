import { prisma } from '../db/prisma';
import { ReportCategory, ReportSeverity } from '@prisma/client';
import { isWithinDistance, getReportsInBounds, BoundingBox, ReportFilterOptions, getFuzzedCoordinates } from '../db/spatialUtils';
import { emitNewReport, emitReportResolved } from '../sockets';
import { enqueueReportNotification } from '../jobs';

/**
 * Calculates dynamic time-decay expiration based on incident nature:
 * - Active emergency crimes (MUGGING, THEFT, EXTORTION): 3 hours
 * - Recurring localized hotspots (DRUG_ACTIVITY): 24 hours
 * - Long-term infrastructural issues (UNLIT_ROAD): 14 days
 */
export const calculateReportExpiry = (category: ReportCategory, now: Date = new Date()): Date => {
  switch (category) {
    case 'MUGGING':
    case 'THEFT':
    case 'EXTORTION':
      return new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours
    case 'DRUG_ACTIVITY':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    case 'UNLIT_ROAD':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
};

/**
 * Checks if current time is within high-risk night hours (8 PM - 5 AM Bangladesh Time, UTC+6)
 */
export const isNightTimeInBangladesh = (now: Date = new Date()): boolean => {
  const bdHour = (now.getUTCHours() + 6) % 24;
  return bdHour >= 20 || bdHour < 5;
};

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
  // Enforce account suspension check, trust score check, and rate-limiting check
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBanned: true, trustScore: true, role: true, lastReportAt: true }
  });

  if (user?.isBanned) {
    const error: any = new Error('Your account has been suspended. You cannot submit reports.');
    error.statusCode = 403;
    throw error;
  }

  // Low trust restriction threshold (-5 or below)
  if (user && user.trustScore <= -5) {
    const error: any = new Error('Your account has been restricted from submitting reports due to a low community trust score.');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();

  // Tier-2 User Rate Limiting: Standard citizens must wait 15 minutes between submissions
  if (user && user.role === 'USER' && user.lastReportAt) {
    const elapsedMinutes = (now.getTime() - new Date(user.lastReportAt).getTime()) / (1000 * 60);
    if (elapsedMinutes < 15) {
      const waitMinutes = Math.ceil(15 - elapsedMinutes);
      const error: any = new Error(`Rate limit exceeded: Standard accounts must wait 15 minutes between submissions to prevent spam. Please wait ${waitMinutes} more minute(s).`);
      error.statusCode = 429;
      throw error;
    }
  }

  // Critical Business Rule: Proximity validation (max 200m)
  const isCloseEnough = await isWithinDistance(
    payload.latitude, payload.longitude,
    deviceGps.latitude, deviceGps.longitude,
    200
  );

  if (!isCloseEnough) {
    const error: any = new Error('Submitted coordinate is too far from your actual GPS location (max 200m).');
    error.statusCode = 400;
    throw error;
  }

  const expiresAt = calculateReportExpiry(payload.category, now);
  const isNightReport = isNightTimeInBangladesh(now);

  // Insert report and atomically update lastReportAt timestamp
  const [report] = await prisma.$transaction([
    prisma.report.create({
      data: {
        userId,
        category: payload.category,
        severity: payload.severity,
        isNightReport,
        latitude: payload.latitude,
        longitude: payload.longitude,
        description: payload.description,
        expiresAt
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastReportAt: now }
    })
  ]);

  // Phase 8: Broadcast newly created pin in real time with location fuzzing applied
  const fuzzed = getFuzzedCoordinates(report.id, report.latitude, report.longitude);

  emitNewReport({
    id: report.id,
    category: report.category,
    severity: report.severity,
    latitude: fuzzed.latitude,
    longitude: fuzzed.longitude,
    description: report.description,
    upvotes: report.upvotes,
    downvotes: report.downvotes,
    status: report.status,
    expiresAt: report.expiresAt,
    createdAt: report.createdAt
  });

  // Phase 11: Asynchronously enqueue geofenced alert checks for HIGH severity reports
  if (report.severity === 'HIGH') {
    enqueueReportNotification(report);
  }

  return {
    ...report,
    latitude: fuzzed.latitude,
    longitude: fuzzed.longitude,
    fuzzedRadiusMeters: fuzzed.fuzzedRadiusMeters
  };
};

export const fetchReportsInBounds = async (bounds: BoundingBox, filters?: ReportFilterOptions) => {
  // Fetch from PostGIS with spatial envelope, live expiration check, and deterministic location fuzzing
  const reports: any = await getReportsInBounds(bounds, filters);
  return reports;
};

/**
 * Fetches a single incident by ID strictly stripping reporter PII and applying location fuzzing.
 */
export const fetchReportById = async (reportId: string) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      category: true,
      severity: true,
      isNightReport: true,
      latitude: true,
      longitude: true,
      description: true,
      upvotes: true,
      downvotes: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      media: {
        select: {
          id: true,
          blurredUrl: true,
          createdAt: true
        }
      },
      user: {
        select: {
          isVerified: true,
          role: true
        }
      }
    }
  });

  if (!report || report.status === 'PURGED') {
    const error: any = new Error('Report not found or has been purged');
    error.statusCode = 404;
    throw error;
  }

  const fuzzed = getFuzzedCoordinates(report.id, report.latitude, report.longitude);

  return {
    ...report,
    latitude: fuzzed.latitude,
    longitude: fuzzed.longitude,
    fuzzedRadiusMeters: fuzzed.fuzzedRadiusMeters,
    authorVerified: report.user?.isVerified ?? false,
    authorRole: report.user?.role ?? 'USER',
    user: undefined // Strip user object completely
  };
};

/**
 * Marks an active report as RESOLVED (e.g. broken streetlamp repaired or danger cleared).
 * Permitted for the original reporter or users with VERIFIED_RESPONDER / ADMIN roles.
 */
export const resolveReport = async (reportId: string, userId: string, userRole: string) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, userId: true, status: true }
  });

  if (!report) {
    const error: any = new Error('Report not found');
    error.statusCode = 404;
    throw error;
  }

  if (report.status === 'PURGED') {
    const error: any = new Error('Cannot resolve a purged report');
    error.statusCode = 400;
    throw error;
  }

  if (report.status === 'RESOLVED') {
    const error: any = new Error('Report is already marked as resolved');
    error.statusCode = 400;
    throw error;
  }

  // Authorization check
  const isAuthor = report.userId === userId;
  const isPrivileged = userRole === 'ADMIN' || userRole === 'VERIFIED_RESPONDER';

  if (!isAuthor && !isPrivileged) {
    const error: any = new Error('You do not have permission to resolve this report');
    error.statusCode = 403;
    throw error;
  }

  const updated = await prisma.report.update({
    where: { id: reportId },
    data: { status: 'RESOLVED' }
  });

  emitReportResolved({
    reportId: updated.id,
    status: updated.status,
    resolvedAt: new Date().toISOString()
  });

  return updated;
};
