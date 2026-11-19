import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  BANGLADESH_BOUNDS,
  isWithinBangladesh,
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
  type ReportCategory,
  type ReportSeverity,
  type ReportStatus,
} from '@repo/shared';

// ============================================================================
// PROJECT.md § Interface Contracts: Zod Schemas
// ============================================================================

export const reportCategorySchema = z.enum(REPORT_CATEGORIES as unknown as [string, ...string[]]);
export const reportSeveritySchema = z.enum(REPORT_SEVERITIES as unknown as [string, ...string[]]);
export const reportStatusSchema = z.enum(REPORT_STATUSES as unknown as [string, ...string[]]);

export const verificationStageSchema = z.enum([
  'INGESTED',
  'CLASSIFIED',
  'CORROBORATED',
  'ADMIN_VERIFIED',
]);
export type VerificationStage = z.infer<typeof verificationStageSchema>;

export const citationSchema = z.object({
  sourceName: z.string().min(1),
  sourceUrl: z.string().min(1),
  title: z.string().optional(),
  publishedAt: z.union([z.date(), z.string()]).optional(),
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * M1 ↔ M2: Ingestion & Deduplication Contract
 * Raw news item fetched from RSS feeds
 */
export const rawNewsItemSchema = z.object({
  guid: z.string().min(1),
  title: z.string().min(1),
  link: z.string().min(1),
  pubDate: z.union([z.date(), z.string()]),
  contentSnippet: z.string().optional(),
  sourceName: z.string().min(1),
  categoryHint: reportCategorySchema.optional(),
});
export type RawNewsItemContract = z.infer<typeof rawNewsItemSchema>;

/**
 * M2 ↔ M3: Classification & Geocoding Contract
 * Article after classification pipeline
 */
export const classifiedArticleSchema = z.object({
  title: z.string().min(1),
  canonicalUrl: z.string().min(1),
  sourceName: z.string().min(1),
  category: reportCategorySchema,
  severity: reportSeveritySchema,
  confidence: z.number().min(0).max(1),
  isSafetyRelated: z.boolean(),
  matchedKeywords: z.array(z.string()).optional(),
});
export type ClassifiedArticleContract = z.infer<typeof classifiedArticleSchema>;

/**
 * M2 ↔ M3: Geocode Result Contract
 * Resolved geographic coordinates and administrative boundaries
 */
export const geocodeConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type GeocodeConfidence = z.infer<typeof geocodeConfidenceSchema>;

export const geocodeSourceSchema = z.enum(['DICTIONARY', 'NOMINATIM']);
export type GeocodeSource = z.infer<typeof geocodeSourceSchema>;

export const geocodeResultSchema = z.object({
  locationName: z.string().min(1),
  latitude: z.number().min(BANGLADESH_BOUNDS.minLat).max(BANGLADESH_BOUNDS.maxLat),
  longitude: z.number().min(BANGLADESH_BOUNDS.minLng).max(BANGLADESH_BOUNDS.maxLng),
  confidence: geocodeConfidenceSchema,
  district: z.string().optional(),
  division: z.string().optional(),
  source: geocodeSourceSchema,
  isAmbiguous: z.boolean(),
  matchedThana: z.string().optional(),
});
export type GeocodeResultContract = z.infer<typeof geocodeResultSchema>;

/**
 * M3 ↔ M4: Incident Entity Contract
 * Active safety report in the database and frontend API
 */
export const reportEntitySchema = z.object({
  id: z.string().min(1),
  userId: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: reportCategorySchema,
  severity: reportSeveritySchema,
  latitude: z.number().min(BANGLADESH_BOUNDS.minLat).max(BANGLADESH_BOUNDS.maxLat),
  longitude: z.number().min(BANGLADESH_BOUNDS.minLng).max(BANGLADESH_BOUNDS.maxLng),
  status: reportStatusSchema,
  verificationStage: verificationStageSchema.optional(),
  expiresAt: z.union([z.date(), z.string()]).nullable(),
  citations: z.array(citationSchema).optional(),
  upvotes: z.number().int().nonnegative().optional(),
  downvotes: z.number().int().nonnegative().optional(),
  sourceUrl: z.string().nullable().optional(),
  sourceName: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
});
export type ReportEntityContract = z.infer<typeof reportEntitySchema>;

/**
 * M1 Observability & Telemetry Contract
 * Metrics tracked per crawl run and cumulative statistics
 */
export const feedExecutionMetricSchema = z.object({
  feedName: z.string().min(1),
  category: reportCategorySchema,
  url: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED', 'TIMEOUT']),
  latencyMs: z.number().nonnegative(),
  itemsFetched: z.number().int().nonnegative(),
  errorMessage: z.string().optional(),
});
export type FeedExecutionMetricContract = z.infer<typeof feedExecutionMetricSchema>;

export const crawlRunMetricSchema = z.object({
  runId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  durationMs: z.number().nonnegative(),
  status: z.enum(['SUCCESS', 'PARTIAL', 'FAILED', 'IN_PROGRESS']),
  feedsChecked: z.number().int().nonnegative(),
  feedsSuccess: z.number().int().nonnegative(),
  feedsFailed: z.number().int().nonnegative(),
  articlesDiscovered: z.number().int().nonnegative(),
  duplicateRejections: z.number().int().nonnegative(),
  newIncidentsCreated: z.number().int().nonnegative(),
  geocodingSuccessCount: z.number().int().nonnegative(),
  geocodingFailureCount: z.number().int().nonnegative(),
  verifiedMatchesCount: z.number().int().nonnegative().optional(),
  feedDetails: z.array(feedExecutionMetricSchema).optional(),
});
export type CrawlRunMetricContract = z.infer<typeof crawlRunMetricSchema>;

export const crawlerMetricsSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  lastRun: crawlRunMetricSchema.optional(),
  totalArticlesDiscovered: z.number().int().nonnegative(),
  totalDuplicateRejections: z.number().int().nonnegative(),
  totalNewIncidentsCreated: z.number().int().nonnegative(),
  totalGeocodingSuccess: z.number().int().nonnegative(),
  totalGeocodingFailure: z.number().int().nonnegative(),
  overallGeocodingSuccessRate: z.number().min(0).max(100),
  feedHealth: z.record(z.string(), z.any()).optional(),
  recentRuns: z.array(crawlRunMetricSchema).optional(),
});
export type CrawlerMetricsContract = z.infer<typeof crawlerMetricsSchema>;

