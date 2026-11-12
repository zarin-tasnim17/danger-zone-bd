import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { apiFetch, ApiError } from '@/lib/api';
import { uploadReportEvidence } from '@/lib/mediaUpload';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import {
  installFetchMock,
  jsonResponse,
  type FetchMockController,
} from '../framework/fetchMock';
import { WEB_TEST_CONFIG } from '../framework/config';

describe('[API][Mocked] HTTP Error Code Matrix, Edge Payloads & Media Upload Pipeline', () => {
  let sandbox: BrowserSandboxHandle;
  let fetchMock: FetchMockController;

  beforeEach(() => {
    sandbox = installBrowserGlobals();
    fetchMock = installFetchMock();
  });

  afterEach(() => {
    fetchMock.restore();
    sandbox.restore();
  });

  it('extracts structured { error: { code, message } } and string error messages across 400, 403, 404, 409, 422, 429, 500, 503, and 504', async () => {
    const cases: Array<{
      status: number;
      body: Record<string, unknown>;
      expectedMessage: string;
    }> = [
      { status: 400, body: { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid polygon ring' } }, expectedMessage: 'Invalid polygon ring' },
      { status: 403, body: { success: false, error: 'Insufficient administrator privileges' }, expectedMessage: 'Insufficient administrator privileges' },
      { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Incident report not found' } }, expectedMessage: 'Incident report not found' },
      { status: 409, body: { success: false, error: 'Duplicate vote conflict' }, expectedMessage: 'Duplicate vote conflict' },
      { status: 422, body: { success: false, error: { code: 'UNPROCESSABLE', message: 'Invalid coordinate pair' } }, expectedMessage: 'Invalid coordinate pair' },
      { status: 429, body: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, retry later' } }, expectedMessage: 'Too many requests, retry later' },
      { status: 500, body: { success: false, error: 'Internal server error' }, expectedMessage: 'Internal server error' },
      { status: 503, body: { success: false, error: 'PostgreSQL temporarily unavailable' }, expectedMessage: 'PostgreSQL temporarily unavailable' },
      { status: 504, body: { success: false, error: { code: 'GATEWAY_TIMEOUT', message: 'Upstream backend timed out' } }, expectedMessage: 'Upstream backend timed out' },
    ];

    for (const item of cases) {
      const endpoint = `/test-status-${item.status}`;
      fetchMock.on(`/api/v1${endpoint}`, () => jsonResponse(item.body, item.status));

      await assert.rejects(
        () => apiFetch(endpoint),
        (err: unknown) =>
          err instanceof ApiError &&
          err.statusCode === item.status &&
          err.message === item.expectedMessage
      );
    }
  });

  it('prevents infinite retry loops when both protected GET and POST /auth/refresh return 401', async () => {
    fetchMock.on('/api/v1/protected-resource', () =>
      jsonResponse({ success: false, error: 'Token expired' }, 401)
    );
    fetchMock.on(
      '/api/v1/auth/refresh',
      () => jsonResponse({ success: false, error: 'Refresh token revoked' }, 401),
      { method: 'POST' }
    );

    await assert.rejects(
      () => apiFetch('/protected-resource'),
      (err: unknown) => err instanceof ApiError && err.statusCode === 401
    );

    assert.equal(fetchMock.getCallsFor('/api/v1/protected-resource').length, 1);
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/refresh', 'POST').length, 1);
  });

  it('handles 204 No Content empty responses gracefully as null without JSON SyntaxError', async () => {
    fetchMock.on('/api/v1/empty-no-content', () => new Response(null, { status: 204 }));
    const res = await apiFetch('/empty-no-content');
    assert.equal(res, null);
  });

  it('completes S3 direct PUT -> POST /media/confirm workflow cleanly and aborts confirm when PUT fails', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'evidence.png', { type: 'image/png' });
    const reportId = '11111111-1111-4111-8111-111111111111';

    fetchMock.on('/api/v1/media/presigned-url', () =>
      jsonResponse(
        {
          success: true,
          data: {
            uploadUrl: 'https://storage.example.test/upload/evidence.png?sig=1',
            fileKey: 'reports/evidence.png',
            publicUrl: 'https://cdn.example.test/reports/evidence.png',
            expiresInSeconds: 300,
            isMock: false,
          },
        },
        200
      )
    );
    fetchMock.on('https://storage.example.test/upload/evidence.png', () => new Response(null, { status: 200 }));
    fetchMock.on('/api/v1/media/confirm', () =>
      jsonResponse(
        {
          success: true,
          data: {
            id: 'media-1',
            reportId,
            blurredUrl: 'https://cdn.example.test/reports/evidence-blur.jpg',
            createdAt: new Date().toISOString(),
          },
        },
        201
      )
    );

    const confirmed = await uploadReportEvidence(reportId, file);
    assert.equal(confirmed.id, 'media-1');
    assert.equal(fetchMock.getCallsFor('/api/v1/media/confirm', 'POST').length, 1);
    assert.equal(fetchMock.getCallsFor('storage.example.test', 'PUT').length, 1);

    // Direct storage upload error must NOT call /media/confirm
    fetchMock.reset();
    fetchMock.on('/api/v1/media/presigned-url', () =>
      jsonResponse(
        {
          success: true,
          data: {
            uploadUrl: 'https://storage.example.test/upload/fail.png',
            fileKey: 'reports/fail.png',
            publicUrl: 'https://cdn.example.test/reports/fail.png',
            expiresInSeconds: 300,
            isMock: false,
          },
        },
        200
      )
    );
    fetchMock.on('https://storage.example.test/upload/fail.png', () => new Response('Forbidden', { status: 403 }));
    fetchMock.on('/api/v1/media/confirm', () => jsonResponse({ success: true, data: {} }, 201));

    await assert.rejects(
      () => uploadReportEvidence(reportId, file),
      /Direct cloud storage upload failed \(HTTP 403\)/
    );
    assert.equal(fetchMock.getCallsFor('/api/v1/media/confirm', 'POST').length, 0);
  });

  it('normalizes NEXT_PUBLIC_API_URL in app/health/page.tsx identically to app/api/health/route.ts', () => {
    const healthPageSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/health/page.tsx'), 'utf8');
    const healthRouteSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/api/health/route.ts'), 'utf8');

    assert.equal(healthPageSrc.includes('.replace(/\\/+$/, "").replace(/\\/api\\/v1$/, "")'), true);
    assert.equal(healthRouteSrc.includes('.replace(/\\/+$/, "").replace(/\\/api\\/v1$/, "")'), true);

    const sampleUrl = 'https://api.example.com/api/v1///';
    const normalized = sampleUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    assert.equal(normalized, 'https://api.example.com');
  });
});
