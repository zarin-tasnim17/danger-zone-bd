import fs from 'fs';
import path from 'path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { TEST_CONFIG } from './config';

type ProfileName =
  | 'all'
  | 'functional'
  | 'auth'
  | 'authorization'
  | 'validation'
  | 'security'
  | 'database'
  | 'workflows'
  | 'performance'
  | 'regression'
  | 'ci'
  | 'report';

const testsRoot = path.resolve(__dirname, '..');

const listFiles = (dirName: string): string[] => {
  const fullDir = path.join(testsRoot, dirName);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith('.test.ts'))
    .sort()
    .map((f) => path.join(fullDir, f));
};

const PROFILE_FILES: Record<ProfileName, string[]> = {
  functional: listFiles('api'),
  auth: listFiles('authentication'),
  authorization: listFiles('authorization'),
  validation: listFiles('validation'),
  security: listFiles('security'),
  database: listFiles('database'),
  workflows: listFiles('workflows'),
  performance: listFiles('performance'),
  regression: listFiles('regression'),
  ci: [
    ...listFiles('api'),
    ...listFiles('authentication'),
    ...listFiles('authorization'),
    ...listFiles('validation'),
    ...listFiles('security'),
    ...listFiles('database'),
    ...listFiles('workflows'),
  ],
  all: [
    ...listFiles('api'),
    ...listFiles('authentication'),
    ...listFiles('authorization'),
    ...listFiles('validation'),
    ...listFiles('security'),
    ...listFiles('database'),
    ...listFiles('workflows'),
    ...listFiles('performance'),
  ],
  report: [
    ...listFiles('api'),
    ...listFiles('authentication'),
    ...listFiles('authorization'),
    ...listFiles('validation'),
    ...listFiles('security'),
    ...listFiles('database'),
    ...listFiles('workflows'),
    ...listFiles('performance'),
    ...listFiles('regression'),
  ],
};

interface RecordedCase {
  name: string;
  file: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  error?: string;
}

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseProfileArg = (): ProfileName => {
  const arg = process.argv.find((a) => a.startsWith('--profile='));
  const val = (arg?.split('=')[1] || 'all') as ProfileName;
  if (!(val in PROFILE_FILES)) {
    throw new Error(`Unknown profile "${val}". Valid: ${Object.keys(PROFILE_FILES).join(', ')}`);
  }
  return val;
};

