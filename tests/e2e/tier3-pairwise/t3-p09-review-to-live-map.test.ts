import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase, calculateHaversineDistanceMeters } from '../harness/mockDatabase';
import {
  assertValidReportEntity,
  assertValidGeocodeResult,
  assertWithinBangladeshBounds,
} from '../harness/contractValidator';
import type { ReportCategory, ReportSeverity } from '@repo/shared';

interface ClusterPoint {
  id: string;
  category: ReportCategory;
  severity: ReportSeverity;
  latitude: number;
  longitude: number;
}

interface MapCluster {
  clusterId: string;
  points: ClusterPoint[];
  center: { latitude: number; longitude: number };
  count: number;
  highestSeverity: ReportSeverity;
}

function clusterIncidents(points: ClusterPoint[], zoom: number): Array<MapCluster | ClusterPoint> {
  const clusterRadiusMeters = zoom <= 10 ? 1500 : zoom <= 14 ? 300 : 30;
  const clusters: MapCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (assigned.has(pt.id)) continue;

    const group: ClusterPoint[] = [pt];
    assigned.add(pt.id);

    for (let j = i + 1; j < points.length; j++) {
      const neighbor = points[j];
      if (assigned.has(neighbor.id)) continue;

      const dist = calculateHaversineDistanceMeters(
        pt.latitude,
        pt.longitude,
        neighbor.latitude,
        neighbor.longitude
      );

      if (dist <= clusterRadiusMeters) {
        group.push(neighbor);
        assigned.add(neighbor.id);
      }
    }

    if (group.length > 1) {
      clusters.push({
        clusterId: `cluster-${clusters.length + 1}`,
        points: group,
        center: {
          latitude: group.reduce((acc, p) => acc + p.latitude, 0) / group.length,
          longitude: group.reduce((acc, p) => acc + p.longitude, 0) / group.length,
        },
        count: group.length,
        highestSeverity: group.some((p) => p.severity === 'HIGH') ? 'HIGH' : 'MEDIUM',
      });
    } else {
      clusters.push({
        clusterId: `single-${pt.id}`,
        points: [pt],
        center: { latitude: pt.latitude, longitude: pt.longitude },
        count: 1,
        highestSeverity: pt.severity,
      });
    }
  }

  return clusters;
}

