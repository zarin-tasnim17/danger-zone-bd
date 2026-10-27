import { prisma } from '../db/prisma';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface BypassedHazard {
  id: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
  distanceFromRouteMeters: number;
}

export interface SafeRouteOutput {
  origin: [number, number];
  destination: [number, number];
  directDistanceMeters: number;
  safeDistanceMeters: number;
  safetyRating: 'CLEAR' | 'HIGH_SAFETY' | 'MODERATE_RISK';
  bypassedHazardsCount: number;
  bypassedHazards: BypassedHazard[];
  waypoints: [number, number][]; // [lat, lng] array
}

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula)
 */
export const haversineDistanceMeters = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculates perpendicular distance from a hazard point to a line segment in meters
 */
export const distanceToSegmentMeters = (
  pointLat: number, pointLng: number,
  segStartLat: number, segStartLng: number,
  segEndLat: number, segEndLng: number
): { distanceMeters: number; projectionFactor: number } => {
  const dx = segEndLng - segStartLng;
  const dy = segEndLat - segStartLat;

  if (dx === 0 && dy === 0) {
    return {
      distanceMeters: haversineDistanceMeters(pointLat, pointLng, segStartLat, segStartLng),
      projectionFactor: 0
    };
  }

  // Projection parameter t
  let t = ((pointLng - segStartLng) * dx + (pointLat - segStartLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projLat = segStartLat + t * dy;
  const projLng = segStartLng + t * dx;

  return {
    distanceMeters: haversineDistanceMeters(pointLat, pointLng, projLat, projLng),
    projectionFactor: t
  };
};

/**
 * Validates coordinate point against Bangladesh geographic envelope
 */
export const validateBangladeshBounds = (lat: number, lng: number, label: string = 'Coordinate') => {
  if (lat < 20.3 || lat > 26.8 || lng < 87.8 || lng > 92.9) {
    throw new Error(
      `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)}) is outside Bangladesh territory boundaries.`
    );
  }
};

/**
 * Calculates an optimal safe route between two points that actively detours
 * around active short-term crimes and long-term infrastructural danger zones.
 */
export const calculateSafeRoute = async (
  start: RoutePoint,
  end: RoutePoint
): Promise<SafeRouteOutput> => {
  validateBangladeshBounds(start.latitude, start.longitude, 'Starting point');
  validateBangladeshBounds(end.latitude, end.longitude, 'Destination');

  const directDistance = haversineDistanceMeters(
    start.latitude, start.longitude,
    end.latitude, end.longitude
  );

  // Safety buffer per severity level in meters
  const SEVERITY_BUFFER_METERS: Record<string, number> = {
    HIGH: 500,    // 500m exclusion perimeter for active crimes/mugging
    MEDIUM: 250,  // 250m exclusion perimeter
    LOW: 120      // 120m exclusion perimeter
  };

  // Search envelope with 0.05 deg (~5km) padding
  const minLng = Math.min(start.longitude, end.longitude) - 0.05;
  const minLat = Math.min(start.latitude, end.latitude) - 0.05;
  const maxLng = Math.max(start.longitude, end.longitude) + 0.05;
  const maxLat = Math.max(start.latitude, end.latitude) + 0.05;

  // Query all active reports in the corridor
  const activeCorridorReports: any[] = await prisma.$queryRaw`
    SELECT id, category, severity, latitude, longitude
    FROM "Report"
    WHERE status = 'ACTIVE'
      AND "expiresAt" > NOW()
      AND location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
  `;

  const bypassedHazards: BypassedHazard[] = [];
  const detourPoints: Array<{ t: number; lat: number; lng: number }> = [];

  const routeDx = end.longitude - start.longitude;
  const routeDy = end.latitude - start.latitude;

  for (const report of activeCorridorReports) {
    const buffer = SEVERITY_BUFFER_METERS[report.severity] || 250;
    const { distanceMeters, projectionFactor } = distanceToSegmentMeters(
      report.latitude, report.longitude,
      start.latitude, start.longitude,
      end.latitude, end.longitude
    );

    // Hazard intersects or lies dangerously close to the trajectory
    if (distanceMeters < buffer && projectionFactor > 0.05 && projectionFactor < 0.95) {
      bypassedHazards.push({
        id: report.id,
        category: report.category,
        severity: report.severity,
        latitude: report.latitude,
        longitude: report.longitude,
        distanceFromRouteMeters: Math.round(distanceMeters)
      });

      // Calculate avoidance detour point orthogonal to the route trajectory
      const len = Math.sqrt(routeDx * routeDx + routeDy * routeDy);
      if (len > 0) {
        // Normal orthogonal vector
        let normalX = -routeDy / len;
        let normalY = routeDx / len;

        // Determine which side of the line the hazard is on
        const side = (report.longitude - start.longitude) * routeDy - (report.latitude - start.latitude) * routeDx;
        const detourDir = side >= 0 ? -1 : 1; // Steer towards opposite side of hazard

        // Convert offset meters to approx degrees (1 deg ~ 111,320m)
        const offsetMeters = buffer + 150; // Buffer plus safety clearance
        const offsetDeg = offsetMeters / 111320;

        const detourLat = report.latitude + detourDir * normalY * offsetDeg;
        const detourLng = report.longitude + detourDir * normalX * offsetDeg;

        detourPoints.push({
          t: projectionFactor,
          lat: detourLat,
          lng: detourLng
        });
      }
    }
  }

  // Sort detour points chronologically along trajectory
  detourPoints.sort((a, b) => a.t - b.t);

  // Assemble polyline waypoints: Origin -> Detours -> Destination
  const waypoints: [number, number][] = [
    [start.latitude, start.longitude],
    ...detourPoints.map((d) => [Number(d.lat.toFixed(6)), Number(d.lng.toFixed(6))] as [number, number]),
    [end.latitude, end.longitude]
  ];

  // Calculate actual total distance along safe polyline
  let safeDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    safeDistance += haversineDistanceMeters(
      waypoints[i][0], waypoints[i][1],
      waypoints[i + 1][0], waypoints[i + 1][1]
    );
  }

  return {
    origin: [start.latitude, start.longitude],
    destination: [end.latitude, end.longitude],
    directDistanceMeters: Math.round(directDistance),
    safeDistanceMeters: Math.round(safeDistance),
    safetyRating: bypassedHazards.length === 0 ? 'CLEAR' : 'HIGH_SAFETY',
    bypassedHazardsCount: bypassedHazards.length,
    bypassedHazards,
    waypoints
  };
};
