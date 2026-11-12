import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as cronGet, POST as cronPost } from '@/app/api/cron/news-crawl/route';
import { installFetchMock, jsonResponse, type FetchMockController } from '../framework/fetchMock';
import { nextHealthResponseSchema } from '../framework/contractSchemas';

describe('[Next Route Handlers][Mocked] /api/health & /api/cron/news-crawl', () => {
  let fetchMock: FetchMockController;
  let prevInternalUrl: string | undefined;
  let prevCronSecret: string | undefined;

  beforeEach(() => {
    fetchMock = installFetchMock();
    prevInternalUrl = process.env.INTERNAL_API_URL;
    prevCronSecret = process.env.CRON_SECRET;
    process.env.INTERNAL_API_URL = 'http://127.0.0.1:5999';
  });

  afterEach(() => {
    fetchMock.restore();
    if (prevInternalUrl === undefined) delete process.env.INTERNAL_API_URL;
    else process.env.INTERNAL_API_URL = prevInternalUrl;
    if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCronSecret;
  });

  it('EP-044 GET /api/health returns 200 healthy JSON when upstream /health and /health/db succeed', async () => {
    fetchMock.on('http://127.0.0.1:5999/health/db', () =>
      jsonResponse({ success: true, data: { status: 'connected' } }, 200)
    );
    fetchMock.on('http://127.0.0.1:5999/health', () =>
      jsonResponse({ success: true, data: { status: 'ok' } }, 200)
    );

    const res = await healthGet();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store, max-age=0');
    const body = await res.json();
    const parsed = nextHealthResponseSchema.safeParse(body);
    assert.equal(parsed.success, true, `Schema mismatch: ${JSON.stringify(body)}`);
    assert.equal(body.status, 'healthy');
  });

  it('EP-044 GET /api/health returns 503 degraded when upstream DB probe fails or is unreachable', async () => {
    fetchMock.on('http://127.0.0.1:5999/health/db', () =>
      jsonResponse({ success: false, error: 'DB down' }, 503)
    );
    fetchMock.on('http://127.0.0.1:5999/health', () =>
      jsonResponse({ success: true, data: { status: 'ok' } }, 200)
    );

    const res = await healthGet();
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, 'degraded');
    assert.equal(body.services.backend.status, 'online');
    assert.equal(body.services.database.status, 'error-503');
  });

  it('EP-045/EP-046 fails closed (401) when CRON_SECRET is missing or wrong, and forwards POST with Bearer token when valid', async () => {
    delete process.env.CRON_SECRET;
    const missingRes = await cronGet(new Request('http://localhost/api/cron/news-crawl'));
    assert.equal(missingRes.status, 401);

    process.env.CRON_SECRET = 'super-secret-cron-token-123456';
    const badRes = await cronGet(
      new Request('http://localhost/api/cron/news-crawl', {
        headers: { Authorization: 'Bearer wrong-token' },
      })
    );
    assert.equal(badRes.status, 401);

    fetchMock.on(
      'http://127.0.0.1:5999/api/v1/cron/news-crawl',
      () => jsonResponse({ success: true, data: { inserted: 2 } }, 200),
      { method: 'POST' }
    );

    const okRes = await cronPost(
      new Request('http://localhost/api/cron/news-crawl', {
        method: 'POST',
        headers: { 'x-cron-secret': 'super-secret-cron-token-123456' },
      })
    );
    assert.equal(okRes.status, 200);
    const body = await okRes.json();
    assert.equal(body.success, true);
    assert.equal(body.backendStatus, 200);

    const forwarded = fetchMock.getCallsFor('/api/v1/cron/news-crawl', 'POST');
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].headers['authorization'], 'Bearer super-secret-cron-token-123456');
  });
});
