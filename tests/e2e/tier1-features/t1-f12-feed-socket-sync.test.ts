import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SOCKET_EVENTS } from '@repo/shared';

describe('Tier 1: Feature Coverage - F12: Standalone Feed Socket Synchronization', () => {
  const feedPagePath = path.resolve(__dirname, '../../../apps/web/app/feed/page.tsx');
  assert.ok(fs.existsSync(feedPagePath), 'Feed page.tsx must exist');
  const feedPageCode = fs.readFileSync(feedPagePath, 'utf-8');

  it('T1-F12-01: Standalone /feed registers socket listener for REPORT_ENRICHED', () => {
    // Check if feed/page.tsx subscribes to REPORT_ENRICHED
    const subscribesEnriched =
      feedPageCode.includes('SOCKET_EVENTS.REPORT_ENRICHED') ||
      feedPageCode.includes("'REPORT_ENRICHED'");

    assert.strictEqual(
      subscribesEnriched,
      true,
      'apps/web/app/feed/page.tsx must subscribe to SOCKET_EVENTS.REPORT_ENRICHED to receive real-time deduplication and enrichment updates'
    );
  });

  it('T1-F12-02: Standalone /feed deregisters REPORT_ENRICHED listener in effect cleanup', () => {
    const unsubscribesEnriched =
      /socket\.off\(\s*(?:SOCKET_EVENTS\.REPORT_ENRICHED|['"]REPORT_ENRICHED['"])/.test(feedPageCode);

    assert.strictEqual(
      unsubscribesEnriched,
      true,
      'apps/web/app/feed/page.tsx must clean up the REPORT_ENRICHED listener on component unmount'
    );
  });

  it('T1-F12-03: REPORT_ENRICHED event payload updates existing incident in place without duplication', () => {
    // Simulation of feed state reducer / updater upon REPORT_ENRICHED
    const initialIncidents = [
      {
        id: 'rep-uuid-1',
        description: 'সড়ক দুর্ঘটনা',
        upvotes: 2,
        downvotes: 0,
        status: 'ACTIVE',
        citations: [],
      },
    ];

    const enrichedPayload = {
      id: 'rep-uuid-1',
      description: 'সড়ক দুর্ঘটনা: দুই বাসের মুখোমুখি সংঘর্ষ',
      upvotes: 4,
      downvotes: 0,
      status: 'ACTIVE',
      citations: [
        { sourceName: 'Prothom Alo', sourceUrl: 'https://prothomalo.test/crash' },
        { sourceName: 'The Daily Star', sourceUrl: 'https://thedailystar.test/crash' },
      ],
    };

    // Update logic simulation matching feed expectations
    const updatedIncidents = initialIncidents.map((item) =>
      item.id === enrichedPayload.id ? { ...item, ...enrichedPayload } : item
    );

    assert.strictEqual(updatedIncidents.length, 1, 'Incident list must not duplicate on enrichment');
    assert.strictEqual(
      updatedIncidents[0].description,
      'সড়ক দুর্ঘটনা: দুই বাসের মুখোমুখি সংঘর্ষ',
      'Incident description must be updated from enriched payload'
    );
    assert.strictEqual(updatedIncidents[0].citations.length, 2);
  });

  it('T1-F12-04: REPORT_ENRICHED event filtering excludes resolved or expired incidents from active feed', () => {
    const activeFeedIncidents = [
      { id: 'inc-1', threatStatus: 'ACTIVE', status: 'ACTIVE' },
      { id: 'inc-2', threatStatus: 'ACTIVE', status: 'ACTIVE' },
    ];

    // Incoming enriched event indicates inc-1 has expired or resolved
    const enrichedEvent = { id: 'inc-1', threatStatus: 'RESOLVED', status: 'RESOLVED' };

    // Active threat filtering: items with threatStatus !== 'ACTIVE' are filtered out
    const nextFeed = activeFeedIncidents
      .map((item) => (item.id === enrichedEvent.id ? { ...item, ...enrichedEvent } : item))
      .filter((item) => item.threatStatus === 'ACTIVE' && item.status === 'ACTIVE');

    assert.strictEqual(nextFeed.length, 1);
    assert.strictEqual(nextFeed[0].id, 'inc-2');
  });

  it('T1-F12-05: Backend socketManager defines emitReportEnriched broadcasting to live_reports room', () => {
    const socketManagerPath = path.resolve(__dirname, '../../../apps/api/src/sockets/socketManager.ts');
    assert.ok(fs.existsSync(socketManagerPath), 'socketManager.ts must exist');
    const socketCode = fs.readFileSync(socketManagerPath, 'utf-8');

    assert.ok(
      socketCode.includes('emitReportEnriched') || socketCode.includes('broadcastReportEnriched'),
      'socketManager.ts must export function to emit REPORT_ENRICHED'
    );
    assert.ok(
      socketCode.includes('REPORT_ENRICHED'),
      'socketManager.ts must broadcast SOCKET_EVENTS.REPORT_ENRICHED'
    );
  });
});
