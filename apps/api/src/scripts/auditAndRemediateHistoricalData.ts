import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma as defaultPrisma } from '../db/prisma';
import { classifyNewsText } from '../services/newsClassifierService';
import { evaluateActiveThreatEligibility } from '../services/activeThreatEligibilityService';
import { isForeignIncident } from '../services/internationalIncidentFilter';
import { GeocodeResult } from '../services/geocodingService';
import { ReportStatus, ThreatStatus } from '@prisma/client';

export interface AuditRecordSummary {
  reportId: string;
  sourceType: 'NEWS' | 'CITIZEN';
  headline: string;
  district: string | null;
  currentThreatStatus: ThreatStatus | null;
  currentStatus: ReportStatus;
  proposedThreatStatus: ThreatStatus;
  proposedStatus: ReportStatus;
  newThreatStatus: ThreatStatus;
  newStatus: ReportStatus;
  action: 'PRESERVE_ACTIVE' | 'REMEDIATE_TO_RESOLVED';
  outcome: string;
  reason: string;
  shouldUpdate: boolean;
  isEligible: boolean;
}

export interface AuditLogEntry {
  reportId: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
  appliedAt: Date;
}

export interface AuditSummaryResult {
  totalInspected: number;
  totalActiveEligible: number;
  totalRemediated: number;
  breakdown: Record<string, number>;
  records: AuditRecordSummary[];
  auditTrail: AuditLogEntry[];
}

/**
 * Discriminates between machine-crawled news incidents and citizen-submitted eyewitness reports.
 * A citizen report has neither sourceUrl nor sourceName, and no linked news articles.
 */
export function isCitizenReport(report: {
  sourceUrl?: string | null;
  sourceName?: string | null;
  newsArticles?: any[];
}): boolean {
  return !report.sourceUrl && !report.sourceName && (!report.newsArticles || report.newsArticles.length === 0);
}

/**
 * Safe, non-destructive audit and remediation routine.
 * Defaults to dry-run mode (applyUpdates = false), requiring an explicit true flag (or --apply CLI) to mutate records.
 *
 * Citizen reports are strictly identified and protected:
 * - outcome = 'CITIZEN_PRESERVED'
 * - shouldUpdate = false (never mutated)
 * - currentStatus and currentThreatStatus preserved intact
 * - Never altered by news classifiers or geocoding re-resolution
 */
