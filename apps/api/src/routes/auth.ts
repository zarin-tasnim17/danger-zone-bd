import { Router } from 'express';
import { loginDevice, loginPassword, refresh, logout } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import {
  authDeviceRateLimiter,
  authLoginRateLimiter,
  authRefreshRateLimiter,
} from '../middleware/rateLimiter';
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

router.post('/device', authDeviceRateLimiter, validateRequest(deviceLoginSchema), loginDevice);
router.post('/login', authLoginRateLimiter, validateRequest(passwordLoginSchema), loginPassword);
router.post('/refresh', authRefreshRateLimiter, refresh);
router.post('/logout', logout);

export default router;