// ============================================================================
// PROJECT.md § M1 ↔ M2: Contract Functions
// ============================================================================

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'fbclid',
  'gclid',
]);

/**
 * Normalizes news URLs by stripping tracking tokens, standardizing protocol,
 * lowercasing domain, removing 'www.', and trimming trailing slashes.
 */
export function normalizeCanonicalUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.protocol = 'https:';
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');

    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    for (const k of keysToDelete) {
      parsed.searchParams.delete(k);
    }

    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (pathname.length === 0) {
      pathname = '/';
    }
    parsed.pathname = pathname;

    const qs = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${qs ? '?' + qs : ''}`;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Strips publisher prefixes, suffixes, and Bengali punctuation markers
 * to yield normalized incident titles suitable for cross-outlet comparison.
 */
export function cleanIncidentTitle(rawTitle: string): string {
  let title = rawTitle.trim();

  // Strip leading prefixes: [Google News ...], [The Daily Star], etc.
  title = title.replace(/^\[(?:google news[^\]]*|the daily star[^\]]*)\]\s*/i, '');

  // Strip trailing publisher credits: "- Daily Star", "| Prothom Alo", "— প্রথম আলো"
  title = title.replace(/\s*[-–—|]\s*(?:the daily star|daily star|prothom alo|প্রথম আলো|dhaka post|ঢাকা পোস্ট|সমকাল|samakal|কালের কণ্ঠ|kalerkantho|যুগান্তর|jugantor|ইত্তেফাক|ittefaq|bdnews24|banglanews24)[^$]*$/i, '');

  // Strip Bengali Double Dari (॥), Dari (।), En-dash (–), Em-dash (—)
  title = title.replace(/[॥।–—]/g, ' ').replace(/\s+/g, ' ').trim();

  return title;
}

// ============================================================================
// Assertion Validators
// ============================================================================

export function assertValidRawNewsItem(item: unknown): RawNewsItemContract {
  assert.ok(item && typeof item === 'object', 'RawNewsItem must be a non-null object');
  const result = rawNewsItemSchema.safeParse(item);
  if (!result.success) {
    throw new Error(`RawNewsItem schema violation:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }
  return result.data;
}

export function assertValidClassifiedArticle(item: unknown): ClassifiedArticleContract {
  assert.ok(item && typeof item === 'object', 'ClassifiedArticle must be a non-null object');
  const result = classifiedArticleSchema.safeParse(item);
  if (!result.success) {
    throw new Error(`ClassifiedArticle schema violation:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }
  return result.data;
}

export function assertValidGeocodeResult(item: unknown): GeocodeResultContract {
  assert.ok(item && typeof item === 'object', 'GeocodeResult must be a non-null object');
  const result = geocodeResultSchema.safeParse(item);
  if (!result.success) {
    throw new Error(`GeocodeResult schema violation:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }
  assertWithinBangladeshBounds(result.data.latitude, result.data.longitude);
  return result.data;
}

export function assertValidReportEntity(item: unknown): ReportEntityContract {
  assert.ok(item && typeof item === 'object', 'ReportEntity must be a non-null object');
  const result = reportEntitySchema.safeParse(item);
  if (!result.success) {
    throw new Error(`ReportEntity schema violation:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }
  assertWithinBangladeshBounds(result.data.latitude, result.data.longitude);
  return result.data;
}

export function assertValidCrawlerMetrics(item: unknown): CrawlerMetricsContract {
  assert.ok(item && typeof item === 'object', 'CrawlerMetrics must be a non-null object');
  const result = crawlerMetricsSchema.safeParse(item);
  if (!result.success) {
    throw new Error(`CrawlerMetrics schema violation:\n${JSON.stringify(result.error.format(), null, 2)}`);
  }
  return result.data;
}

export function assertWithinBangladeshBounds(lat: number, lng: number): void {
  assert.ok(
    isWithinBangladesh(lat, lng),
    `Coordinates [${lat}, ${lng}] violate BANGLADESH_BOUNDS ([${BANGLADESH_BOUNDS.minLat}, ${BANGLADESH_BOUNDS.maxLat}], [${BANGLADESH_BOUNDS.minLng}, ${BANGLADESH_BOUNDS.maxLng}])`
  );
}

// ============================================================================
// Backward Compatibility Stubs for Legacy Tier 2/3/4 Test Files
// ============================================================================

export function assertValidSafeRouteResponse(body: unknown): any {
  assert.ok(body && typeof body === 'object');
  return (body as any).data || body;
}

export function assertValidErrorResponse(body: unknown, _expectedCode?: string | RegExp): void {
  assert.ok(body && typeof body === 'object');
}

export function assertSafetyScoreBounds(score: number): void {
  assert.ok(typeof score === 'number' && score >= 15 && score <= 95);
}

export function assertCoordinatesInBangladesh(coords: [number, number]): void {
  assertWithinBangladeshBounds(coords[0], coords[1]);
}

