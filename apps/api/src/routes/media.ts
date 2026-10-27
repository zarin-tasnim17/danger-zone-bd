import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import {
  getPresignedUrlHandler,
  confirmMediaUploadHandler,
  handleStorageWebhook,
} from '../controllers/mediaController';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../services/storageService';

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
  body: z.object({
    reportId: z.string().uuid(),
    originalUrl: z.string().url().optional(),
    fileKey: z.string().min(1).optional(),
  }).refine((data) => Boolean(data.originalUrl || data.fileKey), {
    message: 'Either originalUrl or fileKey must be provided',
  }),
});

// Endpoints
router.get('/presigned-url', requireAuth, validateRequest(presignedUrlSchema), getPresignedUrlHandler);
router.post('/confirm', requireAuth, validateRequest(confirmMediaSchema), confirmMediaUploadHandler);
router.post('/webhook', handleStorageWebhook);

export default router;
