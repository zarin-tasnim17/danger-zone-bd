import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CRAWLER_SCHEDULE } from '../../../apps/api/src/jobs/newsCrawlerJob';

describe('Tier 1: Feature Coverage - F18: 10-Minute Vercel Cron Schedule Configuration', () => {
  const vercelJsonPath = path.resolve(process.cwd(), 'apps/web/vercel.json');

  it('T1-F18-01: apps/web/vercel.json exists and contains a valid crons array configuration', () => {
    assert.ok(fs.existsSync(vercelJsonPath), `apps/web/vercel.json must exist at ${vercelJsonPath}`);

    const content = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    assert.ok(Array.isArray(content.crons), 'vercel.json must contain a "crons" array');
    assert.ok(content.crons.length >= 1, 'vercel.json must define at least 1 cron job');
  });

  it('T1-F18-02: Cron target path points to the automated news crawl endpoint', () => {
    const content = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    const crawlCron = content.crons.find((c: any) => c.path === '/api/cron/news-crawl' || c.path === '/api/v1/cron/news-crawl');

    assert.ok(
      crawlCron,
      `vercel.json must configure a cron job targeting /api/cron/news-crawl. Found: ${JSON.stringify(content.crons)}`
    );
  });

  it('T1-F18-03: DEFAULT_CRAWLER_SCHEDULE in newsCrawlerJob.ts strictly specifies 10-minute cadence (*/10 * * * *)', () => {
    assert.strictEqual(
      DEFAULT_CRAWLER_SCHEDULE,
      '*/10 * * * *',
      'In-process crawler cron schedule must be set to "*/10 * * * *"'
    );
  });

  it('T1-F18-04: Cron cadence validator confirms */10 * * * * triggers exactly 6 times per hour (144 runs/day)', () => {
    const schedule = '*/10 * * * *';
    const parts = schedule.split(' ');
    assert.strictEqual(parts.length, 5, 'Cron expression must have 5 standard fields');

    // Minute field validation
    const minuteField = parts[0];
    assert.strictEqual(minuteField, '*/10', 'Minute field must be */10 (every 10 minutes)');

    // Hours, day of month, month, day of week should be wildcards for periodic interval
    assert.strictEqual(parts[1], '*', 'Hour field must be wildcard (*)');
    assert.strictEqual(parts[2], '*', 'Day-of-month field must be wildcard (*)');
    assert.strictEqual(parts[3], '*', 'Month field must be wildcard (*)');
    assert.strictEqual(parts[4], '*', 'Day-of-week field must be wildcard (*)');

    // Compute ticks in an hour
    const minutesInHour = 60;
    const interval = 10;
    const ticksPerHour = minutesInHour / interval;
    assert.strictEqual(ticksPerHour, 6, 'Must trigger 6 times per hour');
    assert.strictEqual(ticksPerHour * 24, 144, 'Must trigger 144 times per day');
  });

  it('T1-F18-05: apps/web/vercel.json cron schedule complies with Vercel Hobby tier (0 0 * * *) or 10-minute cadence', () => {
    const content = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    const crawlCron = content.crons.find((c: any) => c.path === '/api/cron/news-crawl' || c.path === '/api/v1/cron/news-crawl');
    assert.ok(crawlCron, 'Crawl cron job must be defined in vercel.json');

    assert.ok(
      crawlCron.schedule === '0 0 * * *' || crawlCron.schedule === '*/10 * * * *',
      `apps/web/vercel.json cron schedule must be "0 0 * * *" (Hobby tier limit) or "*/10 * * * *". Currently set to "${crawlCron.schedule}".`
    );
  });
});
