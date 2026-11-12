import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { startTestServer, TestServerHandle } from '../framework/server';
import { ApiClient } from '../framework/apiClient';
import { nextTestIp } from '../framework/authHelpers';
import { TEST_CONFIG } from '../framework/config';
import { assertNoSensitiveLeakage } from '../framework/assertions';
import { SeededPrng } from '../framework/fixtures';

interface LatencyStats {
  endpoint: string;
  requests: number;
  concurrency: number;
  successCount: number;
  errorCount: number;
  minMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  rps: number;
}

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(2));
};

const runLoadProbe = async (
  endpointLabel: string,
  totalRequests: number,
  concurrency: number,
  execFn: () => Promise<{ status: number; durationMs: number }>
): Promise<LatencyStats> => {
  const latencies: number[] = [];
  let successCount = 0;
  let errorCount = 0;
  let nextIdx = 0;

  const startedAt = performance.now();

  const worker = async () => {
    while (true) {
      const idx = nextIdx;
      nextIdx += 1;
      if (idx >= totalRequests) break;
      const res = await execFn();
      latencies.push(res.durationMs);
      if (res.status >= 200 && res.status < 400) successCount += 1;
      else errorCount += 1;
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const wallMs = Math.max(1, performance.now() - startedAt);
  latencies.sort((a, b) => a - b);

  return {
    endpoint: endpointLabel,
    requests: totalRequests,
    concurrency,
    successCount,
    errorCount,
    minMs: Number((latencies[0] ?? 0).toFixed(2)),
    p50Ms: percentile(latencies, 50),
    p90Ms: percentile(latencies, 90),
    p95Ms: percentile(latencies, 95),
    p99Ms: percentile(latencies, 99),
    maxMs: Number((latencies[latencies.length - 1] ?? 0).toFixed(2)),
    rps: Number(((totalRequests * 1000) / wallMs).toFixed(2)),
  };
};

describe('Performance Baseline & Deterministic Fuzzing Suite', () => {
  let server: TestServerHandle;
  let client: ApiClient;

  before(async () => {
    server = await startTestServer();
    client = new ApiClient(server.baseUrl, nextTestIp());
  });

  after(async () => {
    await server.stop();
  });

  it('Deterministic fuzzing (30 seeded mutations) yields zero 500 crashes and zero info leaks', async () => {
    const rng = new SeededPrng(20261112);
    const weirdStrings = ['', '   ', 'null', 'undefined', 'NaN', 'Infinity', '999999', "';--", '<svg>', '🚀'];

    for (let i = 0; i < 30; i += 1) {
      const q = new URLSearchParams({
        minLng: i % 3 === 0 ? rng.pick(weirdStrings) : String(90.2 + rng.next() * 0.2),
        minLat: String(23.6 + rng.next() * 0.2),
        maxLng: String(90.5 + rng.next() * 0.2),
        maxLat: String(23.9 + rng.next() * 0.2),
        hours: rng.pick(['24', '-5', 'abc', '999999999']),
      });

      const r1 = await client.get(`/api/v1/reports?${q.toString()}`);
      assert.ok(r1.status === 200 || r1.status === 400, `Unexpected status ${r1.status} on fuzzed /reports`);
      assertNoSensitiveLeakage(r1.rawText);

      const routeRes = await client.post('/api/v1/routes/safe-path', {
        startLat: i % 4 === 0 ? 999 : 23.7 + rng.next() * 0.1,
        startLng: 90.35 + rng.next() * 0.1,
        endLat: 23.72 + rng.next() * 0.1,
        endLng: 90.36 + rng.next() * 0.1,
      });
      assert.ok(
        routeRes.status === 200 || routeRes.status === 400,
        `Unexpected status ${routeRes.status} on fuzzed /routes/safe-path`
      );
      assertNoSensitiveLeakage(routeRes.rawText);
    }
  });

  it('Measures bounded concurrency latency (P50/P90/P95/P99 & RPS) across core read/compute endpoints', async () => {
    const n = TEST_CONFIG.perfIterations;
    const c = TEST_CONFIG.perfConcurrency;

    // Warmup call so lazy PostGIS / Prisma pool is initialized cleanly before benchmark
    await client.get('/api/v1/safe-zones?minLng=90.30&minLat=23.70&maxLng=90.45&maxLat=23.85');

    const metrics: LatencyStats[] = [];
    metrics.push(
      await runLoadProbe('GET /health', n, c, () => client.get('/health'))
    );
    metrics.push(
      await runLoadProbe('GET /api/v1/stats', n, c, () => client.get('/api/v1/stats'))
    );
    metrics.push(
      await runLoadProbe('GET /api/v1/reports (Dhaka bounds)', n, c, () =>
        client.get('/api/v1/reports?minLng=90.30&minLat=23.70&maxLng=90.45&maxLat=23.85')
      )
    );
    metrics.push(
      await runLoadProbe('GET /api/v1/safe-zones (Dhaka bounds)', n, c, () =>
        client.get('/api/v1/safe-zones?minLng=90.30&minLat=23.70&maxLng=90.45&maxLat=23.85')
      )
    );
    metrics.push(
      await runLoadProbe('POST /api/v1/routes/safe-path', n, c, () =>
        client.post('/api/v1/routes/safe-path', TEST_CONFIG.routeSample)
      )
    );

    fs.mkdirSync(TEST_CONFIG.reportsDir, { recursive: true });
    fs.writeFileSync(
      path.join(TEST_CONFIG.reportsDir, 'perf-metrics.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          targetRequestsPerEndpoint: n,
          concurrency: c,
          benchmarks: metrics,
        },
        null,
        2
      )
    );

    for (const m of metrics) {
      assert.equal(m.errorCount, 0, `${m.endpoint} had unexpected errors under concurrency`);
      assert.ok(m.p95Ms < 5000, `${m.endpoint} P95 exceeded 5000ms (${m.p95Ms}ms)`);
    }
  });
});
