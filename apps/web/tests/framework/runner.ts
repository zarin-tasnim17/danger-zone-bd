import fs from 'fs';
import path from 'path';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import { WEB_TEST_CONFIG } from './config';
import { buildCoverageSummary } from './coverageRegistry';

type ProfileName =
  | 'all'
  | 'unit'
  | 'mocked'
  | 'contracts'
  | 'auth'
  | 'forms'
  | 'components'
  | 'workflows'
  | 'live'
  | 'e2e'
  | 'regression'
  | 'ci'
  | 'report';

type ExecutionLayer = 'mocked' | 'contract' | 'liveBackend' | 'browserE2E' | 'regression';

interface RecordedCase {
  name: string;
  file: string;
  layer: ExecutionLayer;
  status: 'PASS' | 'FAIL' | 'SKIP';
  durationMs: number;
  error?: string;
}

const testsRoot = WEB_TEST_CONFIG.testsRoot;

const listFiles = (dirName: string): string[] => {
  const fullDir = path.join(testsRoot, dirName);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'))
    .sort()
    .map((f) => path.join(fullDir, f));
};

const resolveLayer = (filePath: string): ExecutionLayer => {
  const rel = path.relative(testsRoot, filePath).replace(/\\/g, '/');
  if (rel.startsWith('regression/')) return 'regression';
  if (rel.startsWith('e2e/')) return 'browserE2E';
  if (rel.startsWith('workflows/')) return 'liveBackend';
  if (rel.startsWith('contracts/')) return 'contract';
  return 'mocked';
};

const PROFILE_FILES: Record<ProfileName, string[]> = {
  unit: listFiles('unit'),
  mocked: [...listFiles('unit'), ...listFiles('api')],
  contracts: listFiles('contracts'),
  auth: [...listFiles('authentication'), ...listFiles('authorization')],
  forms: listFiles('forms'),
  components: listFiles('components'),
  live: listFiles('workflows'),
  workflows: listFiles('workflows'),
  e2e: listFiles('e2e'),
  regression: listFiles('regression'),
  ci: [
    ...listFiles('unit'),
    ...listFiles('api'),
    ...listFiles('contracts'),
    ...listFiles('authentication'),
    ...listFiles('authorization'),
    ...listFiles('forms'),
    ...listFiles('components'),
    ...listFiles('workflows'),
  ],
  all: [
    ...listFiles('unit'),
    ...listFiles('api'),
    ...listFiles('contracts'),
    ...listFiles('authentication'),
    ...listFiles('authorization'),
    ...listFiles('forms'),
    ...listFiles('components'),
    ...listFiles('workflows'),
    ...listFiles('e2e'),
  ],
  report: [
    ...listFiles('unit'),
    ...listFiles('api'),
    ...listFiles('contracts'),
    ...listFiles('authentication'),
    ...listFiles('authorization'),
    ...listFiles('forms'),
    ...listFiles('components'),
    ...listFiles('workflows'),
    ...listFiles('e2e'),
    ...listFiles('regression'),
  ],
};

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseProfile = (): ProfileName => {
  const arg = process.argv.find((a) => a.startsWith('--profile='));
  const raw = (arg ? arg.split('=')[1] : 'all') as ProfileName;
  if (!(raw in PROFILE_FILES)) {
    throw new Error(`Unknown profile "${raw}". Valid profiles: ${Object.keys(PROFILE_FILES).join(', ')}`);
  }
  return raw;
};

