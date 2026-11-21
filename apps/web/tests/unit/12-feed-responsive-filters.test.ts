import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { WEB_TEST_CONFIG } from '../framework/config';

describe('[Unit] Feed Page Responsive Telemetry Cards & Dual Dropdown Filters', () => {
  it('1. Telemetry cards enforce min-w-0, flex-1, and truncate to prevent text overflow on mobile', () => {
    const feedPath = path.join(WEB_TEST_CONFIG.webRoot, 'app/feed/page.tsx');
    assert.ok(fs.existsSync(feedPath), 'feed/page.tsx must exist');

    const src = fs.readFileSync(feedPath, 'utf8');
    // Asserts flex-1 and min-w-0 wrappers around telemetry card titles
    assert.ok(src.includes('min-w-0 flex-1'));
    assert.ok(src.includes('truncate'));
    assert.ok(src.includes('grid-cols-2 sm:grid-cols-4'));
    assert.ok(src.includes('Active Hazards'));
    assert.ok(src.includes('Critical Red Zones'));
    assert.ok(src.includes('Night Incidents'));
    assert.ok(src.includes('Confirmations'));
  });

  it('2. Category filter dropdown and right-pushed filter system eliminates horizontal push rail', () => {
    const feedPath = path.join(WEB_TEST_CONFIG.webRoot, 'app/feed/page.tsx');
    const src = fs.readFileSync(feedPath, 'utf8');

    // Asserts Category dropdown selector and Filter System state
    assert.ok(src.includes('handleSelectCategory'));
    assert.ok(src.includes('Filter by incident category'));
    assert.ok(src.includes('data-category-id'));
    assert.ok(src.includes('isFilterMenuOpen'));
    assert.ok(src.includes('activeFiltersCount'));
    assert.ok(src.includes('Active:'));
    // Asserts removal of the horizontal category scroll rail
    assert.ok(!src.includes('categoryScrollRef'), 'Horizontal scroll rail ref must be removed');
  });

  it('3. User / Reporter Source dropdown enables filtering by Citizen, Press, Responder, and My Reports', () => {
    const feedPath = path.join(WEB_TEST_CONFIG.webRoot, 'app/feed/page.tsx');
    const src = fs.readFileSync(feedPath, 'utf8');

    // Asserts UserTypeFilter type and state
    assert.ok(src.includes('UserTypeFilter'));
    assert.ok(src.includes('userTypeFilter'));
    assert.ok(src.includes('Filter by user or source'));
    assert.ok(src.includes('All Users & Sources') || src.includes('All Users'));
    assert.ok(src.includes('Citizen Reports'));
    assert.ok(src.includes('Press & News'));
    assert.ok(src.includes('Verified Responders'));
    assert.ok(src.includes('My Reports'));
  });
});
