import path from 'path';
import dotenv from 'dotenv';

const apiRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(apiRoot, '.env'), override: false });

export const TEST_CONFIG = {
  apiRoot,
  repoRoot: path.resolve(apiRoot, '../..'),
  reportsDir: path.join(apiRoot, 'tests/reports'),
  defaultTimeoutMs: Number(process.env.TEST_HTTP_TIMEOUT_MS || 15000),
  perfIterations: Number(process.env.TEST_PERF_ITERATIONS || 40),
  perfConcurrency: Number(process.env.TEST_PERF_CONCURRENCY || 8),
  dhakaCenter: {
    latitude: 23.7465,
    longitude: 90.376,
  },
  dhakaBounds: {
    minLng: 90.3,
    minLat: 23.7,
    maxLng: 90.45,
    maxLat: 23.85,
  },
  routeSample: {
    startLat: 23.738,
    startLng: 90.37,
    endLat: 23.758,
    endLng: 90.39,
  },
} as const;

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'jwt_secret',
  'jwt_refresh_secret',
  'database_url',
  'direct_url',
  'storage_webhook_secret',
  'cron_secret',
  'aws_secret_access_key',
  'authorization',
  'cookie',
  'set-cookie',
  'x-webhook-secret',
  'x-cron-secret',
]);

export const redactSensitive = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.startsWith('Bearer ')) return 'Bearer [REDACTED]';
    if (value.includes('postgres://') || value.includes('postgresql://')) return '[REDACTED_DSN]';
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = REDACTED;
      } else {
        out[k] = redactSensitive(v, depth + 1);
      }
    }
    return out;
  }
  return value;
};
