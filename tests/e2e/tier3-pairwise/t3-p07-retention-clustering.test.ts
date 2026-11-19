import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase, calculateHaversineDistanceMeters } from '../harness/mockDatabase';
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

function clusterIncidents(
  points: ClusterPoint[],
  zoom: number,
  categoryFilters?: Set<ReportCategory>
): Array<MapCluster | ClusterPoint> {
  const activePoints = categoryFilters
    ? points.filter((p) => categoryFilters.has(p.category))
    : points;

  const clusterRadiusMeters = zoom <= 10 ? 1500 : zoom <= 14 ? 300 : 30;

  const clusters: MapCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < activePoints.length; i++) {
    const pt = activePoints[i];
    if (assigned.has(pt.id)) continue;

    const group: ClusterPoint[] = [pt];
    assigned.add(pt.id);

    for (let j = i + 1; j < activePoints.length; j++) {
      const neighbor = activePoints[j];
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
      let highestSeverity: ReportSeverity = 'LOW';
      if (group.some((p) => p.severity === 'HIGH')) {
        highestSeverity = 'HIGH';
      } else if (group.some((p) => p.severity === 'MEDIUM')) {
        highestSeverity = 'MEDIUM';
      }

      clusters.push({
        clusterId: `cluster-${clusters.length + 1}`,
        points: group,
        center: {
          latitude: group.reduce((acc, p) => acc + p.latitude, 0) / group.length,
          longitude: group.reduce((acc, p) => acc + p.longitude, 0) / group.length,
        },
        count: group.length,
        highestSeverity,
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

describe('Tier 3: Pairwise Combinations - P07: Retention Lifecycles & Map Clustering (F14 x F15)', () => {
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-P07-01: Dense cluster of active incidents groups together at low zoom (zoom 10)', () => {
    // 5 incidents in close proximity (~300m apart) around Mirpur 10 circle
    const baseLat = 23.8068;
    const baseLng = 90.3687;

    for (let i = 0; i < 5; i++) {
      db.seedReport({
        id: `mirpur-pin-${i + 1}`,
        category: 'SNATCHING',
        severity: i === 0 ? 'HIGH' : 'MEDIUM',
        latitude: baseLat + i * 0.001,
        longitude: baseLng + i * 0.001,
        status: 'ACTIVE',
      });
    }

    const activeReports = db.getReportsInBounds(
      { minLat: 23.7, minLng: 90.3, maxLat: 23.9, maxLng: 90.5 },
      'all',
      'ACTIVE'
    );

    const clusters = clusterIncidents(activeReports, 10);
    assert.strictEqual(clusters.length, 1, 'All 5 nearby pins should group into a single cluster at zoom 10');
    assert.strictEqual((clusters[0] as MapCluster).count, 5);
    assert.strictEqual((clusters[0] as MapCluster).highestSeverity, 'HIGH');
  });

  it('T3-P07-02: When some incidents in a cluster expire and are purged, cluster marker count decrements dynamically', () => {
    const t0 = new Date('2026-11-19T00:00:00Z');
    const baseLat = 23.7500;
    const baseLng = 90.3800;

    // Seed 2 accidents (48h expiry) and 2 gang incidents (96h expiry) in Farmgate
    const acc1 = db.seedReport({
      id: 'acc-1',
      category: 'ROAD_ACCIDENT',
      latitude: baseLat,
      longitude: baseLng,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
    });
    const acc2 = db.seedReport({
      id: 'acc-2',
      category: 'ROAD_ACCIDENT',
      latitude: baseLat + 0.001,
      longitude: baseLng + 0.001,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
    });
    const gang1 = db.seedReport({
      id: 'gang-1',
      category: 'YOUTH_GANG_ACTIVITY',
      latitude: baseLat + 0.002,
      longitude: baseLng + 0.002,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 96 * 3600 * 1000),
    });
    const gang2 = db.seedReport({
      id: 'gang-2',
      category: 'YOUTH_GANG_ACTIVITY',
      latitude: baseLat + 0.003,
      longitude: baseLng + 0.003,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 96 * 3600 * 1000),
    });

    // At t0 + 10 hours: all 4 are active
    let active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.3, maxLat: 23.8, maxLng: 90.5 });
    let clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).count, 4);

    // Advance to t0 + 50 hours: accidents expire
    const t50 = new Date(t0.getTime() + 50 * 3600 * 1000);
    db.purgeExpiredReports(t50);

    active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.3, maxLat: 23.8, maxLng: 90.5 });
    assert.strictEqual(active.length, 2, 'Only 2 gang reports should remain active');

    clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).count, 2, 'Cluster count must decrement from 4 to 2');
  });

  it('T3-P07-03: When expired incidents leave only 1 active incident, cluster dissolves into single marker', () => {
    const t0 = new Date('2026-11-19T00:00:00Z');
    const baseLat = 23.8500;
    const baseLng = 90.4000;

    // 1 accident (48h) and 1 unlit road (persistent, null)
    const acc = db.seedReport({
      id: 'acc-uttara',
      category: 'ROAD_ACCIDENT',
      latitude: baseLat,
      longitude: baseLng,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
    });
    const unlit = db.seedReport({
      id: 'unlit-uttara',
      category: 'UNLIT_ROAD',
      latitude: baseLat + 0.001,
      longitude: baseLng + 0.001,
      createdAt: t0,
      expiresAt: null,
    });

    // Before decay: clustered into pair of 2
    let active = db.getReportsInBounds({ minLat: 23.8, minLng: 90.3, maxLat: 23.9, maxLng: 90.5 });
    let clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).count, 2);

    // After 49 hours: accident is purged
    db.purgeExpiredReports(new Date(t0.getTime() + 49 * 3600 * 1000));
    active = db.getReportsInBounds({ minLat: 23.8, minLng: 90.3, maxLat: 23.9, maxLng: 90.5 });
    assert.strictEqual(active.length, 1);

    clusters = clusterIncidents(active, 10);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual((clusters[0] as MapCluster).count, 1, 'Dissolves to single marker representation');
    assert.strictEqual((clusters[0] as MapCluster).clusterId.startsWith('single-'), true);
  });

  it('T3-P07-04: Persistent hazard pins (UNLIT_ROAD) remain part of clusters indefinitely across multiple decay cycles', () => {
    const t0 = new Date('2026-11-19T00:00:00Z');

    // 2 persistent hazards in Keraniganj
    db.seedReport({
      id: 'keraniganj-unlit-1',
      category: 'UNLIT_ROAD',
      latitude: 23.6800,
      longitude: 90.3500,
      createdAt: t0,
      expiresAt: null,
    });
    db.seedReport({
      id: 'keraniganj-unlit-2',
      category: 'UNLIT_ROAD',
      latitude: 23.6820,
      longitude: 90.3520,
      createdAt: t0,
      expiresAt: null,
    });

    // Run purges at 24h, 48h, 96h, 192h, 384h
    const testHours = [24, 48, 96, 192, 384];
    for (const h of testHours) {
      const purgeResult = db.purgeExpiredReports(new Date(t0.getTime() + h * 3600 * 1000));
      assert.strictEqual(purgeResult.purgedCount, 0, `Persistent pins must never be purged at hour ${h}`);

      const active = db.getReportsInBounds({ minLat: 23.6, minLng: 90.3, maxLat: 23.7, maxLng: 90.4 });
      assert.strictEqual(active.length, 2);

      const clusters = clusterIncidents(active, 10);
      assert.strictEqual((clusters[0] as MapCluster).count, 2);
    }
  });

  it('T3-P07-05: Cluster composite severity updates dynamically if high-severity expired incident is purged', () => {
    const t0 = new Date('2026-11-19T00:00:00Z');
    const baseLat = 23.7300;
    const baseLng = 90.4100;

    // High severity accident (48h expiry)
    db.seedReport({
      id: 'fatal-accident',
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: baseLat,
      longitude: baseLng,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
    });

    // Medium severity theft (96h expiry or standard)
    db.seedReport({
      id: 'pocket-theft',
      category: 'THEFT',
      severity: 'MEDIUM',
      latitude: baseLat + 0.001,
      longitude: baseLng + 0.001,
      createdAt: t0,
      expiresAt: new Date(t0.getTime() + 72 * 3600 * 1000),
    });

    // Low severity unlit road (persistent)
    db.seedReport({
      id: 'unlit-lane',
      category: 'UNLIT_ROAD',
      severity: 'LOW',
      latitude: baseLat + 0.002,
      longitude: baseLng + 0.002,
      createdAt: t0,
      expiresAt: null,
    });

    // At t0: Cluster composite severity is HIGH
    let active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.4, maxLat: 23.8, maxLng: 90.5 });
    let clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).highestSeverity, 'HIGH');

    // At t0 + 50h: fatal accident expires and is purged
    db.purgeExpiredReports(new Date(t0.getTime() + 50 * 3600 * 1000));
    active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.4, maxLat: 23.8, maxLng: 90.5 });
    clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).highestSeverity, 'MEDIUM', 'Cluster severity should drop to MEDIUM');

    // At t0 + 75h: theft expires and is purged
    db.purgeExpiredReports(new Date(t0.getTime() + 75 * 3600 * 1000));
    active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.4, maxLat: 23.8, maxLng: 90.5 });
    clusters = clusterIncidents(active, 10);
    assert.strictEqual((clusters[0] as MapCluster).highestSeverity, 'LOW', 'Cluster severity should drop to LOW');
  });
});