export async function auditHistoricalData(
  applyUpdates: boolean = false,
  customPrismaClient?: any
): Promise<AuditSummaryResult> {
  const dbClient = customPrismaClient || defaultPrisma;
  const reports = await dbClient.report.findMany({
    include: {
      newsArticles: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const records: AuditRecordSummary[] = [];
  const auditTrail: AuditLogEntry[] = [];
  const breakdown: Record<string, number> = {
    ACTIVE_QUALIFYING_THREAT: 0,
    FOLLOW_UP_NEWS_ONLY: 0,
    RESOLVED_INCIDENT: 0,
    HISTORICAL_INCIDENT: 0,
    NON_INCIDENT_NEWS: 0,
    LOCATION_UNRESOLVED: 0,
    FOREIGN_MISLOCATED: 0,
    EXPIRED_THREAT: 0,
    CITIZEN_PRESERVED: 0,
  };

  let totalActiveEligible = 0;
  let totalRemediated = 0;

  for (const rep of reports) {
    const isCitizen = isCitizenReport(rep);
    const primaryArticle = rep.newsArticles && rep.newsArticles.length > 0 ? rep.newsArticles[0] : undefined;
    const headline = primaryArticle?.title || rep.description || 'No description';
    const pubDate = primaryArticle?.publishedAt || rep.createdAt;

    // Strict Citizen Report Protection Invariant
    if (isCitizen) {
      breakdown.CITIZEN_PRESERVED = (breakdown.CITIZEN_PRESERVED || 0) + 1;
      const isEligible = rep.status === ReportStatus.ACTIVE || (rep.status as string) === 'ACTIVE';
      if (isEligible) {
        totalActiveEligible++;
      }

      records.push({
        reportId: rep.id,
        sourceType: 'CITIZEN',
        headline: headline.slice(0, 80),
        district: rep.district,
        currentThreatStatus: rep.threatStatus,
        currentStatus: rep.status,
        proposedThreatStatus: rep.threatStatus ?? ThreatStatus.ACTIVE,
        proposedStatus: rep.status,
        newThreatStatus: rep.threatStatus ?? ThreatStatus.ACTIVE,
        newStatus: rep.status,
        action: 'PRESERVE_ACTIVE',
        outcome: 'CITIZEN_PRESERVED',
        reason: 'Citizen user-submitted report strictly preserved without modification',
        shouldUpdate: false,
        isEligible,
      });
      continue;
    }

    // Machine-ingested news incident processing
    // 1. Check international foreign filter first
    const foreignCheck = isForeignIncident(headline, rep.description || '');
    if (foreignCheck.isForeign) {
      breakdown.FOREIGN_MISLOCATED = (breakdown.FOREIGN_MISLOCATED || 0) + 1;
      const targetThreatStatus = ThreatStatus.RESOLVED;
      const targetStatus = ReportStatus.RESOLVED;
      const shouldUpdate =
        rep.threatStatus !== targetThreatStatus ||
        rep.status !== targetStatus;

      records.push({
        reportId: rep.id,
        sourceType: 'NEWS',
        headline: headline.slice(0, 80),
        district: rep.district,
        currentThreatStatus: rep.threatStatus,
        currentStatus: rep.status,
        proposedThreatStatus: targetThreatStatus,
        proposedStatus: targetStatus,
        newThreatStatus: targetThreatStatus,
        newStatus: targetStatus,
        action: 'REMEDIATE_TO_RESOLVED',
        outcome: 'FOREIGN_MISLOCATED',
        reason: `International incident outside Bangladesh (${foreignCheck.matchedTerm || 'foreign'})`,
        shouldUpdate,
        isEligible: false,
      });
      continue;
    }

    // 2. Classify news text
    const classification = classifyNewsText(headline, rep.description || '');

    // 3. Build geocode provenance
    const geocode: GeocodeResult | null = rep.district
      ? {
          locationName: rep.upazila ? `${rep.upazila}, ${rep.district}` : rep.district,
          district: rep.district,
          upazila: rep.upazila || undefined,
          locationPrecision: (rep.locationPrecision as 'EXACT' | 'UPAZILA' | 'DISTRICT') || 'DISTRICT',
          latitude: rep.latitude,
          longitude: rep.longitude,
          source: 'DICTIONARY',
        }
      : null;

    // 4. Evaluate active threat eligibility
    const eligibility = evaluateActiveThreatEligibility(
      {
        title: headline,
        summary: rep.description || undefined,
        category: classification.category || rep.category,
        severity: rep.severity,
        isSafetyRelated: classification.isSafetyRelated,
        disqualifiedReason: classification.disqualifiedReason,
        geocode,
        publishedAt: pubDate,
        sourceUrl: rep.sourceUrl || undefined,
        sourceName: rep.sourceName || undefined,
      },
      now
    );

    const isExpired = Boolean(rep.expiresAt && new Date(rep.expiresAt).getTime() <= now.getTime());
    let finalOutcome = eligibility.conceptualOutcome as string;
    if (eligibility.isEligibleForActiveMap && isExpired) {
      finalOutcome = 'EXPIRED_THREAT';
    }

    breakdown[finalOutcome] = (breakdown[finalOutcome] || 0) + 1;

    let targetThreatStatus: ThreatStatus;
    let targetStatus: ReportStatus;

    if (eligibility.isEligibleForActiveMap && !isExpired) {
      targetThreatStatus = ThreatStatus.ACTIVE;
      targetStatus = ReportStatus.ACTIVE;
      totalActiveEligible++;
    } else {
      targetThreatStatus = ThreatStatus.RESOLVED;
      targetStatus = ReportStatus.RESOLVED;
    }

    const shouldUpdate =
      rep.threatStatus !== targetThreatStatus ||
      rep.status !== targetStatus;

    records.push({
      reportId: rep.id,
      sourceType: 'NEWS',
      headline: headline.slice(0, 80),
      district: rep.district,
      currentThreatStatus: rep.threatStatus,
      currentStatus: rep.status,
      proposedThreatStatus: targetThreatStatus,
      proposedStatus: targetStatus,
      newThreatStatus: targetThreatStatus,
      newStatus: targetStatus,
      action: (targetStatus === ReportStatus.RESOLVED) ? 'REMEDIATE_TO_RESOLVED' : 'PRESERVE_ACTIVE',
      outcome: finalOutcome,
      reason: eligibility.reason,
      shouldUpdate,
      isEligible: eligibility.isEligibleForActiveMap && !isExpired,
    });
  }

  // Database mutation phase (only when applyUpdates === true)
  if (applyUpdates) {
    for (const rec of records) {
      if (rec.shouldUpdate) {
        await dbClient.report.update({
          where: { id: rec.reportId },
          data: {
            threatStatus: rec.newThreatStatus,
            status: rec.newStatus,
            // If retiring from map, expire immediately so spatial query NOW() constraint also drops it
            ...(rec.newThreatStatus === ThreatStatus.RESOLVED && {
              expiresAt: new Date(Math.min(now.getTime(), new Date(repExpiresAt(rec.reportId, reports)).getTime())),
            }),
          },
        });
        totalRemediated++;

        auditTrail.push({
          reportId: rec.reportId,
          previousStatus: rec.currentStatus,
          newStatus: rec.newStatus,
          reason: rec.reason,
          appliedAt: new Date(),
        });
      }
    }
  } else {
    // In dry-run mode, record proposed transitions into auditTrail for inspection
    for (const rec of records) {
      if (rec.shouldUpdate) {
        auditTrail.push({
          reportId: rec.reportId,
          previousStatus: rec.currentStatus,
          newStatus: rec.newStatus,
          reason: rec.reason,
          appliedAt: now,
        });
      }
    }
  }

  return {
    totalInspected: reports.length,
    totalActiveEligible,
    totalRemediated,
    breakdown,
    records,
    auditTrail,
  };
}

/**
 * Backward compatibility alias for existing callers.
 */
export const auditAllReports = auditHistoricalData;

function repExpiresAt(id: string, reports: any[]): Date {
  const r = reports.find((x) => x.id === id);
  return r && r.expiresAt ? new Date(r.expiresAt) : new Date();
}

export async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log('='.repeat(80));
  console.log(`DANGER ZONE BD - DATABASE HISTORICAL AUDIT & REMEDIATION (${apply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log('='.repeat(80));

  if (!process.env.DATABASE_URL) {
    console.log('\n[NOTICE] DATABASE_URL is not configured in the environment.');
    console.log('To run audit and remediation against a live database, configure DATABASE_URL in .env.');
    return;
  }

  const result = await auditHistoricalData(apply);

  console.log(`\nTotal Reports Inspected: ${result.totalInspected}`);
  console.log(`Genuinely Active & Eligible Threats: ${result.totalActiveEligible}`);
  console.log(`Reports Requiring Status Remediation: ${result.records.filter((r) => r.shouldUpdate).length}`);
  if (apply) {
    console.log(`Reports Successfully Remediated in DB: ${result.totalRemediated}`);
  }

  console.log('\n--- Breakdown by Audit Outcome ---');
  for (const [outcome, count] of Object.entries(result.breakdown)) {
    console.log(`  ${outcome.padEnd(28)}: ${count}`);
  }

  console.log('\n--- Sample Records (First 15) ---');
  for (const rec of result.records.slice(0, 15)) {
    const flag = rec.isEligible ? ' [ACTIVE PIN] ' : ' [REMEDIATED] ';
    console.log(`${flag} [${rec.outcome}] ${rec.headline} (${rec.district || 'No District'}) -> threatStatus: ${rec.newThreatStatus}`);
  }

  // Specifically check Example A and Example B
  const exampleA = result.records.find((r) => r.reportId === '46124925-ce88-40cc-9546-4f6937dc50f2');
  const exampleB = result.records.find((r) => r.reportId === '329c3760-407a-46f0-9380-e0308c762d38');

  console.log('\n--- Critical Incident Verification ---');
  if (exampleA) {
    console.log(`Example A (Feni Khaleda Zia convoy case arrest):`);
    console.log(`  Outcome: ${exampleA.outcome}`);
    console.log(`  Reason: ${exampleA.reason}`);
    console.log(`  New threatStatus: ${exampleA.newThreatStatus} | New status: ${exampleA.newStatus}`);
    console.log(`  Active Map Eligible: ${exampleA.isEligible}`);
  }
  if (exampleB) {
    console.log(`Example B (Rajshahi University student standoff):`);
    console.log(`  Outcome: ${exampleB.outcome}`);
    console.log(`  Reason: ${exampleB.reason}`);
    console.log(`  New threatStatus: ${exampleB.newThreatStatus} | New status: ${exampleB.newStatus}`);
    console.log(`  Active Map Eligible: ${exampleB.isEligible}`);
  }

  await defaultPrisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
}
