import { prisma } from '../db/prisma';
import { env } from '../config/env';
import {
  isActiveThreatIncident,
  type SafeRouteOutput,
  type RouteAlternative,
  type LocalizedHazard,
  type NavigationStep,
  type TransportMode,
  type RouteSafetyRating,
  type OverallRouteSafetyRating,
} from '@repo/shared';

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

// Backward compatibility alias
export type BypassedHazard = LocalizedHazard;

export interface SafeRouteOptions {
  injectedHazards?: any[];
  osrmBaseUrl?: string;
}

/**
 * Calculates great-circle distance between two coordinates in meters (Haversine formula)
 */
export const haversineDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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
  pointLat: number,
  pointLng: number,
  segStartLat: number,
  segStartLng: number,
  segEndLat: number,
  segEndLng: number
): { distanceMeters: number; projectionFactor: number } => {
  const dx = segEndLng - segStartLng;
  const dy = segEndLat - segStartLat;

  if (dx === 0 && dy === 0) {
    return {
      distanceMeters: haversineDistanceMeters(pointLat, pointLng, segStartLat, segStartLng),
      projectionFactor: 0,
    };
  }

  let t = ((pointLng - segStartLng) * dx + (pointLat - segStartLat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));

  const projLat = segStartLat + t * dy;
  const projLng = segStartLng + t * dx;

  return {
    distanceMeters: haversineDistanceMeters(pointLat, pointLng, projLat, projLng),
    projectionFactor: t,
  };
};

/**
 * Finds the minimum distance from a coordinate point to a polyline in meters
 */
export const distancePointToPolylineMeters = (
  point: [number, number],
  polyline: [number, number][]
): number => {
  if (!polyline || polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return haversineDistanceMeters(point[0], point[1], polyline[0][0], polyline[0][1]);
  }

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const { distanceMeters } = distanceToSegmentMeters(
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
};

/**
 * Calculates total cumulative distance along a polyline in meters
 */
export const polylineDistanceMeters = (coords: [number, number][]): number => {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistanceMeters(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1]
    );
  }
  return total;
};

/**
 * Validates coordinate point against Bangladesh geographic envelope
 */
export const validateBangladeshBounds = (
  lat: number,
  lng: number,
  label: string = 'Coordinate'
) => {
  if (lat < 20.3 || lat > 26.8 || lng < 87.8 || lng > 92.9) {
    const err: any = new Error(
      `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)}) is outside Bangladesh territory boundaries.`
    );
    err.statusCode = 400;
    throw err;
  }
};

/**
 * Derives categorical safety rating from continuous safety score [15.0, 95.0]
 */
export const deriveSafetyRating = (score: number): RouteSafetyRating => {
  if (score >= 80.0) return 'LOW_HAZARD_EXPOSURE';
  if (score >= 50.0) return 'MODERATE_HAZARD_EXPOSURE';
  return 'HIGH_HAZARD_EXPOSURE';
};

/**
 * Formats a navigation step maneuver into a descriptive natural language instruction
 */
export const formatManeuverInstruction = (st: any): string => {
  if (st.instruction) return st.instruction;

  const streetName = st.name ? st.name.trim() : '';
  const type = st.maneuver?.type || 'turn';
  const modifier = st.maneuver?.modifier ? st.maneuver.modifier.replace(/_/g, ' ') : '';

  switch (type) {
    case 'depart':
      return streetName ? `Depart onto ${streetName}` : 'Depart from origin';
    case 'arrive':
      return modifier ? `Arrive at destination on the ${modifier}` : 'Arrive at destination';
    case 'turn':
      return modifier
        ? `Turn ${modifier}${streetName ? ` onto ${streetName}` : ''}`
        : `Turn${streetName ? ` onto ${streetName}` : ''}`;
    case 'new name':
    case 'continue':
      return streetName ? `Continue onto ${streetName}` : 'Continue straight';
    case 'roundabout':
    case 'rotary':
      return modifier
        ? `At the roundabout, exit ${modifier}${streetName ? ` onto ${streetName}` : ''}`
        : `Enter roundabout${streetName ? ` toward ${streetName}` : ''}`;
    case 'merge':
      return modifier
        ? `Merge ${modifier}${streetName ? ` onto ${streetName}` : ''}`
        : `Merge${streetName ? ` onto ${streetName}` : ''}`;
    case 'fork':
      return modifier
        ? `Take the fork ${modifier}${streetName ? ` onto ${streetName}` : ''}`
        : `Keep ${modifier || 'straight'}${streetName ? ` onto ${streetName}` : ''}`;
    case 'on ramp':
      return `Take on-ramp${streetName ? ` onto ${streetName}` : ''}`;
    case 'off ramp':
      return `Take exit ramp${streetName ? ` toward ${streetName}` : ''}`;
    case 'end of road':
      return modifier
        ? `Turn ${modifier} at end of road${streetName ? ` onto ${streetName}` : ''}`
        : `Turn at end of road${streetName ? ` onto ${streetName}` : ''}`;
    default:
      return streetName ? `Head along ${streetName}` : 'Continue along route';
  }
};

