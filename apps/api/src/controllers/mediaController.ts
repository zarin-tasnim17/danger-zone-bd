import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import {
  generatePresignedUploadUrl,
  AllowedMimeType,
  getPublicUrl,
  parseReportMediaKey,
  resolveTrustedReportMedia,
} from '../services/storageService';
import { processPrivacyBlur } from '../services/privacyBlurService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

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

    let resolvedUrl: string;
    try {
      resolvedUrl = resolveTrustedReportMedia({ reportId, originalUrl, fileKey }).originalUrl;
    } catch (validationError: any) {
      return errorResponse(res, validationError.message, validationError.statusCode || 400);
    }

    const existingMedia = await prisma.reportMedia.findFirst({
      where: { reportId, originalUrl: resolvedUrl },
    });

    let mediaId: string;
    let statusCode = 201;

    if (existingMedia) {
      mediaId = existingMedia.id;
      statusCode = 200;
      if (!existingMedia.blurredUrl) {
        await processPrivacyBlur(existingMedia.id, resolvedUrl);
      }
    } else {
      const media = await prisma.reportMedia.create({
        data: {
          reportId,
          originalUrl: resolvedUrl,
        },
      });
      mediaId = media.id;
      await processPrivacyBlur(media.id, resolvedUrl);
    }

    // Return sanitized media metadata without exposing originalUrl
    const updatedMedia = await prisma.reportMedia.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        reportId: true,
        blurredUrl: true,
        createdAt: true,
      },
    });

    return successResponse(res, updatedMedia, statusCode);
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
