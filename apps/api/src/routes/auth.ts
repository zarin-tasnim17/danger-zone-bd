import { Router } from 'express';
import { loginDevice, loginPassword, refresh, logout } from '../controllers/authController';
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

const passwordLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }).strict()
});

router.post('/device', validateRequest(deviceLoginSchema), loginDevice);
router.post('/login', validateRequest(passwordLoginSchema), loginPassword);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);

export default router;
