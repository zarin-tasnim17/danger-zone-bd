import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { generatePresignedUploadUrl, AllowedMimeType, getPublicUrl } from '../services/storageService';
import { processPrivacyBlur } from '../services/privacyBlurService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_MEDIA_FILENAME_REGEX = /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;

const decodeStorageKey = (rawKey: string): string | null => {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    return null;
  }
};

const parseReportMediaKey = (rawKey: string): { reportId: string; fileKey: string } | null => {
  const decoded = decodeStorageKey(rawKey.trim());
  if (!decoded || decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('..')) {
    return null;
  }

  // Expect exact key format: reports/{reportId}/{filename}
  const parts = decoded.split('/');
  if (parts.length !== 3 || parts[0] !== 'reports') {
    return null;
  }

  const [, reportId, filename] = parts;
  if (!UUID_REGEX.test(reportId)) {
    return null;
  }

  // Skip derivative blurred assets to prevent recursive webhook processing loops
  if (filename.startsWith('blurred-') || !SAFE_MEDIA_FILENAME_REGEX.test(filename)) {
    return null;
  }

  return { reportId, fileKey: decoded };
};

export const getPresignedUrlHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    const { reportId, fileType, fileSize } = req.query;

    // Check report existence
    const report = await prisma.report.findUnique({
      where: { id: String(reportId) },
    });

    if (!report) {
      return errorResponse(res, 'Report not found', 404);
    }

    // Ownership check: reporter, VERIFIED_RESPONDER, or ADMIN
    if (report.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'VERIFIED_RESPONDER') {
      return errorResponse(res, 'You are not authorized to attach media to this report', 403);
    }

    const presignedData = await generatePresignedUploadUrl(
      String(reportId),
      fileType as AllowedMimeType,
      Number(fileSize)
    );

    return successResponse(res, presignedData, 200);
  } catch (error: any) {
    next(error);
  }
};

export const confirmMediaUploadHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    const { reportId, originalUrl, fileKey } = req.body;

    // Verify report exists
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return errorResponse(res, 'Report not found', 404);
    }

    if (report.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'VERIFIED_RESPONDER') {
      return errorResponse(res, 'You are not authorized to confirm media for this report', 403);
    }

    const resolvedUrl = originalUrl || (fileKey ? getPublicUrl(fileKey) : null);
    if (!resolvedUrl) {
      return errorResponse(res, 'Either originalUrl or fileKey must be provided', 400);
    }

    // Create ReportMedia record
    const media = await prisma.reportMedia.create({
      data: {
        reportId,
        originalUrl: resolvedUrl,
      },
    });

    // Run privacy blur pipeline
    await processPrivacyBlur(media.id, resolvedUrl);

    // Fetch refreshed record
    const updatedMedia = await prisma.reportMedia.findUnique({
      where: { id: media.id },
    });

    return successResponse(res, updatedMedia, 201);
  } catch (error: any) {
    next(error);
  }
};

export const handleStorageWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body;
    const expectedBucket = (
      'STORAGE_WEBHOOK_BUCKET' in process.env
        ? process.env.STORAGE_WEBHOOK_BUCKET
        : env.STORAGE_WEBHOOK_BUCKET
    )?.trim();

    // Handle standard S3 ObjectCreated arrays or Supabase Storage webhook INSERT payloads
    const isS3Batch = Array.isArray(payload?.Records);
    if (!isS3Batch && typeof payload?.type === 'string' && payload.type.toUpperCase() !== 'INSERT') {
      return res.status(200).json({ received: true });
    }

    const records = isS3Batch ? payload.Records : payload?.record ? [payload.record] : [];

    for (const record of records) {
      if (
        isS3Batch &&
        typeof record?.eventName === 'string' &&
        !record.eventName.toLowerCase().includes('objectcreated')
      ) {
        continue;
      }

      if (expectedBucket) {
        const eventBucket = record?.s3?.bucket?.name || record?.bucket_id;
        if (eventBucket !== expectedBucket) {
          continue;
        }
      }

      const rawKey = record?.s3?.object?.key || record?.name;
      if (typeof rawKey !== 'string') continue;

      const parsed = parseReportMediaKey(rawKey);
      if (!parsed) continue;

      const { reportId, fileKey } = parsed;
      const report = await prisma.report.findUnique({
        where: { id: reportId },
      });
      if (!report) continue;

      const publicUrl = getPublicUrl(fileKey);
      const existingMedia = await prisma.reportMedia.findFirst({
        where: { reportId, originalUrl: publicUrl },
      });
      if (existingMedia) continue;

      const media = await prisma.reportMedia.create({
        data: {
          reportId,
          originalUrl: publicUrl,
        },
      });

      await processPrivacyBlur(media.id, publicUrl);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    next(error);
  }
};
