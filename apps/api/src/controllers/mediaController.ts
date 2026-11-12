import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import {
  generatePresignedUploadUrl,
  getPublicUrl,
  AllowedMimeType,
  isS3Configured,
  parseReportMediaKey,
  resolveTrustedReportMedia,
  validateCompressedInlineImage,
} from '../services/storageService';
import { processPrivacyBlur } from '../services/privacyBlurService';
import { successResponse, errorResponse } from '../utils/responseFormatter';

const findAuthorizedReportForMedia = async (
  reportId: string,
  user: { id: string; role: string },
  forbiddenMessage: string
) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });

  if (!report) {
    throw Object.assign(new Error('Report not found'), { statusCode: 404 });
  }

  if (report.userId !== user.id && user.role !== 'ADMIN' && user.role !== 'VERIFIED_RESPONDER') {
    throw Object.assign(new Error(forbiddenMessage), { statusCode: 403 });
  }

  return report;
};

const persistConfirmedReportMedia = async (reportId: string, resolvedUrl: string) => {
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

  return { updatedMedia, statusCode };
};

export const getPresignedUrlHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    const { reportId, fileType, fileSize } = req.query;

    try {
      await findAuthorizedReportForMedia(
        String(reportId),
        user,
        'You are not authorized to attach media to this report'
      );
    } catch (authError: any) {
      return errorResponse(res, authError.message, authError.statusCode || 403);
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

    try {
      await findAuthorizedReportForMedia(
        reportId,
        user,
        'You are not authorized to confirm media for this report'
      );
    } catch (authError: any) {
      return errorResponse(res, authError.message, authError.statusCode || 403);
    }

    let resolvedUrl: string;
    try {
      resolvedUrl = resolveTrustedReportMedia({ reportId, originalUrl, fileKey }).originalUrl;
    } catch (validationError: any) {
      return errorResponse(res, validationError.message, validationError.statusCode || 400);
    }

    const { updatedMedia, statusCode } = await persistConfirmedReportMedia(reportId, resolvedUrl);

    return successResponse(res, updatedMedia, statusCode);
  } catch (error: any) {
    next(error);
  }
};

/**
 * Authenticated fallback for environments where cloud S3 credentials are not configured (`isMock: true`).
 * Accepts a client-compressed JPEG/PNG/WebP base64 data URI (<= 512KB), verifies binary magic bytes,
 * and stores sanitized ReportMedia so evidence previews remain viewable in S3-less deployments.
 */
export const mockUploadMediaHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    if (isS3Configured()) {
      return errorResponse(
        res,
        'Mock media upload is disabled when cloud S3 storage is configured. Upload directly via presigned URL.',
        409
      );
    }

    const { reportId, imageDataUrl } = req.body;

    try {
      await findAuthorizedReportForMedia(
        reportId,
        user,
        'You are not authorized to attach media to this report'
      );
    } catch (authError: any) {
      return errorResponse(res, authError.message, authError.statusCode || 403);
    }

    let normalizedDataUrl: string;
    try {
      normalizedDataUrl = validateCompressedInlineImage(imageDataUrl).normalizedDataUrl;
    } catch (validationError: any) {
      return errorResponse(res, validationError.message, validationError.statusCode || 400);
    }

    const { updatedMedia, statusCode } = await persistConfirmedReportMedia(reportId, normalizedDataUrl);

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
      return successResponse(res, { received: true }, 200);
    }

    const records = isS3Batch
      ? payload.Records
      : payload?.record
        ? [payload.record]
        : typeof payload?.key === 'string'
          ? [{ name: payload.key }]
          : [];

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

    return successResponse(res, { received: true }, 200);
  } catch (error: any) {
    next(error);
  }
};