const main = async () => {
  const profile = parseProfile();
  const files = PROFILE_FILES[profile];
  const strictRegression = process.argv.includes('--strict-regression') || profile === 'regression';

  if (files.length === 0) {
    console.error(`[web-test-runner] No test files found for profile "${profile}"`);
    process.exit(1);
  }

  console.log(`\n================================================================`);
  console.log(` DangerZoneBD Frontend API Test Runner | profile="${profile}"`);
  console.log(` Test files (${files.length}):`);
  for (const f of files) {
    console.log(`   - [${resolveLayer(f)}] ${path.relative(testsRoot, f).replace(/\\/g, '/')}`);
  }
  console.log(`================================================================\n`);

  const recorded: RecordedCase[] = [];
  const startTime = Date.now();

  const stream = run({
    files,
    concurrency: false,
    timeout: 180_000,
    execArgv: process.execArgv,
  } as any);

  stream.on('test:pass', (data: any) => {
    if (data.details?.type === 'suite') return;
    const file = path.relative(testsRoot, data.file || 'unknown').replace(/\\/g, '/');
    recorded.push({
      name: data.name,
      file,
      layer: resolveLayer(data.file || ''),
      status: data.skip ? 'SKIP' : 'PASS',
      durationMs: Number((data.details?.duration_ms || 0).toFixed(2)),
    });
  });

  stream.on('test:fail', (data: any) => {
    if (data.details?.type === 'suite') return;
    const file = path.relative(testsRoot, data.file || 'unknown').replace(/\\/g, '/');
    const errObj = data.details?.error;
    const msg =
      errObj instanceof Error
        ? errObj.message
        : typeof errObj === 'object' && errObj !== null && 'cause' in errObj
          ? String((errObj as any).cause?.message || (errObj as any).message || JSON.stringify(errObj))
          : String(errObj || 'Test failed');
    recorded.push({
      name: data.name,
      file,
      layer: resolveLayer(data.file || ''),
      status: 'FAIL',
      durationMs: Number((data.details?.duration_ms || 0).toFixed(2)),
      error: msg,
    });
  });

  stream.compose(spec as any).pipe(process.stdout);

  await new Promise<void>((resolve) => {
    stream.on('end', () => resolve());
  });

  const totalDurationMs = Number((Date.now() - startTime).toFixed(2));

  const summarize = (items: RecordedCase[]) => ({
    total: items.length,
    passed: items.filter((i) => i.status === 'PASS').length,
    failed: items.filter((i) => i.status === 'FAIL').length,
    skipped: items.filter((i) => i.status === 'SKIP').length,
  });

  const verificationCases = recorded.filter((c) => c.layer !== 'regression');
  const regressionCases = recorded.filter((c) => c.layer === 'regression');

  const layerSummary = {
    mocked: summarize(recorded.filter((c) => c.layer === 'mocked')),
    contract: summarize(recorded.filter((c) => c.layer === 'contract')),
    liveBackend: summarize(recorded.filter((c) => c.layer === 'liveBackend')),
    browserE2E: summarize(recorded.filter((c) => c.layer === 'browserE2E')),
    regression: summarize(regressionCases),
  };

  const resultsPayload = {
    generatedAt: new Date().toISOString(),
    profile,
    totalDurationMs,
    overall: summarize(recorded),
    verificationSuites: summarize(verificationCases),
    defectRegressionSuite: summarize(regressionCases),
    layers: layerSummary,
    cases: recorded,
  };

  const coveragePayload = {
    generatedAt: new Date().toISOString(),
    profile,
    ...buildCoverageSummary(),
  };

  if (profile === 'report' || profile === 'all' || profile === 'ci') {
    fs.mkdirSync(WEB_TEST_CONFIG.reportsDir, { recursive: true });

    fs.writeFileSync(
      path.join(WEB_TEST_CONFIG.reportsDir, 'results.json'),
      JSON.stringify(resultsPayload, null, 2),
      'utf8'
    );

    fs.writeFileSync(
      path.join(WEB_TEST_CONFIG.reportsDir, 'coverage-summary.json'),
      JSON.stringify(coveragePayload, null, 2),
      'utf8'
    );

    const junitCases = recorded
      .map((c) => {
        const cls = escapeXml(`${c.layer}:${c.file}`);
        const name = escapeXml(c.name);
        const time = (c.durationMs / 1000).toFixed(4);
        if (c.status === 'FAIL') {
          return `    <testcase classname="${cls}" name="${name}" time="${time}">\n      <failure message="${escapeXml(c.error || 'Failed')}">${escapeXml(c.error || '')}</failure>\n    </testcase>`;
        }
        if (c.status === 'SKIP') {
          return `    <testcase classname="${cls}" name="${name}" time="${time}">\n      <skipped/>\n    </testcase>`;
        }
        return `    <testcase classname="${cls}" name="${name}" time="${time}" />`;
      })
      .join('\n');

    const junitXml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="DangerZoneBD-Frontend-API-Tests" tests="${resultsPayload.overall.total}" failures="${resultsPayload.overall.failed}" skipped="${resultsPayload.overall.skipped}" time="${(totalDurationMs / 1000).toFixed(3)}">\n${junitCases}\n</testsuite>\n`;
    fs.writeFileSync(path.join(WEB_TEST_CONFIG.reportsDir, 'junit.xml'), junitXml, 'utf8');

    const rowsHtml = recorded
      .map(
        (c) => `
      <tr>
        <td><span class="badge layer-${c.layer}">${c.layer}</span></td>
        <td><code>${escapeXml(c.file)}</code></td>
        <td>${escapeXml(c.name)}</td>
        <td><span class="status status-${c.status}">${c.status}</span></td>
        <td>${c.durationMs} ms</td>
        <td><small>${c.error ? escapeXml(c.error) : ''}</small></td>
      </tr>`
      )
      .join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>DangerZoneBD Frontend API Audit Test Report</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
  h1 { margin-bottom: 4px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 16px 0 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .card h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #64748b; }
  .card p { margin: 0; font-size: 20px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 13px; vertical-align: top; }
  th { background: #f1f5f9; }
  .status-PASS { color: #15803d; font-weight: 700; }
  .status-FAIL { color: #b91c1c; font-weight: 700; }
  .status-SKIP { color: #a16207; font-weight: 700; }
  .badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e2e8f0; }
  .layer-liveBackend { background: #dbeafe; color: #1d4ed8; }
  .layer-browserE2E { background: #dcfce7; color: #166534; }
  .layer-regression { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
  <h1>DangerZoneBD Frontend API Integration Test Report</h1>
  <p>Profile: <strong>${escapeXml(profile)}</strong> | Generated: ${resultsPayload.generatedAt} | Duration: ${(totalDurationMs / 1000).toFixed(2)}s</p>
  <div class="cards">
    <div class="card"><h3>Mocked Unit/API/Forms</h3><p>${layerSummary.mocked.passed}/${layerSummary.mocked.total} passed</p></div>
    <div class="card"><h3>Contract Validation</h3><p>${layerSummary.contract.passed}/${layerSummary.contract.total} passed</p></div>
    <div class="card"><h3>Live Backend Integration</h3><p>${layerSummary.liveBackend.passed}/${layerSummary.liveBackend.total} passed</p></div>
    <div class="card"><h3>Real Chromium E2E</h3><p>${layerSummary.browserE2E.passed}/${layerSummary.browserE2E.total} passed</p></div>
    <div class="card"><h3>Defect Regression (Unfixed)</h3><p>${layerSummary.regression.failed} confirmed / ${layerSummary.regression.total}</p></div>
  </div>
  <table>
    <thead><tr><th>Layer</th><th>File</th><th>Test Case</th><th>Status</th><th>Duration</th><th>Details</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
    fs.writeFileSync(path.join(WEB_TEST_CONFIG.reportsDir, 'report.html'), html, 'utf8');
  }

  console.log('\n================================================================');
  console.log(' EXECUTION LAYER SUMMARY (Mocked vs Live Strictly Separated)');
  console.log('----------------------------------------------------------------');
  console.log(` Mocked (Unit/Resilience/Auth/Forms/Comp): ${layerSummary.mocked.passed}/${layerSummary.mocked.total} PASS (${layerSummary.mocked.failed} FAIL)`);
  console.log(` Contracts (47-endpoint schema parity)   : ${layerSummary.contract.passed}/${layerSummary.contract.total} PASS (${layerSummary.contract.failed} FAIL)`);
  console.log(` Live Backend (Express + Postgres + IO)  : ${layerSummary.liveBackend.passed}/${layerSummary.liveBackend.total} PASS (${layerSummary.liveBackend.failed} FAIL)`);
  console.log(` Browser E2E (Headless Chromium + Next)  : ${layerSummary.browserE2E.passed}/${layerSummary.browserE2E.total} PASS (${layerSummary.browserE2E.failed} FAIL)`);
  console.log(` Defect Regression (Assert fixed state)  : ${layerSummary.regression.passed}/${layerSummary.regression.total} PASS (${layerSummary.regression.failed} FAIL - expected while app unfixed)`);
  console.log(` Duration: ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log('================================================================\n');

  const verificationFailures = verificationCases.filter((c) => c.status === 'FAIL').length;
  const regressionFailures = regressionCases.filter((c) => c.status === 'FAIL').length;

  const exitCode = verificationFailures > 0 || (strictRegression && regressionFailures > 0) ? 1 : 0;
  process.exit(exitCode);
};

main().catch((err) => {
  console.error('[web-test-runner] Fatal error:', err);
  process.exit(1);
});