/**
 * Calculates explainable safety score reflecting estimated hazard exposure
 */
export const calculateSafetyScore = (
  distanceMeters: number,
  interceptedHazards: LocalizedHazard[],
  rawHazardsMap?: Map<string, { createdAt?: Date | string; isVerified?: boolean; upvotes?: number }>
): { safetyScore: number; safetyRating: RouteSafetyRating } => {
  const now = Date.now();
  let penalty = 0;

  for (const h of interceptedHazards) {
    const rawH = rawHazardsMap?.get(h.id);
    const baseWeight = h.severity === 'HIGH' ? 25 : h.severity === 'MEDIUM' ? 15 : 8;
    const buffer = h.severity === 'HIGH' ? 250 : h.severity === 'MEDIUM' ? 150 : 80;

    // Quadratic proximity falloff: ((buffer - dist) / buffer)^2
    const proximityRatio = Math.max(0, 1 - h.distanceFromRouteMeters / buffer);
    const proximityFalloff = proximityRatio * proximityRatio;

    // Recency decay: e^(-0.05 * ageHours)
    const createdAt = rawH?.createdAt ? new Date(rawH.createdAt).getTime() : now;
    const ageHours = Math.max(0, (now - createdAt) / (1000 * 3600));
    const recencyDecay = Math.exp(-0.05 * ageHours);

    // Verification multiplier: verified = 1.0, upvotes >= 3 = 0.9, unverified = 0.6
    const verificationMultiplier = rawH?.isVerified ? 1.0 : (rawH?.upvotes || 0) >= 3 ? 0.9 : 0.6;

    penalty += baseWeight * proximityFalloff * recencyDecay * verificationMultiplier;
  }

  // Distance penalty for long exposure
  const distPenalty = (distanceMeters / 1000) * 0.005;
  const rawScore = 95.0 - penalty - distPenalty;

  // Clamped continuously between 15.0 and 95.0
  const safetyScore = Math.min(95.0, Math.max(15.0, parseFloat(rawScore.toFixed(1))));
  const safetyRating = deriveSafetyRating(safetyScore);

  return { safetyScore, safetyRating };
};

/**
 * Calculates an optimal safe route between two points using genuine road network
 * geometry from OSRM and PostGIS spatial hazard corridor analysis.
 */
