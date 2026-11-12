import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, ApiError } from '@/lib/api';
import { installBrowserGlobals, type BrowserSandboxHandle } from '../framework/domEnv';
import {
  installFetchMock,
  jsonResponse,
  htmlErrorResponse,
  textResponse,
  delay,
  type FetchMockController,
} from '../framework/fetchMock';

describe('[API][Mocked] apiFetch Transport, Refresh, Resilience & Failure Modes', () => {
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

  it('includes credentials: include, unwraps { success: true, data }, and omits JSON Content-Type for FormData', async () => {
    fetchMock.on('/api/v1/stats', () =>
      jsonResponse({ success: true, data: { activeReports: 12 } }, 200)
    );
    fetchMock.on('/api/v1/upload', () => jsonResponse({ success: true, data: { uploaded: true } }, 201));

    const stats = await apiFetch<{ activeReports: number }>('/stats');
    assert.deepEqual(stats, { activeReports: 12 });
    assert.equal(fetchMock.calls[0].credentials, 'include');

    const fd = new FormData();
    fd.append('file', 'data');
    const up = await apiFetch<{ uploaded: boolean }>('/upload', { method: 'POST', body: fd });
    assert.deepEqual(up, { uploaded: true });
    assert.equal(fetchMock.calls[1].isFormData, true);
    assert.equal(fetchMock.calls[1].headers['content-type'], undefined);
  });

  it('extracts structured backend Zod validation error messages and string rate-limit errors accurately', async () => {
    fetchMock.on('/api/v1/reports', () =>
      jsonResponse(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Description must be at least 1 character',
            details: [{ path: ['description'], message: 'Required' }],
          },
        },
        400
      )
    );
    fetchMock.on('/api/v1/auth/login', () =>
      jsonResponse({ success: false, error: 'Too many requests, please try again later.' }, 429)
    );

    await assert.rejects(
      () => apiFetch('/reports', { method: 'POST', body: JSON.stringify({}) }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, 'Description must be at least 1 character');
        return true;
      }
    );

    // Note: /auth/login returns 401/429; here 429 does not refresh
    await assert.rejects(
      () => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'x' }) }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 429);
        assert.match(err.message, /Too many requests/);
        return true;
      }
    );
  });

  it('handles HTTP 401 -> silent POST /api/v1/auth/refresh -> single retry on subsequent 200 OK', async () => {
    let meAttempts = 0;
    fetchMock.on('/api/v1/users/me', () => {
      meAttempts++;
      if (meAttempts === 1) {
        return jsonResponse({ success: false, error: 'Access token expired' }, 401);
      }
      return jsonResponse({ success: true, data: { id: 'u1', role: 'USER' } }, 200);
    });
    fetchMock.on(
      '/api/v1/auth/refresh',
      () => jsonResponse({ success: true, data: { user: { id: 'u1' }, socketToken: 'tok-new' } }, 200),
      { method: 'POST' }
    );

    const me = await apiFetch<{ id: string }>('/users/me');
    assert.equal(me.id, 'u1');
    assert.equal(fetchMock.getCallsFor('/api/v1/users/me').length, 2);
    assert.equal(fetchMock.getCallsFor('/api/v1/auth/refresh').length, 1);
  });

  it('coalesces parallel 401 responses behind a single-flight POST /auth/refresh mutex (FRONTEND-001)', async () => {
    let attempts = 0;
    fetchMock.on('/api/v1/users/me', () => {
      attempts++;
      return attempts === 1
        ? jsonResponse({ success: false, error: 'Expired' }, 401)
        : jsonResponse({ success: true, data: { id: 'u1' } }, 200);
    });
    fetchMock.on('/api/v1/alerts/zones', () =>
      jsonResponse({ success: true, data: [] }, 200)
    );
    let zoneAttempt = 0;
    fetchMock.setDefault(({ call }) => {
      if (call.url.includes('/api/v1/reports')) {
        zoneAttempt++;
        return zoneAttempt === 1
          ? jsonResponse({ success: false, error: 'Expired' }, 401)
          : jsonResponse({ success: true, data: [] }, 200);
      }
      return jsonResponse({ success: true, data: null }, 200);
    });
    fetchMock.on(
      '/api/v1/auth/refresh',
      async () => {
        await delay(15);
        return jsonResponse({ success: true, data: { socketToken: 'rotated' } }, 200);
      },
      { method: 'POST' }
    );

    const [me, reports] = await Promise.all([apiFetch('/users/me'), apiFetch('/reports')]);
    assert.deepEqual(me, { id: 'u1' });
    assert.deepEqual(reports, []);
    const refreshCalls = fetchMock.getCallsFor('/api/v1/auth/refresh');
    assert.equal(refreshCalls.length, 1);
  });

  it('skips silent /auth/refresh on POST /auth/login 401 responses (FRONTEND-002)', async () => {
    fetchMock.on('/api/v1/auth/login', () =>
      jsonResponse({ success: false, error: 'Invalid credentials' }, 401)
    );
    fetchMock.on('/api/v1/auth/refresh', () =>
      jsonResponse({ success: false, error: 'No refresh token' }, 401)
    );

    await assert.rejects(
      () =>
        apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: 'wrong@example.com', password: 'badpassword' }),
        }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 401
    );

    assert.equal(fetchMock.getCallsFor('/api/v1/auth/refresh').length, 0);
  });

  it('handles HTML 502 Bad Gateway, network TypeError offline failures, and AbortController timeouts cleanly', async () => {
    fetchMock.on('/api/v1/proxy-fail', () => htmlErrorResponse(502));
    await assert.rejects(
      () => apiFetch('/proxy-fail'),
      (err: unknown) => err instanceof ApiError && err.statusCode === 502
    );

    fetchMock.on('/api/v1/empty-200', () => textResponse('not-json-body', 200, 'text/plain'));
    const plainRes = await apiFetch('/empty-200');
    assert.equal(plainRes, null);

    // Network offline simulation
    const savedFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    try {
      await assert.rejects(
        () => apiFetch('/stats'),
        (err: unknown) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 0);
          assert.equal(err.data?.isNetworkError, true);
          return true;
        }
      );
    } finally {
      globalThis.fetch = savedFetch;
    }

    // AbortController timeout propagation
    fetchMock.on('/api/v1/slow', ({ signal }) => {
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(
      () => apiFetch('/slow', { signal: controller.signal }),
      (err: unknown) => err instanceof ApiError && err.statusCode === 0
    );
  });
});
