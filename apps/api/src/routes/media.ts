import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import { verifyStorageWebhookSecret } from '../middleware/verifyWebhookSecret';
import {
  getPresignedUrlHandler,
  confirmMediaUploadHandler,
  handleStorageWebhook,
} from '../controllers/mediaController';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  resolveTrustedReportMedia,
} from '../services/storageService';

const router = Router();

// Middleware to explicitly reject raw multipart/form-data uploads
const rejectMultipart = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return res.status(415).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message:
          'Direct multipart/form-data uploads are strictly disallowed on this server to preserve memory. Request a presigned URL via GET /api/v1/media/presigned-url and upload directly to cloud storage.',
      },
    });
  }
  next();
};

router.use(rejectMultipart);

// Validation Schemas
const presignedUrlSchema = z.object({
  query: z.object({
    reportId: z.string().uuid(),
    fileType: z.enum(ALLOWED_MIME_TYPES),
    fileSize: z.string().refine((val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0 && num <= MAX_FILE_SIZE_BYTES;
    }, `fileSize must be a positive integer up to ${MAX_FILE_SIZE_BYTES} bytes (5MB)`),
  }).passthrough(),
});

const confirmMediaSchema = z.object({
  body: z
    .object({
      reportId: z.string().uuid(),
      originalUrl: z.string().url().optional(),
      fileKey: z.string().min(1).optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.originalUrl && !data.fileKey) {
        ctx.addIssue({
          code: 'custom',
          message: 'Either originalUrl or fileKey must be provided',
        });
        return;
      }

      if (!z.string().uuid().safeParse(data.reportId).success) {
        return;
      }

      try {
        resolveTrustedReportMedia(data);
      } catch (err: any) {
        ctx.addIssue({
          code: 'custom',
          path: data.originalUrl ? ['originalUrl'] : ['fileKey'],
          message: err?.message || 'Untrusted or invalid media storage location',
        });
      }
    }),
});

const webhookRecordSchema = z.object({
  eventName: z.string().optional(),
  bucket_id: z.string().optional(),
  name: z.string().optional(),
  s3: z.object({
    bucket: z.object({
      name: z.string().optional(),
    }).passthrough().optional(),
    object: z.object({
      key: z.string().optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough();

const storageWebhookSchema = z.object({
  body: z.object({
    type: z.string().optional(),
    Records: z.array(webhookRecordSchema).optional(),
    record: webhookRecordSchema.optional(),
  }).passthrough().refine(
    (data) => Array.isArray(data.Records) || Boolean(data.record),
    { message: 'Webhook payload must include either Records or record' }
  ),
});

// Endpoints
router.get('/presigned-url', requireAuth, validateRequest(presignedUrlSchema), getPresignedUrlHandler);
router.post('/confirm', requireAuth, validateRequest(confirmMediaSchema), confirmMediaUploadHandler);
router.post('/webhook', verifyStorageWebhookSecret, validateRequest(storageWebhookSchema), handleStorageWebhook);

export default router;
