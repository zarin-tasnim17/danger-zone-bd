import { ReportCategory } from '@prisma/client';

export interface FeedExecutionMetric {
  feedName: string;
  category: ReportCategory;
  url: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  latencyMs: number;
  itemsFetched: number;
  errorMessage?: string;
}

export interface CrawlRunMetric {
  runId: string;
  startTime: string;
  endTime?: string;
  durationMs: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'IN_PROGRESS';
  feedsChecked: number;
  feedsSuccess: number;
  feedsFailed: number;
  articlesDiscovered: number;
  duplicateRejections: number;
  newIncidentsCreated: number;
  geocodingSuccessCount: number;
  geocodingFailureCount: number;
  verifiedMatchesCount: number;
  feedDetails: FeedExecutionMetric[];
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
    const id = runId || `crawl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startIso = new Date().toISOString();

    const currentRun: CrawlRunMetric = {
      runId: id,
      startTime: startIso,
      durationMs: 0,
      status: 'IN_PROGRESS',
      feedsChecked: 0,
      feedsSuccess: 0,
      feedsFailed: 0,
      articlesDiscovered: 0,
      duplicateRejections: 0,
      newIncidentsCreated: 0,
      geocodingSuccessCount: 0,
      geocodingFailureCount: 0,
      verifiedMatchesCount: 0,
      feedDetails: [],
    };

    this.runs.unshift(currentRun);
    if (this.runs.length > this.maxStoredRuns) {
      this.runs.pop();
    }
    this.totalRuns++;

    return new CrawlRunRecorder(this, currentRun);
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
 * Helper class to record metrics during a single crawl run.
 */
export class CrawlRunRecorder {
  private startTimeMs: number;

  constructor(
    private service: NewsObservabilityService,
    public readonly run: CrawlRunMetric
  ) {
    this.startTimeMs = Date.now();
  }

  public recordFeedExecution(feedMetric: FeedExecutionMetric) {
    this.run.feedsChecked++;
    if (feedMetric.status === 'SUCCESS') {
      this.run.feedsSuccess++;
    } else {
      this.run.feedsFailed++;
    }
    this.run.feedDetails.push(feedMetric);
  }

  public recordDiscoveredArticles(count: number = 1) {
    this.run.articlesDiscovered += count;
  }

  public recordDuplicateRejection(count: number = 1) {
    this.run.duplicateRejections += count;
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

  public complete(statusOverride?: 'SUCCESS' | 'PARTIAL' | 'FAILED'): CrawlRunMetric {
    this.run.endTime = new Date().toISOString();
    this.run.durationMs = Date.now() - this.startTimeMs;

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
