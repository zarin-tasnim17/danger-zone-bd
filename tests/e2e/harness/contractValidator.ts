import assert from 'node:assert/strict';
import { z } from 'zod';
import type {
  SafeRouteOutput,
  RouteAlternative,
  LocalizedHazard,
  NavigationStep,
  TransportMode,
  RouteSafetyRating,
  OverallRouteSafetyRating,
} from '@repo/shared';

// Zod schemas matching PROJECT.md § Interface Contracts
export const transportModeSchema = z.enum(['walking', 'driving']);

export const reportSeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const localizedHazardSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  severity: reportSeveritySchema,
  distanceFromRouteMeters: z.number().nonnegative(),
  latitude: z.number().min(20.0).max(27.0),
  longitude: z.number().min(87.5).max(93.0),
  description: z.string().nullable().optional(),
  approxStreetName: z.string().optional(),
});

export const navigationStepSchema = z.object({
  instruction: z.string().min(1),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  maneuverType: z.string().min(1),
  location: z.tuple([
    z.number().min(20.0).max(27.0), // Latitude
    z.number().min(87.5).max(93.0), // Longitude
  ]),
  hazardWarning: z.string().optional(),
});

export const routeSafetyRatingSchema = z.enum([
  'LOW_HAZARD_EXPOSURE',
  'MODERATE_HAZARD_EXPOSURE',
  'HIGH_HAZARD_EXPOSURE',
]);

export const legacySafetyRatingSchema = z.enum([
  'CLEAR',
  'HIGH_SAFETY',
  'MODERATE_RISK',
]);

export const overallRouteSafetyRatingSchema = z.union([
  routeSafetyRatingSchema,
  legacySafetyRatingSchema,
]);

export const routeAlternativeSchema = z.object({
  id: z.enum(['safest', 'fastest', 'alternative']),
  title: z.string().min(1),
  isRecommended: z.boolean(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  safetyScore: z.number().min(15.0).max(95.0),
  safetyRating: routeSafetyRatingSchema,
  hazardCount: z.number().int().nonnegative(),
  hazards: z.array(localizedHazardSchema),
  geometry: z.array(
    z.tuple([
      z.number().min(20.0).max(27.0), // Latitude
      z.number().min(87.5).max(93.0), // Longitude
    ])
  ).min(1),
  steps: z.array(navigationStepSchema),
});

export const safeRouteOutputSchema = z.object({
  // Legacy backward-compatible fields
  origin: z.tuple([
    z.number().min(20.0).max(27.0),
    z.number().min(87.5).max(93.0),
  ]),
  destination: z.tuple([
    z.number().min(20.0).max(27.0),
    z.number().min(87.5).max(93.0),
  ]),
  directDistanceMeters: z.number().nonnegative(),
  safeDistanceMeters: z.number().nonnegative(),
  safetyRating: overallRouteSafetyRatingSchema,
  bypassedHazardsCount: z.number().int().nonnegative(),
  bypassedHazards: z.array(localizedHazardSchema),
  waypoints: z.array(
    z.tuple([
      z.number().min(20.0).max(27.0),
      z.number().min(87.5).max(93.0),
    ])
  ).min(1),
  // Enhanced multi-route fields
  mode: transportModeSchema,
  routes: z.array(routeAlternativeSchema).min(1),
  tradeOffSummary: z.string().optional(),
});

export const apiSuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: safeRouteOutputSchema,
  message: z.string().optional(),
});

export const apiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().optional(),
    message: z.string(),
  }).optional(),
  message: z.string().optional(),
});

/**
 * Asserts that the response body strictly adheres to the SafeRouteOutput contract.
 * Returns the validated SafeRouteOutput data.
 */
export function assertValidSafeRouteResponse(body: unknown): SafeRouteOutput {
  assert.ok(body && typeof body === 'object', 'Response body must be a non-null object');
  const parsed = apiSuccessEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Response does not match SafeRouteOutput contract schema:\n${JSON.stringify(parsed.error.format(), null, 2)}`
    );
  }

  const data = parsed.data.data;

  // Invariant: Exactly one route is flagged as isRecommended: true
  const recommendedCount = data.routes.filter((r) => r.isRecommended).length;
  assert.strictEqual(
    recommendedCount,
    1,
    `Expected exactly 1 recommended route, found ${recommendedCount}`
  );

  // Invariant: Legacy envelope safeDistanceMeters matches recommended route distance
  const recommendedRoute = data.routes.find((r) => r.isRecommended)!;
  assert.strictEqual(
    data.safeDistanceMeters,
    recommendedRoute.distanceMeters,
    'Top-level safeDistanceMeters must match recommended alternative distanceMeters'
  );

  // Invariant: Bypassed hazard count matches recommended route hazard count
  assert.strictEqual(
    data.bypassedHazardsCount,
    recommendedRoute.hazardCount,
    'Top-level bypassedHazardsCount must match recommended alternative hazardCount'
  );

  return data;
}

/**
 * Asserts that the error response conforms to the error envelope schema.
 */
export function assertValidErrorResponse(
  body: unknown,
  expectedCode?: string | RegExp
): void {
  assert.ok(body && typeof body === 'object', 'Error response must be a non-null object');
  const parsed = apiErrorEnvelopeSchema.safeParse(body);
  assert.ok(parsed.success, 'Response must conform to API error envelope');
  assert.strictEqual(parsed.data.success, false, 'Expected success === false');

  if (expectedCode) {
    const code = parsed.data.error?.code || '';
    const message = parsed.data.error?.message || parsed.data.message || '';
    const textToMatch = `${code} ${message}`;
    if (typeof expectedCode === 'string') {
      assert.ok(
        textToMatch.toLowerCase().includes(expectedCode.toLowerCase()),
        `Expected error to contain "${expectedCode}", got "${textToMatch}"`
      );
    } else {
      assert.ok(
        expectedCode.test(textToMatch),
        `Expected error to match ${expectedCode}, got "${textToMatch}"`
      );
    }
  }
}

/**
 * Asserts that the safety score respects the continuous clamp [15.0, 95.0].
 * Ensures no false 100% safety claims or sub-15% anomalies.
 */
export function assertSafetyScoreBounds(score: number): void {
  assert.ok(
    typeof score === 'number' && !Number.isNaN(score),
    `Safety score must be a valid number, got ${score}`
  );
  assert.ok(
    score >= 15.0 && score <= 95.0,
    `Safety score ${score} must be within bounds [15.0, 95.0]`
  );
}

/**
 * Asserts that coordinates are strictly within Bangladesh geographic limits.
 */
export function assertCoordinatesInBangladesh(coords: [number, number]): void {
  const [lat, lng] = coords;
  assert.ok(
    lat >= 20.0 && lat <= 27.0,
    `Latitude ${lat} is outside Bangladesh envelope [20.0, 27.0]`
  );
  assert.ok(
    lng >= 87.5 && lng <= 93.0,
    `Longitude ${lng} is outside Bangladesh envelope [87.5, 93.0]`
  );
}
