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

async function main() {
  const options = parseArgs();
  console.log(`\n===============================================================`);
  console.log(`  Safe Routes Engine - 4-Tier E2E Test Suite Runner`);
  console.log(`  Tier filter: ${options.tier.toUpperCase()} | Mode: ${options.mode.toUpperCase()}`);
  console.log(`===============================================================\n`);

  process.env.TEST_MODE = options.mode;

  const rootDir = process.cwd();
  const testFilesMap: Record<string, string[]> = {
    '1': [
      path.join(rootDir, 'tests/e2e/tier1-features/t1-r1-routing.test.ts'),
      path.join(rootDir, 'tests/e2e/tier1-features/t1-r2-hazards.test.ts'),
      path.join(rootDir, 'tests/e2e/tier1-features/t1-r3-scoring.test.ts'),
      path.join(rootDir, 'tests/e2e/tier1-features/t1-r4-modes.test.ts'),
      path.join(rootDir, 'tests/e2e/tier1-features/t1-r5-contracts.test.ts'),
    ],
    '2': [
      path.join(rootDir, 'tests/e2e/tier2-boundaries/t2-r1-routing-limits.test.ts'),
      path.join(rootDir, 'tests/e2e/tier2-boundaries/t2-r2-spatial-corridors.test.ts'),
      path.join(rootDir, 'tests/e2e/tier2-boundaries/t2-r3-scoring-extremes.test.ts'),
      path.join(rootDir, 'tests/e2e/tier2-boundaries/t2-r4-modes-guidance.test.ts'),
      path.join(rootDir, 'tests/e2e/tier2-boundaries/t2-r5-payload-schema.test.ts'),
    ],
    '3': [
      path.join(rootDir, 'tests/e2e/tier3-pairwise/t3-pairwise-matrix.test.ts'),
    ],
    '4': [
      path.join(rootDir, 'tests/e2e/tier4-realworld/t4-realworld-scenarios.test.ts'),
    ],
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
    selectedFiles = selectedFiles.filter((f) => f.toLowerCase().includes(featLower));
    console.log(`Filtered to feature: ${options.feature} (${selectedFiles.length} file(s))`);
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
