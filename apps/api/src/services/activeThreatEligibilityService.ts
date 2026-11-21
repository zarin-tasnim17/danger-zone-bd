import { ReportCategory, ReportSeverity, ThreatStatus, LocationPrecision } from '@prisma/client';
import { extractIncidentTemporalData, TemporalExtractionResult } from './temporalExtractionService';
import { GeocodeResult } from './geocodingService';
import { isForeignIncident } from './internationalIncidentFilter';

export interface EligibilityEvaluationInput {
  title: string;
  summary?: string;
  category: ReportCategory;
  severity: ReportSeverity;
  isSafetyRelated: boolean;
  disqualifiedReason?: string;
  geocode?: GeocodeResult | null;
  publishedAt?: Date;
  sourceUrl?: string;
  sourceName?: string;
  isWire?: boolean;
  confidence?: number;
  expiresAt?: Date | string | number;
}

export type ConceptualEligibilityOutcome =
  | 'ACTIVE_QUALIFYING_THREAT'
  | 'HISTORICAL_INCIDENT'
  | 'RESOLVED_INCIDENT'
  | 'FOLLOW_UP_NEWS_ONLY'
  | 'NON_INCIDENT_NEWS'
  | 'LOCATION_UNRESOLVED'
  | 'TEMPORARILY_UNDER_REVIEW'
  | 'REJECTED_AS_IRRELEVANT';

export interface ActiveThreatEligibilityResult {
  isEligibleForActiveMap: boolean;
  threatStatus: ThreatStatus;
  conceptualOutcome: ConceptualEligibilityOutcome;
  reason: string;
  temporalData: TemporalExtractionResult;
  effectiveLifespanHours: number;
  calculatedExpiry: Date;
}

/**
 * Returns category-specific threat persistence lifespan in hours.
 */
export function getCategoryActiveLifespanHours(category: ReportCategory): number {
  switch (category) {
    case 'ROAD_ACCIDENT':
      return 24; // Acute vehicle crash clears in 24 hours
    case 'ARMED_ASSAULT':
    case 'SNATCHING_ARMED_ASSAULT':
    case 'ROBBERY':
    case 'THEFT_ROBBERY':
    case 'DACOITY':
    case 'THEFT_DACOITY':
    case 'SNATCHING':
    case 'MUGGING':
    case 'THEFT':
    case 'EXTORTION':
      return 48; // Acute violent or property crime: 48 hours
    case 'YOUTH_GANG_ACTIVITY':
    case 'DRUG_RELATED_CRIME':
    case 'TEEN_GANG':
    case 'TEEN_GANG_ARMED_ASSAULT':
    case 'DRUG_ACTIVITY':
      return 168; // Localized syndicate or recurring gang activity: 7 days
    case 'UNLIT_ROAD':
      return 336; // Physical infrastructure road hazard: 14 days
    default:
      return 48;
  }
}

/**
 * Evaluates an article through the 6-stage active threat eligibility pipeline.
 */
