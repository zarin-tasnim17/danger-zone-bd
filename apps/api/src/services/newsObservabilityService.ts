import { ReportCategory } from '@prisma/client';
import crypto from 'node:crypto';

export interface FeedExecutionMetric {
  feedName: string;
  category: ReportCategory;
  url: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  latencyMs: number;
  itemsFetched: number;
  errorMessage?: string;
}

export interface CrawlerRunTelemetry {
  crawlRunId: string; // UUID
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  feedsProcessed: number;
  feedsFailed: number;
  totalArticlesDiscovered: number;
  foreignArticlesFiltered: number;
  disqualifiedNonIncidents: number;
  stagedUnderReview: number;
  duplicatesConsolidated: number;
  newIncidentsCreated: number;
  errorSummaries: Array<{ feedUrl: string; error: string; isTimeout: boolean }>;
}

export interface CrawlRunMetric {
  runId: string;
  crawlRunId?: string;
  startTime: string;
  endTime?: string;
  startedAt?: Date;
  completedAt?: Date;
  durationMs: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'IN_PROGRESS';
  feedsChecked: number;
  feedsSuccess: number;
  feedsFailed: number;
  articlesDiscovered: number;
  foreignArticlesFiltered?: number;
  disqualifiedNonIncidents?: number;
  stagedUnderReview?: number;
  duplicateRejections: number;
  duplicatesConsolidated?: number;
  newIncidentsCreated: number;
  geocodingSuccessCount: number;
  geocodingFailureCount: number;
  verifiedMatchesCount: number;
  feedDetails: FeedExecutionMetric[];
  errorSummaries?: Array<{ feedUrl: string; error: string; isTimeout: boolean }>;
}

export interface FeedHealthSummary {
  feedName: string;
  category: ReportCategory;
  totalChecks: number;
  successes: number;
  failures: number;
  successRate: number;
  avgLatencyMs: number;
  lastChecked?: string;
  lastStatus?: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
}

export interface CrawlerTelemetrySummary {
  totalRuns: number;
  lastRun?: CrawlRunMetric;
  totalArticlesDiscovered: number;
  totalDuplicateRejections: number;
  totalNewIncidentsCreated: number;
  totalGeocodingSuccess: number;
  totalGeocodingFailure: number;
  overallGeocodingSuccessRate: number;
  feedHealth: Record<string, FeedHealthSummary>;
  recentRuns: CrawlRunMetric[];
}

export class NewsObservabilityService {
  private runs: CrawlRunMetric[] = [];
  private readonly maxStoredRuns = 50;

  // Cumulative counters
  private totalRuns = 0;
  private totalArticlesDiscovered = 0;
  private totalDuplicateRejections = 0;
  private totalNewIncidentsCreated = 0;
  private totalGeocodingSuccess = 0;
  private totalGeocodingFailure = 0;
  private feedStatsMap = new Map<string, {
    category: ReportCategory;
    totalChecks: number;
    successes: number;
    failures: number;
    totalLatencyMs: number;
    lastChecked?: string;
    lastStatus?: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  }>();

