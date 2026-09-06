import { Router } from 'express';
import { getMe, submitVerify, approveVerify } from '../controllers/userController';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

const router = Router();

const verifySchema = z.object({
  body: z.object({
    type: z.enum(['PHONE_OTP', 'NID_DOCUMENT']),
    documentUrl: z.string().url().optional(),
  }).strict()
});

router.get('/me', requireAuth, getMe);
router.post('/verify', requireAuth, validateRequest(verifySchema), submitVerify);
router.post('/verify/:id/approve', requireAuth, requireRole(['ADMIN']), approveVerify);

export default router;
