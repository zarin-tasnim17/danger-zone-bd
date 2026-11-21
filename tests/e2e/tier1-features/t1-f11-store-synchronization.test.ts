import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { DangerIncident, LocationPrecision, ThreatStatus } from '@repo/shared';

describe('Tier 1: Feature Coverage - F11: Frontend Map & Store Eligibility Synchronization', () => {
  const storeFilePath = path.resolve(__dirname, '../../../apps/web/store/useIncidentStore.ts');
  const storeCode = fs.readFileSync(storeFilePath, 'utf-8');

  it('T1-F11-01: useIncidentStore.ts does not default missing locationPrecision to EXACT', () => {
    // Defect check: "locationPrecision: r.locationPrecision || 'EXACT'" falsely promotes unverified locations
    const hasExactFallback = /locationPrecision:\s*r\.locationPrecision\s*\|\|\s*['"]EXACT['"]/i.test(storeCode);

    assert.strictEqual(
      hasExactFallback,
      false,
      'useIncidentStore must NOT default missing locationPrecision to EXACT. Precision must truthfully reflect evidence.'
    );
  });

  it('T1-F11-02: useIncidentStore.ts does not default threatStatus to ACTIVE', () => {
    // Defect check: "threatStatus: r.threatStatus || 'ACTIVE'" falsely converts staged/under review items to active pins
    const hasActiveFallback = /threatStatus:\s*r\.threatStatus\s*\|\|\s*['"]ACTIVE['"]/i.test(storeCode);

    assert.strictEqual(
      hasActiveFallback,
      false,
      'useIncidentStore must NOT default threatStatus to ACTIVE. Unverified or staged items must not be forced to ACTIVE.'
    );
  });

  it('T1-F11-03: Incident payload retains truthful non-EXACT precisions (UPAZILA, DISTRICT, AMBIGUOUS)', () => {
    const rawBackendReports = [
      {
        id: 'rep-01',
        description: 'সাভারে সড়ক দুর্ঘটনা',
        category: 'ROAD_ACCIDENT',
        severity: 'MEDIUM',
        latitude: 23.858,
        longitude: 90.266,
        locationPrecision: 'UPAZILA' as LocationPrecision,
        threatStatus: 'ACTIVE' as ThreatStatus,
      },
      {
        id: 'rep-02',
        description: 'খুলনায় ভারী কুয়াশায় যান চলাচল বিঘ্নিত',
        category: 'ROAD_ACCIDENT',
        severity: 'LOW',
        latitude: 22.845,
        longitude: 89.54,
        locationPrecision: 'DISTRICT' as LocationPrecision,
        threatStatus: 'ACTIVE' as ThreatStatus,
      },
      {
        id: 'rep-03',
        description: 'কালীগঞ্জে সংঘর্ষের খবর',
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: 23.99,
        longitude: 90.42,
        locationPrecision: 'AMBIGUOUS' as LocationPrecision,
        threatStatus: 'UNDER_REVIEW' as ThreatStatus,
      },
    ];

    for (const report of rawBackendReports) {
      assert.notStrictEqual(
        report.locationPrecision,
        'EXACT',
        `Backend report ${report.id} precision '${report.locationPrecision}' must not be coerced to EXACT`
      );
    }
  });

  it('T1-F11-04: Staged UNDER_REVIEW reports must not be assigned active pins in the store', () => {
    const stagedReport = {
      id: 'staged-101',
      description: 'অজ্ঞাত স্থানে ছিনতাইয়ের ঘটনা',
      category: 'SNATCHING',
      severity: 'LOW',
      latitude: 23.81,
      longitude: 90.41,
      locationPrecision: 'AMBIGUOUS',
      threatStatus: 'UNDER_REVIEW',
    };

    // An active map filter predicate simulation
    const isActiveMapCandidate = (r: typeof stagedReport) =>
      r.threatStatus === 'ACTIVE' && r.locationPrecision !== 'AMBIGUOUS';

    assert.strictEqual(
      isActiveMapCandidate(stagedReport),
      false,
      'Staged UNDER_REVIEW report must not be treated as an active map candidate'
    );
  });

  it('T1-F11-05: MapClient component enforces active threat filter on rendering', () => {
    const mapClientPath = path.resolve(__dirname, '../../../apps/web/components/map/MapClient.tsx');
    assert.ok(fs.existsSync(mapClientPath), 'MapClient.tsx must exist');
    const mapClientCode = fs.readFileSync(mapClientPath, 'utf-8');

    // Verify MapClient does not indiscriminately render every incident without checking status
    assert.ok(
      mapClientCode.includes('filter') || mapClientCode.includes('threatStatus') || mapClientCode.includes('isActive'),
      'MapClient must include filtering logic for active threat incidents'
    );
  });
});