export const calculateSafeRoute = async (
  start: RoutePoint,
  end: RoutePoint,
  mode: TransportMode = 'driving',
  options?: SafeRouteOptions
): Promise<SafeRouteOutput> => {
  validateBangladeshBounds(start.latitude, start.longitude, 'Starting point');
  validateBangladeshBounds(end.latitude, end.longitude, 'Destination');

  const directDistance = Math.round(
    haversineDistanceMeters(start.latitude, start.longitude, end.latitude, end.longitude)
  );

  // Micro-route: start equals end (< ~0.01m)
  if (
    Math.abs(start.latitude - end.latitude) < 1e-7 &&
    Math.abs(start.longitude - end.longitude) < 1e-7
  ) {
    const singleCoord: [number, number] = [start.latitude, start.longitude];
    const zeroRoute: RouteAlternative = {
      id: 'fastest',
      title: 'Fastest Route',
      isRecommended: true,
      distanceMeters: 0,
      durationSeconds: 0,
      safetyScore: 95.0,
      safetyRating: 'LOW_HAZARD_EXPOSURE',
      hazardCount: 0,
      hazards: [],
      geometry: [singleCoord],
      steps: [
        {
          instruction: 'You have arrived at your destination.',
          distanceMeters: 0,
          durationSeconds: 0,
          maneuverType: 'arrive',
          location: singleCoord,
        },
      ],
    };

    return {
      origin: singleCoord,
      destination: singleCoord,
      directDistanceMeters: 0,
      safeDistanceMeters: 0,
      safetyRating: 'CLEAR',
      bypassedHazardsCount: 0,
      bypassedHazards: [],
      waypoints: [singleCoord],
      mode,
      routes: [zeroRoute],
    };
  }

  // Fetch routing geometry from OSRM
  const osrmProfile = mode === 'walking' ? 'walking' : 'driving';
  const osrmBaseUrl =
    options?.osrmBaseUrl ||
    process.env.OSRM_BASE_URL ||
    env.OSRM_BASE_URL ||
    'https://router.project-osrm.org';
  const osrmUrl = `${osrmBaseUrl}/route/v1/${osrmProfile}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  let osrmResponse: Response;
  const abortCtrl = new AbortController();
  const timer = setTimeout(() => abortCtrl.abort(), 5000);

  try {
    osrmResponse = await fetch(osrmUrl, { signal: abortCtrl.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error('Routing provider request timed out (>5000ms)');
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    const unavailErr: any = new Error('Routing provider unavailable');
    unavailErr.statusCode = 503;
    throw unavailErr;
  } finally {
    clearTimeout(timer);
  }

  if (osrmResponse.status === 503) {
    const err503: any = new Error('OSRM service unavailable (503)');
    err503.statusCode = 503;
    throw err503;
  }

  if (!osrmResponse.ok) {
    const err: any = new Error(`Routing provider returned status ${osrmResponse.status}`);
    err.statusCode = osrmResponse.status >= 500 ? 503 : 400;
    throw err;
  }

  const osrmData: any = await osrmResponse.json();
  if (!osrmData.routes || osrmData.routes.length === 0 || osrmData.code === 'NoRoute') {
    const noRouteErr: any = new Error('No route found between points (disconnected network)');
    noRouteErr.statusCode = 422;
    throw noRouteErr;
  }

  // Calculate spatial search envelope encompassing ALL route vertices across all alternatives + padding
  const allLats: number[] = [start.latitude, end.latitude];
  const allLngs: number[] = [start.longitude, end.longitude];

  for (const r of osrmData.routes) {
    if (r.geometry?.coordinates) {
      for (const [lng, lat] of r.geometry.coordinates) {
        allLats.push(lat);
        allLngs.push(lng);
      }
    }
  }

  const minLng = Math.min(...allLngs) - 0.015;
  const maxLng = Math.max(...allLngs) + 0.015;
  const minLat = Math.min(...allLats) - 0.015;
  const maxLat = Math.max(...allLats) + 0.015;

  let activeCorridorReports: any[] = [];
  const now = Date.now();

  if (options?.injectedHazards) {
    activeCorridorReports = options.injectedHazards.filter((h) => {
      return isActiveThreatIncident({
        status: h.status || 'ACTIVE',
        threatStatus: h.threatStatus || 'ACTIVE',
        locationPrecision: h.locationPrecision,
        expiresAt: h.expiresAt || new Date(now + 86400000),
      }, new Date(now));
    });
  } else {
    try {
      activeCorridorReports = await prisma.$queryRaw`
        SELECT r.id, r.category, r.severity, r.latitude, r.longitude, r.description, r."createdAt", r.upvotes, u."isVerified"
        FROM "Report" r
        LEFT JOIN "User" u ON r."userId" = u.id
        WHERE r.status = 'ACTIVE'
          AND r."threatStatus" = 'ACTIVE'
          AND (r."locationPrecision" IS NULL OR r."locationPrecision" != 'AMBIGUOUS')
          AND r."expiresAt" > NOW()
          AND (
            r.location && ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
            OR (r.latitude BETWEEN ${minLat} AND ${maxLat} AND r.longitude BETWEEN ${minLng} AND ${maxLng})
          )
      `;
    } catch {
      try {
        activeCorridorReports = await prisma.report.findMany({
          where: {
            status: 'ACTIVE',
            threatStatus: 'ACTIVE',
            locationPrecision: { not: 'AMBIGUOUS' },
            expiresAt: { gt: new Date() },
            latitude: { gte: minLat, lte: maxLat },
            longitude: { gte: minLng, lte: maxLng },
          },
          include: {
            user: { select: { isVerified: true } },
          },
        });
      } catch {
        activeCorridorReports = [];
      }
    }
  }

  const rawHazardsMap = new Map<
    string,
    { createdAt?: Date | string; isVerified?: boolean; upvotes?: number }
  >();

  for (const rep of activeCorridorReports) {
    rawHazardsMap.set(rep.id, {
      createdAt: rep.createdAt,
      isVerified: Boolean(rep.isVerified ?? rep.user?.isVerified),
      upvotes: rep.upvotes || 0,
    });
  }

  // Process all route alternatives from OSRM
  const routeAlternatives: RouteAlternative[] = osrmData.routes.map(
    (r: any, idx: number): RouteAlternative => {
      // Convert OSRM [lng, lat] to Leaflet [lat, lng]
      const geometry: [number, number][] = r.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      // Corridor proximity buffer thresholds: HIGH: 250m, MEDIUM: 150m, LOW: 80m
      const interceptedHazards: LocalizedHazard[] = [];
      const seenHazardIds = new Set<string>();

      for (const h of activeCorridorReports) {
        if (seenHazardIds.has(h.id)) continue;

        const bufferLimit = h.severity === 'HIGH' ? 250 : h.severity === 'MEDIUM' ? 150 : 80;
        const dist = distancePointToPolylineMeters([h.latitude, h.longitude], geometry);

        if (dist <= bufferLimit) {
          seenHazardIds.add(h.id);
          interceptedHazards.push({
            id: h.id,
            category: h.category,
            severity: h.severity,
            distanceFromRouteMeters: Math.round(dist),
            latitude: h.latitude,
            longitude: h.longitude,
            description: h.description || null,
            approxStreetName: h.approxStreetName,
          });
        }
      }

      // Safety scoring
      const { safetyScore, safetyRating } = calculateSafetyScore(
        r.distance,
        interceptedHazards,
        rawHazardsMap
      );

      // Normalize pedestrian walking duration if OSRM returned vehicular speeds (> 2.0 m/s = > 7.2 km/h)
      let durationSeconds = Math.round(r.duration);
      if (mode === 'walking') {
        const rawSpeedMps = r.duration > 0 ? r.distance / r.duration : 0;
        if (rawSpeedMps > 2.0 || r.duration === 0) {
          // Normalize to realistic human walking speed of 1.25 m/s (~4.5 km/h)
          durationSeconds = Math.round(r.distance / 1.25);
        }
      }

      // Navigation steps paired with localized hazard warnings
      const rawSteps: any[] = r.legs?.[0]?.steps || [];
      const seenWarningHazardIds = new Set<string>();

      let steps: NavigationStep[] = rawSteps.map((st: any) => {
        const stepLoc: [number, number] = [st.maneuver.location[1], st.maneuver.location[0]];
        let warning: string | undefined = undefined;

        for (const h of interceptedHazards) {
          const stepDist = haversineDistanceMeters(stepLoc[0], stepLoc[1], h.latitude, h.longitude);
          if (stepDist <= 180 && !seenWarningHazardIds.has(h.id)) {
            seenWarningHazardIds.add(h.id);
            warning = `Caution: Active ${h.severity} hazard (${h.category}) reported within ${Math.round(stepDist)}m`;
            break;
          }
        }

        let stepDuration = Math.round(st.duration);
        if (mode === 'walking' && (st.duration === 0 || (st.distance / st.duration > 2.0))) {
          stepDuration = Math.round(st.distance / 1.25);
        }

        return {
          instruction: formatManeuverInstruction(st),
          distanceMeters: Math.round(st.distance),
          durationSeconds: stepDuration,
          maneuverType: st.maneuver?.type || 'turn',
          location: stepLoc,
          hazardWarning: warning,
        };
      });

      // Ensure minimum turn-by-turn guidance steps exist
      if (steps.length === 0) {
        steps = [
          {
            instruction: 'Depart from origin toward destination',
            distanceMeters: Math.round(r.distance),
            durationSeconds,
            maneuverType: 'depart',
            location: geometry[0] || [start.latitude, start.longitude],
          },
          {
            instruction: 'Arrive at destination',
            distanceMeters: 0,
            durationSeconds: 0,
            maneuverType: 'arrive',
            location: geometry[geometry.length - 1] || [end.latitude, end.longitude],
          },
        ];
      }

      const id = idx === 0 ? 'fastest' : idx === 1 ? 'safest' : 'alternative';
      const title = idx === 0 ? 'Fastest Route' : idx === 1 ? 'Alternative Route' : 'Scenic Route';

      return {
        id: id as any,
        title,
        isRecommended: false,
        distanceMeters: Math.round(r.distance),
        durationSeconds,
        safetyScore,
        safetyRating,
        hazardCount: interceptedHazards.length,
        hazards: interceptedHazards,
        geometry,
        steps,
      };
    }
  );

  // Classify and recommend routes with transparent, explainable trade-offs:
  // 1. Identify index with minimum duration (fastest)
  let fastestIdx = 0;
  for (let i = 1; i < routeAlternatives.length; i++) {
    if (routeAlternatives[i].durationSeconds < routeAlternatives[fastestIdx].durationSeconds) {
      fastestIdx = i;
    }
  }

  // 2. Identify index with maximum safety score (safest). Tie breaker: shorter duration.
  let safestIdx = 0;
  for (let i = 1; i < routeAlternatives.length; i++) {
    if (routeAlternatives[i].safetyScore > routeAlternatives[safestIdx].safetyScore) {
      safestIdx = i;
    } else if (
      routeAlternatives[i].safetyScore === routeAlternatives[safestIdx].safetyScore &&
      routeAlternatives[i].durationSeconds < routeAlternatives[safestIdx].durationSeconds
    ) {
      safestIdx = i;
    }
  }

  // 3. Assign IDs, titles, and recommendation based on actual metrics
  const hasSafetyAdvantage =
    routeAlternatives[safestIdx].safetyScore > routeAlternatives[fastestIdx].safetyScore;

  let recommendedIdx: number;

  if (hasSafetyAdvantage) {
    // There is a safer route that detours around hazards! Recommend it.
    recommendedIdx = safestIdx;
    routeAlternatives[safestIdx].id = 'safest';
    routeAlternatives[safestIdx].title = 'Safest Alternative';

    routeAlternatives[fastestIdx].id = 'fastest';
    routeAlternatives[fastestIdx].title = 'Fastest Route';

    // Label remaining alternatives
    for (let i = 0; i < routeAlternatives.length; i++) {
      if (i !== safestIdx && i !== fastestIdx) {
        routeAlternatives[i].id = 'alternative';
        routeAlternatives[i].title = 'Alternative Route';
      }
    }
  } else {
    // Fastest route is already the safest or tied with highest score.
    recommendedIdx = fastestIdx;
    routeAlternatives[fastestIdx].id = 'fastest';
    routeAlternatives[fastestIdx].title =
      routeAlternatives[fastestIdx].hazardCount === 0 ? 'Fastest Route' : 'Fastest Route';

    for (let i = 0; i < routeAlternatives.length; i++) {
      if (i !== fastestIdx) {
        routeAlternatives[i].id = 'alternative';
        routeAlternatives[i].title = 'Alternative Route';
      }
    }
  }

  routeAlternatives[recommendedIdx].isRecommended = true;
  const recommended = routeAlternatives[recommendedIdx];

  // Trade-off summary formulation
  let tradeOffSummary: string | undefined = undefined;
  if (routeAlternatives.length > 1) {
    if (hasSafetyAdvantage) {
      const fastest = routeAlternatives[fastestIdx];
      const deltaT = Math.round(
        Math.abs(recommended.durationSeconds - fastest.durationSeconds) / 60
      );
      const deltaD = Math.round(Math.abs(recommended.distanceMeters - fastest.distanceMeters));
      const deltaH = Math.abs(fastest.hazardCount - recommended.hazardCount);

      tradeOffSummary = `Recommended route reduces hazard exposure by ${deltaH} incidents (safety score ${recommended.safetyScore} vs ${fastest.safetyScore}) with a trade-off of +${deltaD}m (+${deltaT} mins).`;
    } else {
      tradeOffSummary = `Fastest route is recommended with duration of ${Math.round(
        recommended.durationSeconds / 60
      )} mins with comparable safety score (${recommended.safetyScore}).`;
    }
  }

  // Top-level legacy safetyRating for backward compatibility
  const legacySafetyRating: OverallRouteSafetyRating =
    recommended.hazardCount === 0 ? 'CLEAR' : 'HIGH_SAFETY';

  return {
    origin: [start.latitude, start.longitude],
    destination: [end.latitude, end.longitude],
    directDistanceMeters: directDistance,
    safeDistanceMeters: recommended.distanceMeters,
    safetyRating: legacySafetyRating,
    bypassedHazardsCount: recommended.hazardCount,
    bypassedHazards: recommended.hazards,
    waypoints: recommended.geometry,
    mode,
    routes: routeAlternatives,
    tradeOffSummary,
  };
};
