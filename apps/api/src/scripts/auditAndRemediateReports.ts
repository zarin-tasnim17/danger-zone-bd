import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../db/prisma';
import { classifyNewsText } from '../services/newsClassifierService';
import { extractIncidentTemporalData } from '../services/temporalExtractionService';
import { evaluateActiveThreatEligibility } from '../services/activeThreatEligibilityService';
import { isForeignIncident } from '../services/internationalIncidentFilter';
import { GeocodeResult } from '../services/geocodingService';
import { ReportStatus, ThreatStatus, LocationPrecision } from '@prisma/client';

export interface AuditRecordSummary {
  reportId: string;
  sourceType: 'NEWS' | 'CITIZEN';
  headline: string;
  district: string | null;
  currentThreatStatus: ThreatStatus | null;
  currentStatus: ReportStatus;
  newThreatStatus: ThreatStatus;
  newStatus: ReportStatus;
  outcome: string;
  reason: string;
  shouldUpdate: boolean;
  isEligible: boolean;
}

export async function auditAllReports(applyUpdates: boolean = false): Promise<{
  totalInspected: number;
  totalActiveEligible: number;
  totalRemediated: number;
  breakdown: Record<string, number>;
  records: AuditRecordSummary[];
}> {
  const reports = await prisma.report.findMany({
    include: {
      newsArticles: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const records: AuditRecordSummary[] = [];
  const breakdown: Record<string, number> = {
    ACTIVE_QUALIFYING_THREAT: 0,
    FOLLOW_UP_NEWS_ONLY: 0,
    RESOLVED_INCIDENT: 0,
    HISTORICAL_INCIDENT: 0,
    NON_INCIDENT_NEWS: 0,
    LOCATION_UNRESOLVED: 0,
    FOREIGN_MISLOCATED: 0,
    EXPIRED_THREAT: 0,
  };

  let totalActiveEligible = 0;
  let totalRemediated = 0;

  for (const rep of reports) {
    const isNews = Boolean(rep.newsArticles.length > 0 || rep.sourceUrl || rep.sourceName);
    const primaryArticle = rep.newsArticles[0];
    const headline = primaryArticle?.title || rep.description || 'No description';
    const pubDate = primaryArticle?.publishedAt || rep.createdAt;

    // Check international filter first
    const foreignCheck = isForeignIncident(headline, rep.description || '');
    if (foreignCheck.isForeign) {
      breakdown.FOREIGN_MISLOCATED++;
      const shouldUpdate = rep.threatStatus !== 'RESOLVED' || rep.status !== 'RESOLVED';
      records.push({
        reportId: rep.id,
        sourceType: isNews ? 'NEWS' : 'CITIZEN',
        headline: headline.slice(0, 80),
        district: rep.district,
        currentThreatStatus: rep.threatStatus,
        currentStatus: rep.status,
        newThreatStatus: ThreatStatus.RESOLVED,
        newStatus: ReportStatus.RESOLVED,
        outcome: 'FOREIGN_MISLOCATED',
        reason: `International incident outside Bangladesh (${foreignCheck.matchedTerm || 'foreign'})`,
        shouldUpdate,
        isEligible: false,
      });
      continue;
    }

    // Classify text
    const classification = classifyNewsText(headline, rep.description || '');

    // Build geocode
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

    const isExpired = rep.expiresAt < now;
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
      sourceType: isNews ? 'NEWS' : 'CITIZEN',
      headline: headline.slice(0, 80),
      district: rep.district,
      currentThreatStatus: rep.threatStatus,
      currentStatus: rep.status,
      newThreatStatus: targetThreatStatus,
      newStatus: targetStatus,
      outcome: finalOutcome,
      reason: eligibility.reason,
      shouldUpdate,
      isEligible: eligibility.isEligibleForActiveMap && !isExpired,
    });
  }

  if (applyUpdates) {
    for (const rec of records) {
      if (rec.shouldUpdate) {
        await prisma.report.update({
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
      }
    }
  }

  return {
    totalInspected: reports.length,
    totalActiveEligible,
    totalRemediated,
    breakdown,
    records,
  };
}

function repExpiresAt(id: string, reports: any[]): Date {
  const r = reports.find((x) => x.id === id);
  return r ? r.expiresAt : new Date();
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log('='.repeat(80));
  console.log(`DANGER ZONE BD - DATABASE INCIDENT AUDIT & REMEDIATION (${apply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log('='.repeat(80));

  const result = await auditAllReports(apply);

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

  console.log('\n--- Critical Screenshot Verification ---');
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

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
}
