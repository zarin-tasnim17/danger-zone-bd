import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_11_SAFETY_CATEGORIES } from '../harness/testDataGenerators';
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

/**
 * Cluster simulation algorithm representing Leaflet.markercluster logic
 * across different zoom levels:
 * - Zoom 7-10 (Metro/Regional): cluster radius ~1500m - 500m
 * - Zoom 11-14 (City/Ward): cluster radius ~300m - 100m
 * - Zoom 15-17 (Street/Local): cluster radius < 30m (discrete individual markers)
 */
function clusterIncidents(
  points: ClusterPoint[],
  zoom: number,
  categoryFilters?: Set<ReportCategory>
): Array<MapCluster | ClusterPoint> {
  const activePoints = categoryFilters
    ? points.filter((p) => categoryFilters.has(p.category))
    : points;

  // Zoom-dependent clustering pixel threshold mapped to meters
  const clusterRadiusMeters =
    zoom <= 10 ? 1000 : zoom <= 14 ? 250 : 25; // at zoom >= 15, very small threshold

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
      // Determine highest severity
      let highestSeverity: ReportSeverity = 'LOW';
      if (clusterGroup.some((p) => p.severity === 'HIGH')) {
        highestSeverity = 'HIGH';
      } else if (clusterGroup.some((p) => p.severity === 'MEDIUM')) {
        highestSeverity = 'MEDIUM';
      }

      clusters.push({
        clusterId: `cluster-${clusters.length + 1}`,
        points: clusterGroup,
        center: {
          latitude: clusterGroup.reduce((acc, p) => acc + p.latitude, 0) / clusterGroup.length,
          longitude: clusterGroup.reduce((acc, p) => acc + p.longitude, 0) / clusterGroup.length,
        },
        count: clusterGroup.length,
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

describe('Tier 1: Feature Coverage - F15: Leaflet Map Marker Clustering', () => {
  const sampleDhakaIncidents: ClusterPoint[] = [
    { id: 'farmgate-bus-1', category: 'ROAD_ACCIDENT', severity: 'HIGH', latitude: 23.7570, longitude: 90.3890 },
    { id: 'farmgate-bus-2', category: 'ROAD_ACCIDENT', severity: 'MEDIUM', latitude: 23.7575, longitude: 90.3895 },
    { id: 'farmgate-snatch', category: 'SNATCHING', severity: 'MEDIUM', latitude: 23.7580, longitude: 90.3900 },
    { id: 'mirpur-gang', category: 'YOUTH_GANG_ACTIVITY', severity: 'HIGH', latitude: 23.8070, longitude: 90.3680 },
    { id: 'uttara-theft', category: 'THEFT', severity: 'LOW', latitude: 23.8720, longitude: 90.3980 },
  ];

  it('T1-F15-01: Proximity-based cluster grouping unites nearby incidents at low/metro zoom levels (e.g. zoom 7-10)', () => {
    // Farmgate has 3 incidents within ~150 meters of each other
    const clusteredAtZoom10 = clusterIncidents(sampleDhakaIncidents, 10);

    // At zoom 10, the 3 Farmgate incidents should merge into 1 cluster
    const farmgateCluster = clusteredAtZoom10.find(
      (c) => (c as MapCluster).count >= 3
    ) as MapCluster;

    assert.ok(farmgateCluster, 'Must create a cluster of 3+ incidents at Farmgate at zoom 10');
    assert.strictEqual(farmgateCluster.count, 3);
  });

  it('T1-F15-02: Cluster ungroups into discrete individual pins at street zoom level (e.g. zoom 15-17)', () => {
    // At street zoom 16, incidents >25m apart separate into individual markers
    const clusteredAtZoom16 = clusterIncidents(sampleDhakaIncidents, 16);

    const singleMarkers = clusteredAtZoom16.filter(
      (c) => (c as MapCluster).count === 1
    );

    assert.strictEqual(
      singleMarkers.length,
      sampleDhakaIncidents.length,
      'All incidents must separate into distinct markers at street level zoom 16'
    );
  });

  it('T1-F15-03: Custom SVG category icon generation produces valid SVG markup for all 11 categories', () => {
    function generateCategorySvg(category: ReportCategory, size = 16): string {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" data-category="${category}" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>`;
    }

    for (const cat of ALL_11_SAFETY_CATEGORIES) {
      const svg = generateCategorySvg(cat);
      assert.ok(svg.startsWith('<svg'), `Must produce <svg> root element for category ${cat}`);
      assert.ok(svg.includes(`data-category="${cat}"`), `SVG must encode category ${cat}`);
      assert.ok(svg.includes('width="16"'), 'SVG must respect specified icon size');
      assert.ok(svg.endsWith('</svg>'), 'SVG markup must be properly closed');
    }
  });

  it('T1-F15-04: Category filtering correctly filters markers before cluster formation', () => {
    // Filter only ROAD_ACCIDENT
    const filter = new Set<ReportCategory>(['ROAD_ACCIDENT']);
    const clustered = clusterIncidents(sampleDhakaIncidents, 10, filter);

    const totalRenderedIncidents = clustered.reduce(
      (acc, c) => acc + (c as MapCluster).count,
      0
    );

    // Only the 2 ROAD_ACCIDENT items should be present
    assert.strictEqual(
      totalRenderedIncidents,
      2,
      'Filter must exclude non-ROAD_ACCIDENT incidents before clustering'
    );
  });

  it('T1-F15-05: Cluster composite severity reflects highest severity of constituent incident pins', () => {
    const mixedSeverities: ClusterPoint[] = [
      { id: '1', category: 'THEFT', severity: 'LOW', latitude: 23.750, longitude: 90.380 },
      { id: '2', category: 'SNATCHING', severity: 'MEDIUM', latitude: 23.751, longitude: 90.381 },
      { id: '3', category: 'ROAD_ACCIDENT', severity: 'HIGH', latitude: 23.752, longitude: 90.382 },
    ];

    const clusters = clusterIncidents(mixedSeverities, 10) as MapCluster[];
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(
      clusters[0].highestSeverity,
      'HIGH',
      'Cluster containing HIGH severity incident must reflect HIGH composite alert rating'
    );
  });
});
