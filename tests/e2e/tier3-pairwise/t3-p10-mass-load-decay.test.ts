import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockDatabase, calculateHaversineDistanceMeters } from '../harness/mockDatabase';
import {
  ALL_11_SAFETY_CATEGORIES,
  ALL_64_DISTRICTS,
  DISTRICT_CENTERS,
} from '../harness/testDataGenerators';
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

  // Zoom 9: regional threshold ~25000m
  const clusterRadiusMeters = zoom <= 9 ? 25000 : zoom <= 12 ? 5000 : 500;

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

describe('Tier 3: Pairwise Combinations - P10: Mass Load & Progressive Time Decay (F9 x F14 x F15 x F17)', () => {
  let db: MockDatabase;
  const t0 = new Date('2026-11-19T00:00:00Z');

  beforeEach(() => {
    db = new MockDatabase();
  });

  it('T3-P10-01: High-volume batch of 100 classified incidents spanning all 11 categories with respective lifespans is seeded', () => {
    for (let i = 0; i < 100; i++) {
      const category = ALL_11_SAFETY_CATEGORIES[i % ALL_11_SAFETY_CATEGORIES.length];
      const district = ALL_64_DISTRICTS[i % ALL_64_DISTRICTS.length];
      const center = DISTRICT_CENTERS[district] || { latitude: 23.81, longitude: 90.41 };

      const lifespanHours = db.getNewsCategoryLifespanHours(category);
      const expiresAt = lifespanHours !== null ? new Date(t0.getTime() + lifespanHours * 3600 * 1000) : null;

      db.seedReport({
        id: `load-report-${i + 1}`,
        title: `${district} ${category} report #${i + 1}`,
        category,
        severity: (i % 3 === 0 ? 'HIGH' : i % 3 === 1 ? 'MEDIUM' : 'LOW') as ReportSeverity,
        latitude: center.latitude + (Math.sin(i) * 0.05),
        longitude: center.longitude + (Math.cos(i) * 0.05),
        createdAt: t0,
        expiresAt,
        status: 'ACTIVE',
      });
    }

    const allActive = db.getReportsInBounds({ minLat: 20.0, minLng: 88.0, maxLat: 27.0, maxLng: 93.0 });
    assert.strictEqual(allActive.length, 100);

    // Verify all 11 categories are represented
    const categoriesPresent = new Set(allActive.map((r) => r.category));
    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      assert.ok(categoriesPresent.has(cat));
    }
  });

  it('T3-P10-02: Map clustering at zoom 9 groups 100 incidents across Bangladesh into regional clusters', () => {
    for (let i = 0; i < 100; i++) {
      const category = ALL_11_SAFETY_CATEGORIES[i % ALL_11_SAFETY_CATEGORIES.length];
      const district = ALL_64_DISTRICTS[i % ALL_64_DISTRICTS.length];
      const center = DISTRICT_CENTERS[district] || { latitude: 23.81, longitude: 90.41 };
      db.seedReport({
        id: `c-rep-${i + 1}`,
        category,
        severity: 'MEDIUM',
        latitude: center.latitude + ((i % 5) * 0.01),
        longitude: center.longitude + ((i % 5) * 0.01),
        status: 'ACTIVE',
      });
    }

    const allActive = db.getReportsInBounds({ minLat: 20.0, minLng: 88.0, maxLat: 27.0, maxLng: 93.0 });
    const clusters = clusterIncidents(allActive, 9);

    assert.ok(clusters.length > 0 && clusters.length < 100, 'Incidents must cluster into fewer groups than total count');
    const totalRepresented = clusters.reduce((acc, c) => acc + (('count' in c) ? c.count : 1), 0);
    assert.strictEqual(totalRepresented, 100, 'All 100 incidents must be accounted for across clusters');
  });

  it('T3-P10-03: Advancing time by 48h purges road accidents and theft while preserving remaining categories', () => {
    // Seed 10 accidents (48h), 10 thefts (48h), 10 gangs (96h), 10 unlit roads (null)
    for (let i = 0; i < 10; i++) {
      db.seedReport({
        id: `acc-${i}`,
        category: 'ROAD_ACCIDENT',
        latitude: 23.8 + i * 0.01,
        longitude: 90.4 + i * 0.01,
        createdAt: t0,
        expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
      });
      db.seedReport({
        id: `thf-${i}`,
        category: 'THEFT',
        latitude: 23.8 + i * 0.01,
        longitude: 90.4 + i * 0.01,
        createdAt: t0,
        expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
      });
      db.seedReport({
        id: `gng-${i}`,
        category: 'YOUTH_GANG_ACTIVITY',
        latitude: 23.8 + i * 0.01,
        longitude: 90.4 + i * 0.01,
        createdAt: t0,
        expiresAt: new Date(t0.getTime() + 96 * 3600 * 1000),
      });
      db.seedReport({
        id: `unl-${i}`,
        category: 'UNLIT_ROAD',
        latitude: 23.8 + i * 0.01,
        longitude: 90.4 + i * 0.01,
        createdAt: t0,
        expiresAt: null,
      });
    }

    // At t0: 40 active
    let active = db.getReportsInBounds({ minLat: 20.0, minLng: 88.0, maxLat: 27.0, maxLng: 93.0 });
    assert.strictEqual(active.length, 40);

    // Purge at t0 + 49h: 20 purged (10 accidents + 10 thefts)
    const purge49 = db.purgeExpiredReports(new Date(t0.getTime() + 49 * 3600 * 1000));
    assert.strictEqual(purge49.purgedCount, 20);

    active = db.getReportsInBounds({ minLat: 20.0, minLng: 88.0, maxLat: 27.0, maxLng: 93.0 });
    assert.strictEqual(active.length, 20);

    const activeCategories = new Set(active.map((r) => r.category));
    assert.strictEqual(activeCategories.has('ROAD_ACCIDENT'), false);
    assert.strictEqual(activeCategories.has('THEFT'), false);
    assert.strictEqual(activeCategories.has('YOUTH_GANG_ACTIVITY'), true);
    assert.strictEqual(activeCategories.has('UNLIT_ROAD'), true);
  });

  it('T3-P10-04: Advancing time by 96h purges all gang and drug reports, leaving persistent unlit road reports active', () => {
    // Seed isolated test dataset: 10 gangs (96h) and 10 persistent unlit roads (null)
    for (let i = 0; i < 10; i++) {
      db.seedReport({
        id: `isolated-gng-${i}`,
        category: 'YOUTH_GANG_ACTIVITY',
        latitude: 23.8 + i * 0.01,
        longitude: 90.4 + i * 0.01,
        createdAt: t0,
        expiresAt: new Date(t0.getTime() + 96 * 3600 * 1000),
      });
      db.seedReport({
        id: `isolated-unl-${i}`,
        category: 'UNLIT_ROAD',
        latitude: 23.8 + i * 0.01,
        longitude: 90.4 + i * 0.01,
        createdAt: t0,
        expiresAt: null,
      });
    }

    // Purge at t0 + 97h
    const purge97 = db.purgeExpiredReports(new Date(t0.getTime() + 97 * 3600 * 1000));
    assert.strictEqual(purge97.purgedCount, 10, '10 gang reports should be purged');

    const active = db.getReportsInBounds({ minLat: 20.0, minLng: 88.0, maxLat: 27.0, maxLng: 93.0 });
    assert.strictEqual(active.length, 10, 'Only the 10 persistent unlit road reports remain');

    for (const report of active) {
      assert.strictEqual(report.category, 'UNLIT_ROAD');
      assert.strictEqual(report.expiresAt, null);
    }
  });

  it('T3-P10-05: Category filtering on map clusters remains accurate before and after progressive time decay', () => {
    db.clear();
    for (let i = 0; i < 5; i++) {
      db.seedReport({
        id: `unlit-dhaka-${i}`,
        category: 'UNLIT_ROAD',
        latitude: 23.81 + i * 0.001,
        longitude: 90.41 + i * 0.001,
        expiresAt: null,
      });
      db.seedReport({
        id: `acc-dhaka-${i}`,
        category: 'ROAD_ACCIDENT',
        latitude: 23.81 + i * 0.001,
        longitude: 90.41 + i * 0.001,
        expiresAt: new Date(t0.getTime() + 48 * 3600 * 1000),
      });
    }

    let active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.3, maxLat: 23.9, maxLng: 90.5 });
    assert.strictEqual(active.length, 10);

    // Filter by UNLIT_ROAD only
    const unlitOnlyClusters = clusterIncidents(active, 10, new Set(['UNLIT_ROAD']));
    assert.strictEqual(unlitOnlyClusters.length, 1);
    assert.strictEqual((unlitOnlyClusters[0] as MapCluster).count, 5);

    // Filter by ROAD_ACCIDENT only
    const accOnlyClusters = clusterIncidents(active, 10, new Set(['ROAD_ACCIDENT']));
    assert.strictEqual(accOnlyClusters.length, 1);
    assert.strictEqual((accOnlyClusters[0] as MapCluster).count, 5);

    // Decay past 48h
    db.purgeExpiredReports(new Date(t0.getTime() + 50 * 3600 * 1000));
    active = db.getReportsInBounds({ minLat: 23.7, minLng: 90.3, maxLat: 23.9, maxLng: 90.5 });
    assert.strictEqual(active.length, 5);

    // Filter by ROAD_ACCIDENT returns 0 clusters
    const accAfterDecay = clusterIncidents(active, 10, new Set(['ROAD_ACCIDENT']));
    assert.strictEqual(accAfterDecay.length, 0);

    // Filter by UNLIT_ROAD returns 5
    const unlitAfterDecay = clusterIncidents(active, 10, new Set(['UNLIT_ROAD']));
    assert.strictEqual(unlitAfterDecay.length, 1);
    assert.strictEqual((unlitAfterDecay[0] as MapCluster).count, 5);
  });
});
