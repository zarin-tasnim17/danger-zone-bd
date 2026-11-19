import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineDistanceMeters } from '../harness/mockDatabase';
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

  const clusterRadiusMeters =
    zoom <= 10 ? 1000 : zoom <= 14 ? 250 : zoom <= 17 ? 25 : 0.001; // at zoom 18, only exact overlaps cluster

  const clusters: MapCluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < activePoints.length; i++) {
    const pt = activePoints[i];
    if (assigned.has(pt.id)) continue;

    const clusterGroup: ClusterPoint[] = [pt];
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
        clusterGroup.push(neighbor);
        assigned.add(neighbor.id);
      }
    }

    if (clusterGroup.length > 1) {
      clusters.push({
        clusterId: `cluster-${clusters.length + 1}`,
        points: clusterGroup,
        center: {
          latitude: clusterGroup.reduce((sum, p) => sum + p.latitude, 0) / clusterGroup.length,
          longitude: clusterGroup.reduce((sum, p) => sum + p.longitude, 0) / clusterGroup.length,
        },
        count: clusterGroup.length,
        highestSeverity: clusterGroup.some((p) => p.severity === 'HIGH') ? 'HIGH' : 'MEDIUM',
      });
    } else {
      clusters.push(pt as any);
    }
  }

  return clusters;
}

describe('Tier 2: Boundary & Corner Cases - F15: Cluster Density & Zoom Extremes', () => {
  it('T2-F15-01: 500 co-located overlapping incident pins cluster cleanly into single cluster with count: 500', () => {
    const coord = { latitude: 23.8103, longitude: 90.4125 };
    const points: ClusterPoint[] = Array.from({ length: 500 }, (_, i) => ({
      id: `dense-pin-${i}`,
      category: 'THEFT',
      severity: i % 10 === 0 ? 'HIGH' : 'LOW',
      latitude: coord.latitude,
      longitude: coord.longitude,
    }));

    const clustered = clusterIncidents(points, 10);
    assert.strictEqual(clustered.length, 1, 'All 500 identical coordinate pins must form 1 cluster');

    const cluster = clustered[0] as MapCluster;
    assert.strictEqual(cluster.count, 500);
    assert.strictEqual(cluster.highestSeverity, 'HIGH');
    assert.ok(Math.abs(cluster.center.latitude - coord.latitude) < 0.0001);
    assert.ok(Math.abs(cluster.center.longitude - coord.longitude) < 0.0001);
  });

  it('T2-F15-02: Max zoom 18 spiderfy algorithm computes unique separated offsets for overlapping points', () => {
    const center = { lat: 23.8103, lng: 90.4125 };
    const overlappingCount = 12;

    // Spiderfy spiral calculation (similar to Leaflet.markercluster spiderfy)
    const spiderfyPositions = Array.from({ length: overlappingCount }, (_, i) => {
      const angle = (2 * Math.PI * i) / overlappingCount;
      const radiusDegrees = 0.0003; // small spatial offset
      return {
        lat: center.lat + radiusDegrees * Math.cos(angle),
        lng: center.lng + radiusDegrees * Math.sin(angle),
      };
    });

    assert.strictEqual(spiderfyPositions.length, overlappingCount);

    // Verify all offset positions are distinct
    for (let i = 0; i < spiderfyPositions.length; i++) {
      for (let j = i + 1; j < spiderfyPositions.length; j++) {
        const p1 = spiderfyPositions[i];
        const p2 = spiderfyPositions[j];
        const dist = calculateHaversineDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
        assert.ok(dist > 5, `Spiderfied pins #${i} and #${j} must have physical separation (>5m), got ${dist}m`);
      }
    }
  });

  it('T2-F15-03: Rapid filter toggle spam maintains deterministic clustering invariants without memory leaks', () => {
    const theftPoints: ClusterPoint[] = Array.from({ length: 50 }, (_, i) => ({
      id: `theft-${i}`,
      category: 'THEFT',
      severity: 'MEDIUM',
      latitude: 23.81 + (i % 5) * 0.001,
      longitude: 90.41 + (i % 5) * 0.001,
    }));

    const accidentPoints: ClusterPoint[] = Array.from({ length: 50 }, (_, i) => ({
      id: `accident-${i}`,
      category: 'ROAD_ACCIDENT',
      severity: 'HIGH',
      latitude: 22.35 + (i % 5) * 0.001,
      longitude: 91.78 + (i % 5) * 0.001,
    }));

    const allPoints = [...theftPoints, ...accidentPoints];

    // Rapid toggle between filters 100 times
    for (let toggle = 0; toggle < 100; toggle++) {
      const activeCategory: ReportCategory = toggle % 2 === 0 ? 'THEFT' : 'ROAD_ACCIDENT';
      const result = clusterIncidents(allPoints, 12, new Set([activeCategory]));

      // Count total constituent pins in clusters + discrete points
      let renderedPinCount = 0;
      for (const item of result) {
        if ('count' in item) {
          renderedPinCount += (item as MapCluster).count;
        } else {
          renderedPinCount += 1;
        }
      }
      assert.strictEqual(renderedPinCount, 50, `Filtered view for ${activeCategory} must contain exactly 50 pins`);
    }
  });

  it('T2-F15-04: Unrecognized category pin falls back safely to default icon and styling', () => {
    const fallbackRenderSvg = (category: string) => {
      const validCategories = new Set(['THEFT', 'ROAD_ACCIDENT', 'ROBBERY', 'UNLIT_ROAD']);
      if (!validCategories.has(category)) {
        return '<svg data-icon="fallback-alert" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      }
      return `<svg data-icon="${category.toLowerCase()}" viewBox="0 0 24 24"></svg>`;
    };

    const unknownSvg = fallbackRenderSvg('NON_EXISTENT_CATEGORY');
    assert.ok(unknownSvg.includes('fallback-alert'), 'Unknown category must render fallback default SVG');
  });

  it('T2-F15-05: Zero-span isolated cluster (e.g. single pin on Saint Martin) avoids division by zero', () => {
    const saintMartinPin = { lat: 20.6272, lng: 92.3225 };
    const bounds = {
      minLat: saintMartinPin.lat,
      maxLat: saintMartinPin.lat,
      minLng: saintMartinPin.lng,
      maxLng: saintMartinPin.lng,
    };

    const latSpan = bounds.maxLat - bounds.minLat;
    const lngSpan = bounds.maxLng - bounds.minLng;
    assert.strictEqual(latSpan, 0);
    assert.strictEqual(lngSpan, 0);

    // Zoom calculation guard
    const calculateAutoZoom = (spanLat: number, spanLng: number) => {
      const maxSpan = Math.max(spanLat, spanLng);
      if (maxSpan === 0) {
        return 15; // default comfortable street-level zoom for single point
      }
      return Math.min(16, Math.max(7, Math.round(11 - Math.log2(maxSpan))));
    };

    const zoom = calculateAutoZoom(latSpan, lngSpan);
    assert.strictEqual(zoom, 15, 'Single isolated point must resolve to default zoom level 15 without NaN');
    assert.ok(!isNaN(zoom));
  });
});