export function evaluateActiveThreatEligibility(
  input: EligibilityEvaluationInput,
  now: Date = new Date()
): ActiveThreatEligibilityResult {
  const publishedAt = input.publishedAt || now;
  const temporal = extractIncidentTemporalData(input.title, input.summary, publishedAt);

  // DECISION 1 — Is this a qualifying physical safety incident?
  if (!input.isSafetyRelated) {
    let outcome: ConceptualEligibilityOutcome = 'NON_INCIDENT_NEWS';
    let reason = 'Article does not report an active physical safety hazard.';

    if (
      input.disqualifiedReason === 'ARREST_FOLLOWUP' ||
      input.disqualifiedReason === 'CASE_FILING_FOLLOWUP' ||
      input.disqualifiedReason === 'PROBE_COMMITTEE' ||
      input.disqualifiedReason === 'INTERROGATION_FOLLOWUP' ||
      input.disqualifiedReason === 'GENERAL_DIARY'
    ) {
      outcome = 'FOLLOW_UP_NEWS_ONLY';
      reason = 'Administrative/legal/arrest follow-up does not constitute a new physical danger.';
    } else if (input.disqualifiedReason === 'HISTORICAL_CASE_MENTION') {
      outcome = 'HISTORICAL_INCIDENT';
      reason = 'Article references a past criminal case or court proceeding.';
    } else if (
      input.disqualifiedReason === 'RESOLVED_ALTERCATION' ||
      input.disqualifiedReason === 'UNARMED_SCUFFLE'
    ) {
      outcome = 'RESOLVED_INCIDENT';
      reason = 'Altercation has concluded and presents no ongoing public danger.';
    } else if (input.disqualifiedReason === 'MOURNING_FOLLOWUP') {
      outcome = 'NON_INCIDENT_NEWS';
      reason = 'Mourning or burial ceremony follow-up.';
    } else if (input.disqualifiedReason === 'POLITICAL_STATEMENT') {
      outcome = 'NON_INCIDENT_NEWS';
      reason = 'Political speech, press conference, or ministerial reaction without active physical hazard.';
    } else if (input.disqualifiedReason === 'RETROSPECTIVE_SUMMARY') {
      outcome = 'HISTORICAL_INCIDENT';
      reason = 'Retrospective multi-day statistical crime review.';
    }

    return {
      isEligibleForActiveMap: false,
      threatStatus: 'RESOLVED',
      conceptualOutcome: outcome,
      reason,
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000), // Ineligible for active map
    };
  }

  // DECISION 2 — Did it actually occur in Bangladesh?
  const foreign = isForeignIncident(input.title, input.summary || '');
  if (foreign.isForeign) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'RESOLVED',
      conceptualOutcome: 'REJECTED_AS_IRRELEVANT',
      reason: `Overseas/expatriate incident outside Bangladesh (${foreign.matchedTerm || 'foreign'}).`,
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  // DECISION 3 — Is its incident location sufficiently established?
  if (!input.geocode) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'UNDER_REVIEW',
      conceptualOutcome: 'LOCATION_UNRESOLVED',
      reason: 'No domestic landmark or district could be resolved from text.',
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  if (input.geocode.locationPrecision === ('AMBIGUOUS' as LocationPrecision)) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'UNDER_REVIEW',
      conceptualOutcome: 'LOCATION_UNRESOLVED',
      reason: 'Incident location is ambiguous across multiple regions.',
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  // DECISION 4 — Is there sufficient source evidence?
  if (!input.sourceUrl) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'UNDER_REVIEW',
      conceptualOutcome: 'TEMPORARILY_UNDER_REVIEW',
      reason: 'Unverified anonymous report without external citation or source provenance.',
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  // DECISION 5 — Is it current, ongoing, imminent under category threat policy?
  if (temporal.isHistorical) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'RESOLVED',
      conceptualOutcome: 'HISTORICAL_INCIDENT',
      reason: `Incident occurred in the past (${temporal.temporalCertainty}) and is no longer an active threat.`,
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  if (temporal.isResolvedOrAftermath) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'RESOLVED',
      conceptualOutcome: 'RESOLVED_INCIDENT',
      reason: 'Incident has already concluded or de-escalated.',
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  // Calculate Category-Specific Expiration
  const lifespanHours = getCategoryActiveLifespanHours(input.category);
  const baseTime = temporal.estimatedIncidentDate || publishedAt;
  let candidateExpiry = new Date(baseTime.getTime() + lifespanHours * 60 * 60 * 1000);

  if (input.expiresAt !== undefined && input.expiresAt !== null) {
    const expiry = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
    if (!isNaN(expiry.getTime())) {
      candidateExpiry = expiry;
    }
  }

  // If incident occurred more than lifespanHours ago, it has already expired
  if (candidateExpiry.getTime() <= now.getTime()) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'RESOLVED',
      conceptualOutcome: 'RESOLVED_INCIDENT',
      reason: `Incident hazard has expired past its ${lifespanHours}-hour active lifespan.`,
      temporalData: temporal,
      effectiveLifespanHours: lifespanHours,
      calculatedExpiry: candidateExpiry,
    };
  }

  // DECISION 5.5 — Classification Uncertainty Staging (Pillar 1 / Feature 9)
  // Confidence < 0.70 stages incident to threatStatus: 'UNDER_REVIEW'
  let confidence: number;
  if (typeof input.confidence === 'number' && !isNaN(input.confidence)) {
    confidence = input.confidence;
  } else {
    confidence = 0.0;
  }

  if (confidence < 0.70) {
    return {
      isEligibleForActiveMap: false,
      threatStatus: 'UNDER_REVIEW',
      conceptualOutcome: 'TEMPORARILY_UNDER_REVIEW',
      reason: `Classification confidence (${confidence.toFixed(2)}) is below active threat threshold (0.70). Staged for review.`,
      temporalData: temporal,
      effectiveLifespanHours: 0,
      calculatedExpiry: new Date(now.getTime() - 1000),
    };
  }

  // DECISION 6 — Eligible for the active public map
  return {
    isEligibleForActiveMap: true,
    threatStatus: 'ACTIVE',
    conceptualOutcome: 'ACTIVE_QUALIFYING_THREAT',
    reason: `Qualifying current ${input.category} threat active until ${candidateExpiry.toISOString()}.`,
    temporalData: temporal,
    effectiveLifespanHours: lifespanHours,
    calculatedExpiry: candidateExpiry,
  };
}

export { isActiveThreatIncident, type ActiveThreatPredicateInput } from '@repo/shared';