const main = async () => {
  const profile = parseProfileArg();
  const files = PROFILE_FILES[profile];
  if (files.length === 0) {
    console.error(`No test files found for profile "${profile}"`);
    process.exit(1);
  }

  fs.mkdirSync(TEST_CONFIG.reportsDir, { recursive: true });
  const cases: RecordedCase[] = [];
  const startedAt = new Date().toISOString();
  const startMs = performance.now();

  const stream = run({
    files,
    concurrency: 1,
    timeout: 90000,
    forceExit: true,
    execArgv: ['--import', 'tsx'],
  });

  stream.on('test:pass', (evt: any) => {
    if (evt.details?.type === 'suite') return;
    cases.push({
      name: evt.name,
      file: path.relative(TEST_CONFIG.apiRoot, evt.file || ''),
      status: evt.skip ? 'SKIP' : 'PASS',
      durationMs: Number((evt.details?.duration_ms ?? 0).toFixed(2)),
    });
  });

  stream.on('test:fail', (evt: any) => {
    if (evt.details?.type === 'suite') return;
    const errMsg =
      evt.details?.error?.cause?.message ||
      evt.details?.error?.message ||
      String(evt.details?.error || 'Test failed');
    cases.push({
      name: evt.name,
      file: path.relative(TEST_CONFIG.apiRoot, evt.file || ''),
      status: 'FAIL',
      durationMs: Number((evt.details?.duration_ms ?? 0).toFixed(2)),
      error: errMsg,
    });
  });

  stream.compose(spec).pipe(process.stdout);

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    stream.once('end', finish);
    stream.once('close', finish);
    stream.resume();
  });

  const totalDurationMs = Number((performance.now() - startMs).toFixed(2));
  const passed = cases.filter((c) => c.status === 'PASS').length;
  const failed = cases.filter((c) => c.status === 'FAIL').length;
  const skipped = cases.filter((c) => c.status === 'SKIP').length;
  const finishedAt = new Date().toISOString();

  const resultsPayload = {
    profile,
    startedAt,
    finishedAt,
    totalDurationMs,
    summary: {
      total: cases.length,
      passed,
      failed,
      skipped,
    },
    cases,
  };

  fs.writeFileSync(
    path.join(TEST_CONFIG.reportsDir, 'results.json'),
    JSON.stringify(resultsPayload, null, 2)
  );

  // JUnit XML report
  const junitLines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<testsuite name="dangerzonebd-api-${profile}" tests="${cases.length}" failures="${failed}" skipped="${skipped}" time="${(
      totalDurationMs / 1000
    ).toFixed(3)}">`,
    ...cases.map((c) => {
      const timeSec = (c.durationMs / 1000).toFixed(3);
      if (c.status === 'FAIL') {
        return `  <testcase classname="${escapeXml(c.file)}" name="${escapeXml(
          c.name
        )}" time="${timeSec}"><failure message="${escapeXml(
          c.error || 'Failed'
        )}">${escapeXml(c.error || 'Failed')}</failure></testcase>`;
      }
      if (c.status === 'SKIP') {
        return `  <testcase classname="${escapeXml(c.file)}" name="${escapeXml(
          c.name
        )}" time="${timeSec}"><skipped/></testcase>`;
      }
      return `  <testcase classname="${escapeXml(c.file)}" name="${escapeXml(
        c.name
      )}" time="${timeSec}"/>`;
    }),
    `</testsuite>`,
  ];
  fs.writeFileSync(path.join(TEST_CONFIG.reportsDir, 'junit.xml'), junitLines.join('\n'));

  // Coverage summary JSON
  const byFile: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const c of cases) {
    const bucket = (byFile[c.file] ||= { total: 0, passed: 0, failed: 0 });
    bucket.total += 1;
    if (c.status === 'PASS') bucket.passed += 1;
    if (c.status === 'FAIL') bucket.failed += 1;
  }

  let perfMetrics: unknown = null;
  const perfPath = path.join(TEST_CONFIG.reportsDir, 'perf-metrics.json');
  if (fs.existsSync(perfPath)) {
    try {
      perfMetrics = JSON.parse(fs.readFileSync(perfPath, 'utf8'));
    } catch {
      perfMetrics = null;
    }
  }

  fs.writeFileSync(
    path.join(TEST_CONFIG.reportsDir, 'coverage-summary.json'),
    JSON.stringify(
      {
        profile,
        generatedAt: finishedAt,
        inventoriedEndpoints: { express: 43, nextProxy: 3, websocket: 1, total: 47 },
        suiteBreakdown: byFile,
        summary: resultsPayload.summary,
        perfMetricsAvailable: Boolean(perfMetrics),
      },
      null,
      2
    )
  );

  // Self-contained HTML report
  const rowsHtml = cases
    .map(
      (c) => `<tr>
        <td><code>${c.file}</code></td>
        <td>${c.name.replace(/</g, '&lt;')}</td>
        <td class="${c.status.toLowerCase()}">${c.status}</td>
        <td>${c.durationMs} ms</td>
        <td>${(c.error || '').replace(/</g, '&lt;')}</td>
      </tr>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>DangerZoneBD API Test Report (${profile})</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 2rem; }
  h1, h2 { color: #f8fafc; }
  .cards { display: flex; gap: 1rem; margin: 1rem 0 2rem; flex-wrap: wrap; }
  .card { background: #1e293b; padding: 1rem 1.4rem; border-radius: 8px; border: 1px solid #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; background: #1e293b; }
  th, td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #334155; text-align: left; }
  th { background: #0f172a; }
  .pass { color: #4ade80; font-weight: 700; }
  .fail { color: #f87171; font-weight: 700; }
  .skip { color: #facc15; font-weight: 700; }
</style>
</head>
<body>
  <h1>DangerZoneBD Backend API Audit — Profile: ${profile}</h1>
  <p>Generated: ${finishedAt} | Total Duration: ${totalDurationMs} ms</p>
  <div class="cards">
    <div class="card">Total Cases: <strong>${cases.length}</strong></div>
    <div class="card pass">Passed: ${passed}</div>
    <div class="card fail">Failed: ${failed}</div>
    <div class="card skip">Skipped: ${skipped}</div>
  </div>
  <h2>Test Results</h2>
  <table>
    <thead><tr><th>Module</th><th>Case</th><th>Status</th><th>Duration</th><th>Details</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  fs.writeFileSync(path.join(TEST_CONFIG.reportsDir, 'report.html'), html);

  console.log(
    `\n[API Test Runner] Profile=${profile} Total=${cases.length} Passed=${passed} Failed=${failed} Skipped=${skipped} Time=${totalDurationMs}ms`
  );
  console.log(`[API Test Runner] Reports written to ${TEST_CONFIG.reportsDir}`);

  if (failed > 0 && profile !== 'report') {
    process.exitCode = 1;
  } else if (profile === 'ci' && failed > 0) {
    process.exitCode = 1;
  } else {
    const nonRegressionFailures = cases.filter(
      (c) => c.status === 'FAIL' && !c.file.includes('regression')
    ).length;
    process.exitCode = nonRegressionFailures > 0 ? 1 : 0;
  }
};

main().catch((err) => {
  console.error('[API Test Runner Error]', err);
  process.exit(1);
});
