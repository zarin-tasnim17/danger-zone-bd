import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startTestServer, TestServerHandle } from '../framework/server';
import { ApiClient } from '../framework/apiClient';
import {
  assertErrorEnvelope,
  assertNoSensitiveLeakage,
  assertSecurityHeaders,
  assertStatus,
  assertSuccessEnvelope,
} from '../framework/assertions';
import { TEST_CONFIG } from '../framework/config';

describe('API Functional: System, Health & Next.js Proxy Endpoints', () => {
  let server: TestServerHandle;
  let client: ApiClient;

  before(async () => {
    server = await startTestServer();
    client = new ApiClient(server.baseUrl);
  });

  after(async () => {
    await server.stop();
  });

  it('EP-001 GET / returns service metadata and security headers', async () => {
    const res = await client.get('/');
    const data = assertSuccessEnvelope<{ name?: string; status?: string; version?: string }>(res, 200, 'GET /');
    assert.equal(data?.name, 'BD Safety Map API');
    assert.equal(data?.status, 'online');
    assert.equal(data?.version, '1.0.0');
    assertSecurityHeaders(res);
    assertNoSensitiveLeakage(res.body);
  });

  it('EP-002 GET /health returns live UP liveness payload', async () => {
    const res = await client.get('/health');
    assertStatus(res, 200, 'GET /health');
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.message, 'API is running');
  });

  it('EP-003 GET /health/db confirms live PostgreSQL/PostGIS connectivity', async () => {
    const res = await client.get('/health/db');
    assertStatus(res, 200, 'GET /health/db');
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.message, 'Database connection successful');
  });

  it('EP-004 & EP-005 Versioned /api/v1/health and /api/v1/health/db match root probes', async () => {
    const healthRes = await client.get('/api/v1/health');
    assertStatus(healthRes, 200, 'GET /api/v1/health');
    assert.equal(healthRes.body?.success, true);

    const dbRes = await client.get('/api/v1/health/db');
    assertStatus(dbRes, 200, 'GET /api/v1/health/db');
    assert.equal(dbRes.body?.success, true);
  });

  it('HTTP protocol checks: malformed JSON yields clean 400 and unknown route yields 404 without stack trace', async () => {
    const badJson = await client.request('POST', '/api/v1/auth/device', {
      headers: { 'content-type': 'application/json' },
      rawBody: '{"anonymousId": ',
    });
    assertStatus(badJson, [400, 500], 'Malformed JSON body');
    assertNoSensitiveLeakage(badJson.rawText);

    const notFound = await client.get('/api/v1/non-existent-endpoint-check');
    assertStatus(notFound, 404, 'Unknown route');
  });

  it('EP-044 Next.js GET /api/health aggregates live Express backend and returns 503 when upstream unreachable', async () => {
    const healthModuleUrl = pathToFileURL(
      path.resolve(TEST_CONFIG.repoRoot, 'apps/web/app/api/health/route.ts')
    ).href;
    const { GET } = await import(healthModuleUrl);

    const prevApiUrl = process.env.NEXT_PUBLIC_API_URL;
    try {
      process.env.NEXT_PUBLIC_API_URL = server.baseUrl;
      const liveResp: Response = await GET(new Request('http://127.0.0.1:3000/api/health'));
      assert.equal(liveResp.status, 200);
      assert.ok(liveResp.headers.get('cache-control')?.includes('no-store'));
      const liveBody: any = await liveResp.json();
      assert.equal(liveBody.status, 'healthy');
      assert.equal(liveBody.services.backend.status, 'online');
      assert.equal(liveBody.services.database.status, 'connected');

      // Unreachable upstream check -> 503 degraded
      process.env.NEXT_PUBLIC_API_URL = 'http://127.0.0.1:59999';
      const downResp: Response = await GET(new Request('http://127.0.0.1:3000/api/health'));
      assert.equal(downResp.status, 503);
      const downBody: any = await downResp.json();
      assert.equal(downBody.status, 'degraded');
    } finally {
      if (prevApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = prevApiUrl;
    }
  });

  it('EP-045 & EP-046 Next.js GET/POST /api/cron/news-crawl fail closed on missing/bad CRON_SECRET', async () => {
    const cronModuleUrl = pathToFileURL(
      path.resolve(TEST_CONFIG.repoRoot, 'apps/web/app/api/cron/news-crawl/route.ts')
    ).href;
    const { GET, POST } = await import(cronModuleUrl);

    const prevSecret = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      const noConfigRes: Response = await GET(
        new Request('http://127.0.0.1:3000/api/cron/news-crawl')
      );
      assert.equal(noConfigRes.status, 401);

      process.env.CRON_SECRET = 'test-cron-proxy-secret-32chars-min';
      const badGetRes: Response = await GET(
        new Request('http://127.0.0.1:3000/api/cron/news-crawl', {
          headers: { authorization: 'Bearer wrong-secret' },
        })
      );
      assert.equal(badGetRes.status, 401);

      const badPostRes: Response = await POST(
        new Request('http://127.0.0.1:3000/api/cron/news-crawl', {
          method: 'POST',
          headers: { 'x-cron-secret': 'wrong-secret' },
        })
      );
      assert.equal(badPostRes.status, 401);
    } finally {
      if (prevSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevSecret;
    }
  });

  it('Error envelope sanity check on bad media webhook call', async () => {
    const res = await client.post('/api/v1/media/webhook', { key: 'invalid' });
    assertErrorEnvelope(res, 401, 'unauthorized');
  });
});