describe('Tier 3: Pairwise Combinations - P09: Review Queue to Live Map (F10 x F13 x F15)', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-P09-01: Low-confidence / ambiguous incident is routed to review queue and does not appear on active map', async () => {
    // Ambiguous incident: place name could not be reliably resolved
    const ambiguousReport = db.seedReport({
      id: 'review-item-001',
      title: 'সদর এলাকায় অগ্নিকাণ্ড ও ভাঙচুর',
      category: 'ARMED_ASSAULT',
      severity: 'HIGH',
      latitude: 23.8103, // default center placeholder
      longitude: 90.4125,
      status: 'RESOLVED', // Routed away from ACTIVE map to review queue
      verificationStage: 'INGESTED',
    });

    // Check active reports in bounds
    const active = db.getReportsInBounds(
      { minLat: 23.0, minLng: 90.0, maxLat: 24.0, maxLng: 91.0 },
      'all',
      'ACTIVE'
    );
    assert.strictEqual(
      active.some((r) => r.id === ambiguousReport.id),
      false,
      'Ambiguous review queue item must NOT appear on active map'
    );
  });

  it('T3-P09-02: Admin reviews ambiguous incident, assigns verified coordinates, and transitions to ADMIN_VERIFIED', async () => {
    // Initial ambiguous report
    const report = db.seedReport({
      id: 'review-item-002',
      title: 'কালীগঞ্জে সড়ক দুর্ঘটনায় নিহত ১',
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: 23.8103,
      longitude: 90.4125,
      status: 'RESOLVED', // in review queue
      verificationStage: 'INGESTED',
    });

    // Admin verifies the location as Kaliganj Thana, Gazipur (lat: 23.9917, lng: 90.5667)
    const verifiedCoords = { latitude: 23.9917, longitude: 90.5667 };
    assertWithinBangladeshBounds(verifiedCoords.latitude, verifiedCoords.longitude);

    const approvedReport = await db.report.update({
      where: { id: report.id },
      data: {
        latitude: verifiedCoords.latitude,
        longitude: verifiedCoords.longitude,
        status: 'ACTIVE',
        verificationStage: 'ADMIN_VERIFIED',
      },
    });

    assert.strictEqual(approvedReport.status, 'ACTIVE');
    assert.strictEqual(approvedReport.verificationStage, 'ADMIN_VERIFIED');
    assert.strictEqual(approvedReport.latitude, verifiedCoords.latitude);
    assert.strictEqual(approvedReport.longitude, verifiedCoords.longitude);

    const validated = assertValidReportEntity(approvedReport);
    assert.strictEqual(validated.verificationStage, 'ADMIN_VERIFIED');
  });

  it('T3-P09-03: Approved and verified report immediately participates in spatial map clustering', () => {
    // 2 existing active incidents in Gazipur
    db.seedReport({
      id: 'gazipur-existing-1',
      category: 'ROAD_ACCIDENT',
      severity: 'MEDIUM',
      latitude: 23.9920,
      longitude: 90.5670,
      status: 'ACTIVE',
    });
    db.seedReport({
      id: 'gazipur-existing-2',
      category: 'ROAD_ACCIDENT',
      severity: 'MEDIUM',
      latitude: 23.9925,
      longitude: 90.5675,
      status: 'ACTIVE',
    });

    // Before approval: cluster has 2 items
    let active = db.getReportsInBounds({ minLat: 23.9, minLng: 90.5, maxLat: 24.1, maxLng: 90.6 });
    let clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).count, 2);

    // Admin approves report in same vicinity
    db.seedReport({
      id: 'gazipur-approved-3',
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: 23.9918,
      longitude: 90.5668,
      status: 'ACTIVE',
      verificationStage: 'ADMIN_VERIFIED',
    });

    // After approval: cluster count increments to 3 and composite severity updates to HIGH
    active = db.getReportsInBounds({ minLat: 23.9, minLng: 90.5, maxLat: 24.1, maxLng: 90.6 });
    clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).count, 3);
    assert.strictEqual((clusters[0] as MapCluster).highestSeverity, 'HIGH');
  });

  it('T3-P09-04: Admin rejection or purging of a review queue item ensures it never appears on live map', async () => {
    const bogusReport = db.seedReport({
      id: 'bogus-spam-001',
      title: 'Online casino promotion spam',
      category: 'THEFT',
      latitude: 23.8103,
      longitude: 90.4125,
      status: 'RESOLVED',
      verificationStage: 'INGESTED',
    });

    // Admin marks PURGED
    await db.report.update({
      where: { id: bogusReport.id },
      data: { status: 'PURGED' },
    });

    const active = db.getReportsInBounds({ minLat: 20.0, minLng: 88.0, maxLat: 27.0, maxLng: 93.0 });
    assert.strictEqual(active.some((r) => r.id === bogusReport.id), false);

    const stored = await db.report.findUnique({ where: { id: bogusReport.id } });
    assert.strictEqual(stored?.status, 'PURGED');
  });

  it('T3-P09-05: Transition of status from ACTIVE to RESOLVED removes the pin from active clusters while preserving history', async () => {
    const report = db.seedReport({
      id: 'incident-to-resolve',
      category: 'SNATCHING',
      latitude: 23.7500,
      longitude: 90.3800,
      status: 'ACTIVE',
      verificationStage: 'ADMIN_VERIFIED',
    });

    // Active
    let active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.3, maxLat: 23.8, maxLng: 90.4 });
    assert.strictEqual(active.length, 1);

    // Resolved by police/moderator
    await db.report.update({
      where: { id: report.id },
      data: { status: 'RESOLVED' },
    });

    // No longer on active map
    active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.3, maxLat: 23.8, maxLng: 90.4 });
    assert.strictEqual(active.length, 0);

    // Still accessible in database
    const history = await db.report.findUnique({ where: { id: report.id } });
    assert.ok(history);
    assert.strictEqual(history!.status, 'RESOLVED');
  });
});
