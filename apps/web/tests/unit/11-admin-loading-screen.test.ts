import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { WEB_TEST_CONFIG } from '../framework/config';

describe('[Unit] Admin Security Console Premium Loading State', () => {
  it('1. AdminLoadingScreen component provides security badge, animated pulse, and progress bar', () => {
    const loadingScreenPath = path.join(WEB_TEST_CONFIG.webRoot, 'components/admin/AdminLoadingScreen.tsx');
    assert.ok(fs.existsSync(loadingScreenPath), 'AdminLoadingScreen.tsx must exist');

    const src = fs.readFileSync(loadingScreenPath, 'utf8');
    // ShieldAlert & animated spinner
    assert.ok(src.includes('ShieldAlert'));
    assert.ok(src.includes('animate-spin'));
    assert.ok(src.includes('animate-ping') || src.includes('animate-pulse'));
    // Bilingual headline support
    assert.ok(src.includes('Loading Security Console'));
    assert.ok(src.includes('অ্যাডমিন কনসোল প্রস্তুত হচ্ছে'));
    // Error state and retry callback support
    assert.ok(src.includes('onRetry'));
    assert.ok(src.includes('Retry Connection'));
    assert.ok(src.includes('পুনরায় চেষ্টা করুন'));
    // Encryption note
    assert.ok(src.includes('Encrypted Admin Feed'));
  });

  it('2. AdminHeader displays dynamic "Refreshing..." / "রিফ্রেশ হচ্ছে..." state when isLoadingData is true', () => {
    const headerPath = path.join(WEB_TEST_CONFIG.webRoot, 'components/admin/AdminHeader.tsx');
    const src = fs.readFileSync(headerPath, 'utf8');

    assert.ok(src.includes('isLoadingData ? (isBn ? "রিফ্রেশ হচ্ছে..." : "Refreshing...") : (isBn ? "রিফ্রেশ" : "Refresh")'));
    assert.ok(src.includes('animate-spin text-red-600'));
  });

  it('3. AdminPage guards initial data load with AdminLoadingScreen to prevent frozen 0-counts perception', () => {
    const adminPagePath = path.join(WEB_TEST_CONFIG.webRoot, 'app/admin/page.tsx');
    const src = fs.readFileSync(adminPagePath, 'utf8');

    // Asserts AdminLoadingScreen is imported and used
    assert.ok(src.includes('AdminLoadingScreen'));
    assert.ok(src.includes('hasLoadedOnce'));
    assert.ok(src.includes('!hasLoadedOnce && (isLoadingData || dataError)'));

    // Asserts auth initialization also shows the loading screen instead of flashing gateway
    assert.ok(src.includes('isLoadingAuth'));

    // Asserts parallel Promise.all query execution for fast load times
    assert.ok(src.includes('Promise.all(['));
  });

  it('4. AdminAnalyticsSection displays animated skeleton placeholders when trends are loading', () => {
    const analyticsPath = path.join(WEB_TEST_CONFIG.webRoot, 'components/admin/AdminAnalyticsSection.tsx');
    const src = fs.readFileSync(analyticsPath, 'utf8');

    assert.ok(src.includes('isLoadingTrends && !trends'));
    assert.ok(src.includes('animate-pulse'));
  });
});
