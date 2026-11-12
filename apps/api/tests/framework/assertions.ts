import assert from 'node:assert/strict';
import { ApiResponse } from './apiClient';
import { redactSensitive } from './config';

export const assertStatus = (
  res: ApiResponse,
  expected: number | number[],
  context = 'HTTP response'
): void => {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(
    allowed.includes(res.status),
    `${context}: expected status ${allowed.join(' or ')}, got ${res.status}. Body: ${JSON.stringify(
      redactSensitive(res.body)
    )}`
  );
};

export const assertSuccessEnvelope = <T = any>(
  res: ApiResponse<{ success: boolean; data: T }>,
  expectedStatus: number | number[] = 200,
  context = 'API success envelope'
): T => {
  assertStatus(res, expectedStatus, context);
  assert.equal(typeof res.body, 'object', `${context}: response body must be an object`);
  assert.equal(res.body?.success, true, `${context}: expected body.success === true`);
  assert.ok('data' in res.body, `${context}: expected body.data property`);
  return res.body.data;
};

export const assertErrorEnvelope = (
  res: ApiResponse,
  expectedStatus: number | number[],
  messageSubstring?: string,
  context = 'API error envelope'
): { message: string; code?: string } => {
  assertStatus(res, expectedStatus, context);
  assert.equal(typeof res.body, 'object', `${context}: error body must be JSON object`);
  assert.equal(res.body?.success, false, `${context}: expected body.success === false`);
  assert.ok(
    res.body?.error && typeof res.body.error.message === 'string',
    `${context}: expected body.error.message string`
  );
  if (messageSubstring) {
    assert.ok(
      res.body.error.message.toLowerCase().includes(messageSubstring.toLowerCase()),
      `${context}: expected error.message "${res.body.error.message}" to include "${messageSubstring}"`
    );
  }
  return res.body.error;
};

const FORBIDDEN_SECRET_PATTERNS = [
  /super-secret/i,
  /postgresql:\/\//i,
  /pgbouncer=true/i,
  /at Object\./i,
  /at Function\./i,
  /PrismaClientKnownRequestError/i,
  /passwordHash/i,
  /anonymousId/i,
];

export const assertNoSensitiveLeakage = (
  payload: unknown,
  context = 'Response leakage check',
  extraPatterns: RegExp[] = []
): void => {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '');
  for (const rx of [...FORBIDDEN_SECRET_PATTERNS, ...extraPatterns]) {
    assert.ok(
      !rx.test(serialized),
      `${context}: sensitive pattern ${rx.source} leaked in payload`
    );
  }
};

export const assertNoReportPii = (reportObj: Record<string, any>, context = 'Report PII check'): void => {
  assert.equal('userId' in reportObj, false, `${context}: report must NEVER expose userId`);
  assert.equal('anonymousId' in reportObj, false, `${context}: report must NEVER expose anonymousId`);
  assert.equal('passwordHash' in reportObj, false, `${context}: report must NEVER expose passwordHash`);
  if (Array.isArray(reportObj.media)) {
    for (const item of reportObj.media) {
      assert.equal('originalUrl' in item, false, `${context}: media item must NEVER expose originalUrl`);
    }
  }
};

export const assertSecurityHeaders = (res: ApiResponse, context = 'Security headers'): void => {
  assert.equal(
    res.headers.get('x-content-type-options'),
    'nosniff',
    `${context}: missing x-content-type-options: nosniff`
  );
  assert.ok(
    res.headers.get('x-frame-options') || res.headers.get('content-security-policy'),
    `${context}: expected Helmet frame protection header`
  );
  assert.equal(
    res.headers.get('x-powered-by'),
    null,
    `${context}: x-powered-by must be stripped`
  );
};