  /**
   * Starts tracking a new crawl execution run.
   */
  public startRun(runId?: string): CrawlRunRecorder {
    const isUuid = (str: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const generatedUuid = crypto.randomUUID();
    const crawlRunId = runId && isUuid(runId) ? runId : generatedUuid;
    const id = runId || crawlRunId;
    const startDate = new Date();
    const startIso = startDate.toISOString();

    const currentRun: CrawlRunMetric = {
      runId: id,
      crawlRunId,
      startTime: startIso,
      startedAt: startDate,
      durationMs: 0,
      status: 'IN_PROGRESS',
      feedsChecked: 0,
      feedsSuccess: 0,
      feedsFailed: 0,
      articlesDiscovered: 0,
      foreignArticlesFiltered: 0,
      disqualifiedNonIncidents: 0,
      stagedUnderReview: 0,
      duplicateRejections: 0,
      duplicatesConsolidated: 0,
      newIncidentsCreated: 0,
      geocodingSuccessCount: 0,
      geocodingFailureCount: 0,
      verifiedMatchesCount: 0,
      feedDetails: [],
      errorSummaries: [],
    };

    this.runs.unshift(currentRun);
    if (this.runs.length > this.maxStoredRuns) {
      this.runs.pop();
    }
    this.totalRuns++;

    return new CrawlRunRecorder(this, currentRun, crawlRunId, startDate);
  }

  /**
   * Internal recording helper called by CrawlRunRecorder.
   */
  public recordRunCompletion(run: CrawlRunMetric) {
    // Accumulate aggregate metrics
    this.totalArticlesDiscovered += run.articlesDiscovered;
    this.totalDuplicateRejections += run.duplicateRejections;
    this.totalNewIncidentsCreated += run.newIncidentsCreated;
    this.totalGeocodingSuccess += run.geocodingSuccessCount;
    this.totalGeocodingFailure += run.geocodingFailureCount;

    // Accumulate per-feed health stats
    for (const feed of run.feedDetails) {
      let stats = this.feedStatsMap.get(feed.feedName);
      if (!stats) {
        stats = {
          category: feed.category,
          totalChecks: 0,
          successes: 0,
          failures: 0,
          totalLatencyMs: 0,
        };
        this.feedStatsMap.set(feed.feedName, stats);
      }

      stats.totalChecks++;
      if (feed.status === 'SUCCESS') {
        stats.successes++;
      } else {
        stats.failures++;
      }
      stats.totalLatencyMs += feed.latencyMs;
      stats.lastChecked = run.endTime || new Date().toISOString();
      stats.lastStatus = feed.status;
    }
  }

  /**
   * Returns a comprehensive telemetry summary of crawler activity.
   */
  public getTelemetrySummary(): CrawlerTelemetrySummary {
    const totalGeo = this.totalGeocodingSuccess + this.totalGeocodingFailure;
    const overallGeocodingSuccessRate = totalGeo > 0
      ? Number(((this.totalGeocodingSuccess / totalGeo) * 100).toFixed(2))
      : 0;

    const feedHealth: Record<string, FeedHealthSummary> = {};
    for (const [name, stats] of this.feedStatsMap.entries()) {
      feedHealth[name] = {
        feedName: name,
        category: stats.category,
        totalChecks: stats.totalChecks,
        successes: stats.successes,
        failures: stats.failures,
        successRate: stats.totalChecks > 0
          ? Number(((stats.successes / stats.totalChecks) * 100).toFixed(2))
          : 0,
        avgLatencyMs: stats.totalChecks > 0
          ? Math.round(stats.totalLatencyMs / stats.totalChecks)
          : 0,
        lastChecked: stats.lastChecked,
        lastStatus: stats.lastStatus,
      };
    }

    return {
      totalRuns: this.totalRuns,
      lastRun: this.runs[0],
      totalArticlesDiscovered: this.totalArticlesDiscovered,
      totalDuplicateRejections: this.totalDuplicateRejections,
      totalNewIncidentsCreated: this.totalNewIncidentsCreated,
      totalGeocodingSuccess: this.totalGeocodingSuccess,
      totalGeocodingFailure: this.totalGeocodingFailure,
      overallGeocodingSuccessRate,
      feedHealth,
      recentRuns: [...this.runs],
    };
  }

  /**
   * Returns recent runs up to limit.
   */
  public getRecentRuns(limit: number = 10): CrawlRunMetric[] {
    return this.runs.slice(0, limit);
  }

  /**
   * Resets all metrics (primarily for test isolation).
   */
  public resetMetricsForTesting() {
    this.runs = [];
    this.totalRuns = 0;
    this.totalArticlesDiscovered = 0;
    this.totalDuplicateRejections = 0;
    this.totalNewIncidentsCreated = 0;
    this.totalGeocodingSuccess = 0;
    this.totalGeocodingFailure = 0;
    this.feedStatsMap.clear();
  }
}

/**
 * Standalone converter from CrawlRunMetric to CrawlerRunTelemetry conforming to Interface Contract #4.
 */
export const toCrawlerRunTelemetry = (metric: CrawlRunMetric): CrawlerRunTelemetry => {
  const startedAt = metric.startedAt || new Date(metric.startTime);
  const completedAt = metric.completedAt || (metric.endTime ? new Date(metric.endTime) : new Date());
  return {
    crawlRunId: metric.crawlRunId || crypto.randomUUID(),
    startedAt,
    completedAt,
    durationMs: metric.durationMs,
    feedsProcessed: metric.feedsChecked,
    feedsFailed: metric.feedsFailed,
    totalArticlesDiscovered: metric.articlesDiscovered,
    foreignArticlesFiltered: metric.foreignArticlesFiltered || 0,
    disqualifiedNonIncidents: metric.disqualifiedNonIncidents || 0,
    stagedUnderReview: metric.stagedUnderReview || 0,
    duplicatesConsolidated: metric.duplicatesConsolidated || metric.duplicateRejections,
    newIncidentsCreated: metric.newIncidentsCreated,
    errorSummaries: metric.errorSummaries || [],
  };
};

/**
 * Helper class to record metrics during a single crawl run.
 */
export class CrawlRunRecorder {
  private startTimeMs: number;
  private foreignArticlesFiltered = 0;
  private disqualifiedNonIncidents = 0;
  private stagedUnderReview = 0;
  private duplicatesConsolidated = 0;
  private errorSummaries: Array<{ feedUrl: string; error: string; isTimeout: boolean }> = [];
  private completedDate?: Date;

