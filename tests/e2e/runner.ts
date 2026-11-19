import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from 'node:test';
import { spec } from 'node:test/reporters';

interface RunnerOptions {
  tier: string;
  mode: string;
  feature?: string;
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  let tier = 'all';
  let mode = 'hermetic';
  let feature: string | undefined = undefined;

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      tier = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--mode=')) {
      mode = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--feature=')) {
      feature = arg.split('=')[1].toUpperCase();
    }
  }

  return { tier, mode, feature };
}

function discoverTestFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.js'))) {
      files.push(path.join(dirPath, entry.name));
    }
  }
  return files.sort();
}

async function main() {
  const options = parseArgs();
  console.log(`\n===============================================================`);
  console.log(`  Danger Zone BD - 4-Tier E2E Test Suite Runner`);
  console.log(`  Tier filter: ${options.tier.toUpperCase()} | Mode: ${options.mode.toUpperCase()}`);
  if (options.feature) {
    console.log(`  Feature filter: ${options.feature}`);
  }
  console.log(`===============================================================\n`);

  process.env.TEST_MODE = options.mode;
  process.env.NODE_ENV = 'test';
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://mock:mock@127.0.0.1:5432/dangerzone_mock';
  }
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'mock-jwt-secret-at-least-32-chars-long-danger-zone-bd';
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    process.env.JWT_REFRESH_SECRET = 'mock-jwt-refresh-secret-at-least-32-chars-long-danger-zone-bd';
  }
  if (!process.env.CRON_SECRET) {
    process.env.CRON_SECRET = 'danger-zone-bd-cron-crawler-secret-2026';
  }

  const rootDir = process.cwd();
  const tier1Dir = path.join(rootDir, 'tests/e2e/tier1-features');
  const tier2Dir = path.join(rootDir, 'tests/e2e/tier2-boundaries');
  const tier3Dir = path.join(rootDir, 'tests/e2e/tier3-pairwise');
  const tier4Dir = path.join(rootDir, 'tests/e2e/tier4-realworld');

  const testFilesMap: Record<string, string[]> = {
    '1': discoverTestFiles(tier1Dir),
    '2': discoverTestFiles(tier2Dir),
    '3': discoverTestFiles(tier3Dir),
    '4': discoverTestFiles(tier4Dir),
  };

  let selectedFiles: string[] = [];

  if (options.tier === 'all') {
    selectedFiles = [
      ...testFilesMap['1'],
      ...testFilesMap['2'],
      ...testFilesMap['3'],
      ...testFilesMap['4'],
    ];
  } else if (testFilesMap[options.tier]) {
    selectedFiles = testFilesMap[options.tier];
  } else {
    console.error(`Invalid tier "${options.tier}". Allowed: 1, 2, 3, 4, all.`);
    process.exit(1);
  }

  if (options.feature) {
    const featLower = options.feature.toLowerCase();
    selectedFiles = selectedFiles.filter((f) => path.basename(f).toLowerCase().includes(featLower));
    console.log(`Filtered to feature "${options.feature}": ${selectedFiles.length} file(s) matched.`);
  }

  if (selectedFiles.length === 0) {
    console.warn(`No test files selected for execution.`);
    process.exit(0);
  }

  console.log(`Running ${selectedFiles.length} test suite file(s)...`);

  // Detect tsx loader URL dynamically
  let loaderUrl: string;
  try {
    loaderUrl = pathToFileURL(require.resolve('tsx')).href;
  } catch {
    loaderUrl = 'tsx';
  }

  const stream = (run as any)({
    files: selectedFiles,
    concurrency: 1,
    timeout: 120_000,
    execArgv: ['--import', loaderUrl],
  });

  (stream.compose as any)(spec).pipe(process.stdout);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  stream.on('test:pass', () => {
    passed++;
  });

  stream.on('test:fail', () => {
    failed++;
  });

  stream.on('test:skip', () => {
    skipped++;
  });

  await new Promise<void>((resolve) => {
    stream.on('end', () => {
      resolve();
    });
  });

  console.log(`\n===============================================================`);
  console.log(`  E2E Test Execution Summary`);
  console.log(`  Total: ${passed + failed + skipped} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log(`===============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error in E2E runner:', err);
  process.exit(1);
});
