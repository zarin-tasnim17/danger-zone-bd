import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { generatePresignedUploadUrl, AllowedMimeType, getPublicUrl } from '../services/storageService';
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

    // Handle standard S3 ObjectCreated or Supabase Storage webhook payloads
    const records = payload?.Records || (payload?.record ? [payload.record] : []);

    for (const record of records) {
      const key = record?.s3?.object?.key || record?.name;
      if (!key) continue;

      // Key format: reports/{reportId}/{uuid}.{ext}
      const parts = key.split('/');
      if (parts.length >= 3 && parts[0] === 'reports') {
        const reportId = parts[1];
        const publicUrl = getPublicUrl(key);

        const report = await prisma.report.findUnique({
          where: { id: reportId },
        });

        if (report) {
          const media = await prisma.reportMedia.create({
            data: {
              reportId,
              originalUrl: publicUrl,
            },
          });

          await processPrivacyBlur(media.id, publicUrl);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    next(error);
  }
};
