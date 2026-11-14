import assert from 'node:assert/strict';

/**
 * Calculates great-circle distance between two coordinates in meters using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates total cumulative distance along a multi-point polyline in meters.
 */
export function polylineDistance(coords: [number, number][]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistance(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1]
    );
  }
  return total;
}

/**
 * Validates whether a coordinate point lies within Bangladesh geographic envelope.
 */
export function isCoordinateInBangladesh(lat: number, lng: number): boolean {
  return lat >= 20.3 && lat <= 26.8 && lng >= 87.8 && lng <= 92.9;
}

/**
 * Asserts coordinate ordering: strictly [latitude, longitude].
 * Latitude in Bangladesh is ~20-27; Longitude is ~88-93.
 * Throws if coordinates appear inverted ([lng, lat]).
 */
export function assertCoordinateOrdering(coords: [number, number][]): void {
  for (let i = 0; i < coords.length; i++) {
    const [lat, lng] = coords[i];
    assert.ok(
      lat >= 20.0 && lat <= 27.0,
      `Coordinate index ${i} has invalid latitude: ${lat}. Expected [latitude, longitude] ordering.`
    );
    assert.ok(
      lng >= 87.5 && lng <= 93.0,
      `Coordinate index ${i} has invalid longitude: ${lng}. Expected [latitude, longitude] ordering.`
    );
  }
}

/**
 * Calculates perpendicular distance from a point to a line segment in meters.
 */
export function distancePointToSegmentMeters(
  pointLat: number,
  pointLng: number,
  segStartLat: number,
  segStartLng: number,
  segEndLat: number,
  segEndLng: number
): { distanceMeters: number; projectionFactor: number } {
  const dx = segEndLng - segStartLng;
  const dy = segEndLat - segStartLat;

  if (dx === 0 && dy === 0) {
    return {
      distanceMeters: haversineDistance(pointLat, pointLng, segStartLat, segStartLng),
      projectionFactor: 0,
    };
  }

  let t = ((pointLng - segStartLng) * dx + (pointLat - segStartLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projLat = segStartLat + t * dy;
  const projLng = segStartLng + t * dx;

  return {
    distanceMeters: haversineDistance(pointLat, pointLng, projLat, projLng),
    projectionFactor: t,
  };
}

/**
 * Finds the minimum distance from a coordinate point to a polyline in meters.
 */
export function distancePointToPolylineMeters(
  point: [number, number],
  polyline: [number, number][]
): number {
  if (!polyline || polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return haversineDistance(point[0], point[1], polyline[0][0], polyline[0][1]);
  }

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const { distanceMeters } = distancePointToSegmentMeters(
      point[0],
      point[1],
      polyline[i][0],
      polyline[i][1],
      polyline[i + 1][0],
      polyline[i + 1][1]
    );
    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
    }
  }
  return minDistance;
}

/**
 * Checks if a point is within a given buffer distance (meters) of a polyline.
 */
export function isPointWithinCorridor(
  point: [number, number],
  polyline: [number, number][],
  bufferMeters: number
): boolean {
  return distancePointToPolylineMeters(point, polyline) <= bufferMeters;
}

/**
 * Calculates the maximum lateral deviation of intermediate polyline vertices
 * from the direct chord connecting start and end.
 * Proves street curvature vs straight line.
 */
export function calculatePolylineLateralDeviation(
  polyline: [number, number][]
): number {
  if (!polyline || polyline.length < 3) return 0;
  const start = polyline[0];
  const end = polyline[polyline.length - 1];

  let maxDeviation = 0;
  for (let i = 1; i < polyline.length - 1; i++) {
    const { distanceMeters } = distancePointToSegmentMeters(
      polyline[i][0],
      polyline[i][1],
      start[0],
      start[1],
      end[0],
      end[1]
    );
    if (distanceMeters > maxDeviation) {
      maxDeviation = distanceMeters;
    }
  }
  return maxDeviation;
}
