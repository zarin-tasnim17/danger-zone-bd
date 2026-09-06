import { Router } from 'express';
import { loginDevice, refresh, logout } from '../controllers/authController';
import { requireAuth } from '../middleware/requireAuth';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

const router = Router();

const deviceLoginSchema = z.object({
  body: z.object({
    anonymousId: z.string().min(1),
    email: z.string().email().optional(),
  }).strict()
});

router.post('/device', validateRequest(deviceLoginSchema), loginDevice);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);

export default router;
