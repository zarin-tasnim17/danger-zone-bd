import path from 'path';
import fs from 'fs';

const webRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(webRoot, '../..');

export const WEB_TEST_CONFIG = {
  webRoot,
  apiRoot: path.join(repoRoot, 'apps/api'),
  repoRoot,
  testsRoot: path.join(webRoot, 'tests'),
  reportsDir: path.join(webRoot, 'tests/reports'),
  defaultTimeoutMs: Number(process.env.WEB_TEST_HTTP_TIMEOUT_MS || 20000),
  browserTimeoutMs: Number(process.env.WEB_TEST_BROWSER_TIMEOUT_MS || 45000),
  runLiveBackend: process.env.RUN_LIVE_BACKEND_TESTS !== 'false',
  runBrowserE2E: process.env.RUN_BROWSER_E2E_TESTS !== 'false',
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
  'admin_password',
  'supabase_service_role_key',
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

export const findChromiumExecutable = (): string | null => {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : [
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/usr/bin/google-chrome',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};
