import { z } from 'zod';
import {
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  SAFE_ZONE_TYPES,
  BD_MOBILE_REGEX,
} from '@repo/shared';

/**
 * Canonical backend Zod contract schemas derived directly from
 * `apps/api/src/routes/*.ts`, `apps/api/docs/testing/API_Endpoint_Inventory.md` (EP-001..EP-047),
 * and `packages/shared/src/index.ts`.
 */

export const ALL_BACKEND_ENDPOINT_IDS = Array.from({ length: 47 }, (_, i) =>
  `EP-${String(i + 1).padStart(3, '0')}`
) as readonly string[];

export const apiSuccessEnvelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const apiErrorEnvelope = z.object({
  success: z.literal(false),
  error: z.union([
    z.string(),
    z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  ]),
});

// EP-006..EP-011 Auth & KYC
export const deviceLoginRequestSchema = z
  .object({
    anonymousId: z.string().min(4).max(128).optional(),
  })
  .strict();

export const passwordLoginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
  })
  .strict();

export const kycVerifyRequestSchema = z
  .object({
    type: z.enum(['PHONE_OTP', 'NID_DOCUMENT']),
    phoneNumber: z.string().trim().regex(BD_MOBILE_REGEX).optional(),
    documentUrl: z.string().trim().url().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.type === 'PHONE_OTP' && !v.phoneNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'phoneNumber required for PHONE_OTP' });
    }
    if (v.type === 'NID_DOCUMENT' && !v.documentUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'documentUrl required for NID_DOCUMENT' });
    }
  });

// EP-013..EP-019 Reports
export const createReportRequestSchema = z
  .object({
    category: z.enum(REPORT_CATEGORIES),
    severity: z.enum(REPORT_SEVERITIES),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    description: z.string().min(1).max(1000).optional(),
  })
  .strict();

export const voteReportRequestSchema = z
  .object({
    voteType: z.literal(1).or(z.literal(-1)),
  })
  .strict();

export const addReportUpdateRequestSchema = z
  .object({
    content: z.string().trim().min(2).max(500),
  })
  .strict();

export const reportUpdateResponseItemSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string(),
  author: z.object({
    isVerified: z.boolean(),
    role: z.enum(['USER', 'VERIFIED_RESPONDER', 'ADMIN']),
    alias: z.string(),
  }),
});

// EP-028..EP-030 Media
export const presignedUrlQuerySchema = z.object({
  reportId: z.string().uuid(),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  fileSize: z.number().int().min(1).max(5 * 1024 * 1024),
});

export const confirmMediaRequestSchema = z
  .object({
    reportId: z.string().uuid(),
    originalUrl: z.string().url().optional(),
    fileKey: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.originalUrl && !data.fileKey) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'originalUrl or fileKey required' });
    }
  });

// EP-020..EP-022 Safe Zones
export const createSafeZoneRequestSchema = z
  .object({
    name: z.string().min(2).max(150),
    type: z.enum(SAFE_ZONE_TYPES),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export const safeZoneResponseItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(SAFE_ZONE_TYPES),
  latitude: z.number(),
  longitude: z.number(),
  createdAt: z.string().optional(),
  distanceMeters: z.number().optional(),
});

// EP-024..EP-027 Alert Zones & Push
export const createAlertZoneRequestSchema = z
  .object({
    name: z.string().min(1).max(100),
    coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(4),
  })
  .strict();

export const pushSubscribeRequestSchema = z
  .object({
    endpoint: z.string().url(),
    keys: z
      .object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      })
      .strict(),
  })
  .strict();

// EP-023 Safe Routes
export const safePathRequestSchema = z
  .object({
    startLat: z.number().min(20).max(27),
    startLng: z.number().min(87).max(93),
    endLat: z.number().min(20).max(27),
    endLng: z.number().min(87).max(93),
  })
  .strict();

// EP-034..EP-037 Admin Moderation
export const moderationActionRequestSchema = z
  .object({
    reason: z.string().min(3).max(500),
  })
  .strict();

// EP-044 Next.js Health Proxy
export const nextHealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded']),
  timestamp: z.string(),
  totalLatencyMs: z.number(),
  services: z.object({
    frontend: z.object({
      name: z.string(),
      status: z.literal('online'),
      mode: z.string(),
    }),
    backend: z.object({
      name: z.string(),
      url: z.string(),
      status: z.string(),
      latencyMs: z.number(),
    }),
    database: z.object({
      name: z.string(),
      status: z.string(),
      latencyMs: z.number(),
      query: z.string(),
    }),
  }),
});

export const reportStatusEnum = z.enum(REPORT_STATUSES);
