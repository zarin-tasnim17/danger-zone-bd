import { Router } from 'express';
import { BD_MOBILE_REGEX } from '@repo/shared';
import { getMe, submitVerify, approveVerify } from '../controllers/userController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';
import { userVerifyRateLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();

const verifySchema = z.object({
  body: z.object({
    type: z.enum(['PHONE_OTP', 'NID_DOCUMENT']),
    documentUrl: z.string().trim().url('Please provide a valid document URL').optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(
        BD_MOBILE_REGEX,
        'Please provide a valid Bangladeshi mobile number (e.g. +8801XXXXXXXXX or 01XXXXXXXXX)'
      )
      .optional(),
  }).strict().superRefine((data, ctx) => {
    if (data.type === 'PHONE_OTP' && !data.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phoneNumber'],
        message: 'Bangladeshi mobile number is required for PHONE_OTP verification',
      });
    }
    if (data.type === 'NID_DOCUMENT' && !data.documentUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentUrl'],
        message: 'Document URL is required for NID_DOCUMENT verification',
      });
    }
  })
});

router.get('/me', requireAuth, getMe);
router.post('/verify', requireAuth, userVerifyRateLimiter, validateRequest(verifySchema), submitVerify);
router.post('/verify/:id/approve', requireAuth, requireRole(['ADMIN']), approveVerify);

export default router;
