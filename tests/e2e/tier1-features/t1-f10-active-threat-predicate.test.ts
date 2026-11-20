import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as Shared from '@repo/shared';

describe('Tier 1: Feature Coverage - F10: Authoritative Active Threat Eligibility Predicate', () => {
  it('T1-F10-01: @repo/shared exports authoritative predicate isActiveThreatIncident', () => {
    assert.strictEqual(
      typeof (Shared as any).isActiveThreatIncident,
      'function',
      'isActiveThreatIncident must be an exported function in @repo/shared'
    );
  });

  it('T1-F10-02: Qualifying active incident passes predicate with true', () => {
    const fn = (Shared as any).isActiveThreatIncident;
    if (typeof fn !== 'function') {
      assert.fail('isActiveThreatIncident is not exported by @repo/shared');
    }

    const now = new Date('2026-11-20T12:00:00Z');
    const futureExpiry = new Date('2026-11-20T18:00:00Z');

    const validPrecisions = ['EXACT', 'UPAZILA', 'DISTRICT'] as const;

    for (const prec of validPrecisions) {
      const incident = {
        status: 'ACTIVE',
        threatStatus: 'ACTIVE',
        locationPrecision: prec,
        expiresAt: futureExpiry,
      };

      const result = fn(incident, now);
      assert.strictEqual(
        result,
        true,
        `Expected isActiveThreatIncident to return true for active incident with precision '${prec}'`
      );
    }
  });

  it('T1-F10-03: Inactive report statuses (RESOLVED, PENDING, REJECTED, PURGED) return false', () => {
    const fn = (Shared as any).isActiveThreatIncident;
    if (typeof fn !== 'function') {
      assert.fail('isActiveThreatIncident is not exported by @repo/shared');
    }

    const now = new Date('2026-11-20T12:00:00Z');
    const futureExpiry = new Date('2026-11-20T18:00:00Z');

    const inactiveStatuses = ['RESOLVED', 'PENDING', 'REJECTED', 'PURGED'] as const;

    for (const st of inactiveStatuses) {
      const incident = {
        status: st,
        threatStatus: 'ACTIVE',
        locationPrecision: 'UPAZILA',
        expiresAt: futureExpiry,
      };

      const result = fn(incident, now);
      assert.strictEqual(
        result,
        false,
        `Expected isActiveThreatIncident to return false for report status: '${st}'`
      );
    }
  });

  it('T1-F10-04: Non-active threatStatus (UNDER_REVIEW, RESOLVED, EXPIRED, null, undefined) returns false', () => {
    const fn = (Shared as any).isActiveThreatIncident;
    if (typeof fn !== 'function') {
      assert.fail('isActiveThreatIncident is not exported by @repo/shared');
    }

    const now = new Date('2026-11-20T12:00:00Z');
    const futureExpiry = new Date('2026-11-20T18:00:00Z');

    const nonActiveThreatStatuses = ['UNDER_REVIEW', 'RESOLVED', 'EXPIRED', null, undefined];

    for (const ts of nonActiveThreatStatuses) {
      const incident = {
        status: 'ACTIVE',
        threatStatus: ts,
        locationPrecision: 'UPAZILA',
        expiresAt: futureExpiry,
      };

      const result = fn(incident, now);
      assert.strictEqual(
        result,
        false,
        `Expected isActiveThreatIncident to return false for threatStatus: '${ts}'`
      );
    }
  });

  it('T1-F10-05: Ambiguous precision or expired lifespan (expiresAt <= now) returns false', () => {
    const fn = (Shared as any).isActiveThreatIncident;
    if (typeof fn !== 'function') {
      assert.fail('isActiveThreatIncident is not exported by @repo/shared');
    }

    const now = new Date('2026-11-20T12:00:00Z');

    // Case 1: Ambiguous location precision
    const ambiguousIncident = {
      status: 'ACTIVE',
      threatStatus: 'ACTIVE',
      locationPrecision: 'AMBIGUOUS',
      expiresAt: new Date('2026-11-20T18:00:00Z'),
    };
    assert.strictEqual(
      fn(ambiguousIncident, now),
      false,
      'Ambiguous location precision must be ineligible for active map'
    );

    // Case 2: Past expiry date (Date object)
    const expiredIncident = {
      status: 'ACTIVE',
      threatStatus: 'ACTIVE',
      locationPrecision: 'UPAZILA',
      expiresAt: new Date('2026-11-20T11:59:59Z'),
    };
    assert.strictEqual(
      fn(expiredIncident, now),
      false,
      'Past expiry date must return false'
    );

    // Case 3: Past expiry date (ISO string format)
    const expiredStringIncident = {
      status: 'ACTIVE',
      threatStatus: 'ACTIVE',
      locationPrecision: 'UPAZILA',
      expiresAt: '2026-11-20T11:59:59.000Z',
    };
    assert.strictEqual(
      fn(expiredStringIncident, now),
      false,
      'Past expiry ISO string must return false'
    );
  });
});