  constructor(
    private service: NewsObservabilityService,
    public readonly run: CrawlRunMetric,
    public readonly crawlRunId: string = run.crawlRunId || crypto.randomUUID(),
    public readonly startDate: Date = run.startedAt || new Date()
  ) {
    this.startTimeMs = this.startDate.getTime();
  }

  public recordFeedExecution(feedMetric: FeedExecutionMetric) {
    this.run.feedsChecked++;
    if (feedMetric.status === 'SUCCESS') {
      this.run.feedsSuccess++;
    } else {
      this.run.feedsFailed++;
      const isTimeout = feedMetric.status === 'TIMEOUT';
      this.recordErrorSummary({
        feedUrl: feedMetric.url,
        error: feedMetric.errorMessage || `Feed fetch ${feedMetric.status.toLowerCase()}`,
        isTimeout,
      });
    }
    this.run.feedDetails.push(feedMetric);
  }

  public recordDiscoveredArticles(count: number = 1) {
    this.run.articlesDiscovered += count;
  }

  public recordForeignArticleFiltered(count: number = 1) {
    this.foreignArticlesFiltered += count;
    this.run.foreignArticlesFiltered = this.foreignArticlesFiltered;
  }

  public recordDisqualifiedNonIncident(count: number = 1) {
    this.disqualifiedNonIncidents += count;
    this.run.disqualifiedNonIncidents = this.disqualifiedNonIncidents;
  }

  public recordStagedUnderReview(count: number = 1) {
    this.stagedUnderReview += count;
    this.run.stagedUnderReview = this.stagedUnderReview;
  }

  public recordDuplicateConsolidated(count: number = 1) {
    this.duplicatesConsolidated += count;
    this.run.duplicatesConsolidated = this.duplicatesConsolidated;
    this.run.duplicateRejections += count;
  }

  public recordDuplicateRejection(count: number = 1) {
    this.run.duplicateRejections += count;
    this.duplicatesConsolidated += count;
    this.run.duplicatesConsolidated = this.duplicatesConsolidated;
  }

  public recordNewIncident(count: number = 1) {
    this.run.newIncidentsCreated += count;
  }

  public recordGeocodingSuccess(count: number = 1) {
    this.run.geocodingSuccessCount += count;
  }

  public recordGeocodingFailure(count: number = 1) {
    this.run.geocodingFailureCount += count;
  }

  public recordVerifiedMatches(count: number = 1) {
    this.run.verifiedMatchesCount += count;
  }

  public recordErrorSummary(summary: { feedUrl: string; error: string; isTimeout: boolean }) {
    const existing = this.errorSummaries.find(
      (e) => e.feedUrl === summary.feedUrl && e.error === summary.error
    );
    if (!existing) {
      this.errorSummaries.push(summary);
      this.run.errorSummaries = this.errorSummaries;
    }
  }

  public toTelemetry(): CrawlerRunTelemetry {
    const completedAt = this.completedDate || new Date();
    const durationMs = this.run.durationMs || Math.max(0, completedAt.getTime() - this.startDate.getTime());
    return {
      crawlRunId: this.crawlRunId,
      startedAt: this.startDate,
      completedAt,
      durationMs,
      feedsProcessed: this.run.feedsChecked,
      feedsFailed: this.run.feedsFailed,
      totalArticlesDiscovered: this.run.articlesDiscovered,
      foreignArticlesFiltered: this.foreignArticlesFiltered,
      disqualifiedNonIncidents: this.disqualifiedNonIncidents,
      stagedUnderReview: this.stagedUnderReview,
      duplicatesConsolidated: this.duplicatesConsolidated,
      newIncidentsCreated: this.run.newIncidentsCreated,
      errorSummaries: [...this.errorSummaries],
    };
  }

  public complete(statusOverride?: 'SUCCESS' | 'PARTIAL' | 'FAILED'): CrawlRunMetric {
    this.completedDate = new Date();
    this.run.completedAt = this.completedDate;
    this.run.endTime = this.completedDate.toISOString();
    this.run.durationMs = Date.now() - this.startTimeMs;
    this.run.foreignArticlesFiltered = this.foreignArticlesFiltered;
    this.run.disqualifiedNonIncidents = this.disqualifiedNonIncidents;
    this.run.stagedUnderReview = this.stagedUnderReview;
    this.run.duplicatesConsolidated = this.duplicatesConsolidated;
    this.run.errorSummaries = [...this.errorSummaries];

    if (statusOverride) {
      this.run.status = statusOverride;
    } else if (this.run.feedsFailed === 0 && this.run.feedsSuccess > 0) {
      this.run.status = 'SUCCESS';
    } else if (this.run.feedsSuccess > 0 && this.run.feedsFailed > 0) {
      this.run.status = 'PARTIAL';
    } else {
      this.run.status = 'FAILED';
    }

    this.service.recordRunCompletion(this.run);
    return this.run;
  }
}

export const newsObservabilityService = new NewsObservabilityService();
