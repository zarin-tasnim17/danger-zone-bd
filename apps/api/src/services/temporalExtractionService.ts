/**
 * Danger Zone BD - Temporal Extraction Service
 * 
 * Accurately extracts real-world incident occurrence time, relative temporal context,
 * and distinguishes between:
 * 1. Article publication time (when the journalist hit publish)
 * 2. Actual physical incident time (when the event occurred on the ground)
 * 3. Historical vs current threats
 * 4. Case follow-ups vs fresh physical events
 */

export type TemporalCertainty =
  | 'EXPLICIT_TODAY'
  | 'EXPLICIT_YESTERDAY'
  | 'EXPLICIT_RELATIVE_DAYS'
  | 'EXPLICIT_HISTORICAL_YEAR'
  | 'CONTEXTUAL_HISTORICAL_CASE'
  | 'CONTEXTUAL_ARREST_FOLLOWUP'
  | 'CONTEXTUAL_RESOLVED_AFTERMATH'
  | 'UNKNOWN';

export type TimeOfDay = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export interface TemporalExtractionResult {
  hasExplicitTime: boolean;
  estimatedIncidentDate: Date | null;
  occurrenceDate?: string; // YYYY-MM-DD in Bangladesh local time (UTC+6)
  timeOfDay?: TimeOfDay;
  temporalCertainty: TemporalCertainty;
  isHistorical: boolean;
  isRecentOrToday: boolean;
  isResolvedOrAftermath: boolean;
  confidence: number;
  matchedExpressions: string[];
}

// Bangladesh Timezone: UTC+6
const BD_TIMEZONE_OFFSET_MS = 6 * 60 * 60 * 1000;

export function toBangladeshDateString(d: Date): string {
  const bdTime = new Date(d.getTime() + BD_TIMEZONE_OFFSET_MS);
  return bdTime.toISOString().slice(0, 10);
}

export function extractTimeOfDay(text: string): TimeOfDay | undefined {
  if (!text) return undefined;
  const norm = text.normalize('NFC').toLowerCase();

  // MORNING: সকাল, সকালে, ভোর, ভোরে, morning, dawn
  if (/(?:সকালে?|ভোরে?|\b(?:morning|dawn|early morning)\b)/u.test(norm)) {
    return 'MORNING';
  }
  // AFTERNOON: দুপুর, দুপুরে, midday, noon, afternoon
  if (/(?:দুপুরে?|\b(?:afternoon|midday|noon)\b)/u.test(norm)) {
    return 'AFTERNOON';
  }
  // EVENING: বিকাল, বিকালে, বিকেল, বিকেলে, সন্ধ্যা, সন্ধ্যায়, evening, dusk
  if (/(?:বিক[লে]ে?|সন্ধ্যা(?:য়|য়)?|\b(?:evening|dusk|late afternoon)\b)/u.test(norm)) {
    return 'EVENING';
  }
  // NIGHT: রাত, রাতে, মধ্যরাত, গভীর রাতে, গত রাতে, night, midnight, tonight, last night
  if (/(?:রাতে?|মধ্যরাতে?|গভীর\s*রাতে?|\b(?:night|midnight|tonight|last\s+night)\b)/u.test(norm)) {
    return 'NIGHT';
  }

  return undefined;
}

const HISTORICAL_YEAR_PATTERNS = [
  // 1971 liberation war or retrospective years (1971 to 2024)
  /(?:১৯৭১|২০০[০-৯]|২০১[০-৯]|২০২[০-৪])\s*সালের/u,
  /(?:১৯৭১|২০০[০-৯]|২০১[০-৯]|২০২[০-৪])\s*সালে/u,
  /\b(?:in\s+)?(1971|200\d|201\d|202[0-4])\b/i,
  /(?:বছর\s*আগে|কয়েক\s*বছর\s*আগে|দশক\s*আগের|দশক\s*আগে|দশকের\s*আগে)/u,
  /\b(?:\d+\s+years?\s+ago|years\s+ago|decades?\s+ago|decades-old|years-old)\b/i,
];

const HISTORICAL_CASE_PATTERNS = [
  // When an attack/murder is mentioned only as the title or reference of a past case
  /(?:হামলা\s*মামলার|হত্যা\s*মামলার|খুন\s*মামলার|ডাকাতি\s*মামলার|নাশকতা\s*মামলার)/u,
  /(?:গাড়িবহরে\s*হামলা\s*মামলার|গাড়িবহরে\s*হামলা,\s*মামলার)/u,
  /(?:মামলার\s*পলাতক\s*আসামি|মামলার\s*আসামি|মামলার\s*চার্জশিট|মামলার\s*রায়)/u,
  /(?:পুরোনো\s*মামলায়|পুরনো\s*মামলায়|পুরোনো\s*ঘটনার|আগের\s*মামলায়|আগের\s*ঘটনার)/u,
  /\b(?:case\s+filed\s+over\s+past|accused\s+in(?:\s+the)?\s+\w+\s+case|fugitive\s+accused)\b/i,
];

const ARREST_FOLLOWUP_PATTERNS = [
  // Stories reporting the arrest/capture of suspects in past crimes without new violence
  /(?:পলাতক\s*আসামি\s*গ্রেফতার|পলাতক\s*আসামি\s*গ্রেপ্তার|পলাতক\s*আসামি\s*আটক)/u,
  /(?:মামলার\s*আসামি\s*গ্রেফতার|মামলার\s*আসামি\s*গ্রেপ্তার|মামলার\s*আসামি\s*আটক)/u,
  /(?:আসামি\s*গ্রেফতার|আসামি\s*গ্রেপ্তার|আসামি\s*আটক|পলাতক\s*আসামি\s*ধরা)/u,
  /(?:গ্রেফতার\s*হয়েছেন|গ্রেপ্তার\s*হয়েছেন|আটক\s*হয়েছেন|র‌্যাব\s*গ্রেফতার|পুলিশ\s*গ্রেফতার)/u,
  /\b(?:fugitive\s+(?:arrested|nabbed|held|detained)|accused\s+arrested\s+in|suspect\s+arrested\s+in)\b/i,
];

const RESOLVED_AFTERMATH_PATTERNS = [
  /(?:৪\s*ঘণ্টা\s*অবরুদ্ধ|ঘণ্টা\s*অবরুদ্ধ|অবরুদ্ধ\s*মুক্ত|পরিস্থিতি\s*শান্ত|পরিস্থিতি\s*স্বাভাবিক)/u,
  /(?:পরিস্থিতি\s*নিয়ন্ত্রণে|প্রভোস্টের\s*হস্তক্ষেপে\s*শান্ত|পুলিশের\s*হস্তক্ষেপে\s*শান্ত)/u,
  /(?:বিক্ষোভ\s*প্রত্যাহার|অবরোধ\s*প্রত্যাহার|যান\s*চলাচল\s*স্বাভাবিক|যানবাহন\s*চলাচল\s*স্বাভাবিক)/u,
  /(?:মীমাংসা\s*হয়েছে|মিমাংসা\s*হয়েছে|দাফন\s*সম্পন্ন|জানাজা\s*সম্পন্ন)/u,
  /\b(?:situation\s+(?:calmed|under\s+control|normalized)|blockade\s+lifted|protest\s+withdrawn)\b/i,
];

const TODAY_PATTERNS = [
  /(?:^|[\s,।–—])(আজ|আজকে|আজকের|আজ\s*সকালে|আজ\s*ভোরে|আজ\s*দুপুরে|আজ\s*বিকেলে|আজ\s*সন্ধ্যায়|আজ\s*রাতে|আজ\s*গভীর\s*রাতে)(?:$|[\s,।–—])/u,
  /(?:কয়েক\s*ঘণ্টা\s*আগে|[\d০-৯]+\s*ঘণ্টা\s*আগে)/u,
  /\b(?:today|this\s+morning|this\s+afternoon|this\s+evening|earlier\s+today|tonight|\d+\s+hours?\s+ago|hours\s+ago)\b/i,
];

const YESTERDAY_PATTERNS = [
  /(?:^|[\s,।–—])(গতকাল|গতকালকে|গতকালের|গতকাল\s*সকালে|গতকাল\s*ভোরে|গতকাল\s*দুপুরে|গতকাল\s*বিকেলে|গতকাল\s*সন্ধ্যায়|গতকাল\s*রাতে|গত\s*রাতে)(?:$|[\s,।–—])/u,
  /\b(?:yesterday|last\s+night|yesterday\s+morning|yesterday\s+afternoon|yesterday\s+evening)\b/i,
];

const RELATIVE_DAYS_PATTERNS = [
  /(?:গত\s*পরশু|পরশু\s*দিন)/u,
  /(?:([\d০-৯]+|দুই|তিন|চার|পাঁচ|ছয়|সাত)\s*দিন\s*আগে|কয়েক\s*দিন\s*আগে|গত\s*সপ্তাহে|গত\s*মাসে)/u,
  /\b(?:(\d+)\s+days?\s+ago|several\s+days\s+ago|last\s+week|earlier\s+this\s+week)\b/i,
];

/**
 * Extracts temporal occurrence evidence from headline and summary text.
 */
export function extractIncidentTemporalData(
  title: string,
  summary: string = '',
  publishedAt: Date = new Date()
): TemporalExtractionResult {
  const combined = `${title} ${summary}`.normalize('NFC');
  const matchedExpressions: string[] = [];
  const timeOfDay = extractTimeOfDay(combined);

  // 1. Check Historical Years & References (Decades-old, 1971, 2017, etc.)
  for (const pat of HISTORICAL_YEAR_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      return {
        hasExplicitTime: true,
        estimatedIncidentDate: new Date('2020-01-01T00:00:00.000Z'), // Explicitly historical
        occurrenceDate: '2020-01-01',
        timeOfDay,
        temporalCertainty: 'EXPLICIT_HISTORICAL_YEAR',
        isHistorical: true,
        isRecentOrToday: false,
        isResolvedOrAftermath: true,
        confidence: 0.95,
        matchedExpressions,
      };
    }
  }

  // 2. Check Case Mention / Past Crime Naming (e.g. "গাড়িবহরে হামলা মামলার পলাতক আসামি গ্রেফতার")
  for (const pat of HISTORICAL_CASE_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      return {
        hasExplicitTime: true,
        estimatedIncidentDate: null, // Underlying incident occurred long ago
        timeOfDay,
        temporalCertainty: 'CONTEXTUAL_HISTORICAL_CASE',
        isHistorical: true,
        isRecentOrToday: false,
        isResolvedOrAftermath: true,
        confidence: 0.92,
        matchedExpressions,
      };
    }
  }

  // 3. Check Arrest Follow-ups (Accused arrested in past crime, no new violence)
  for (const pat of ARREST_FOLLOWUP_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      return {
        hasExplicitTime: false,
        estimatedIncidentDate: null,
        timeOfDay,
        temporalCertainty: 'CONTEXTUAL_ARREST_FOLLOWUP',
        isHistorical: true,
        isRecentOrToday: false,
        isResolvedOrAftermath: true,
        confidence: 0.90,
        matchedExpressions,
      };
    }
  }

  // 4. Check Resolved Altercations / Aftermath (e.g. "৪ ঘণ্টা অবরুদ্ধ ছাত্রদল নেতারা", standoff ended)
  for (const pat of RESOLVED_AFTERMATH_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      return {
        hasExplicitTime: true,
        estimatedIncidentDate: publishedAt,
        occurrenceDate: toBangladeshDateString(publishedAt),
        timeOfDay,
        temporalCertainty: 'CONTEXTUAL_RESOLVED_AFTERMATH',
        isHistorical: false,
        isRecentOrToday: true,
        isResolvedOrAftermath: true,
        confidence: 0.88,
        matchedExpressions,
      };
    }
  }

  // 5. Check Explicit "Today" (আজ / today)
  for (const pat of TODAY_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      return {
        hasExplicitTime: true,
        estimatedIncidentDate: new Date(publishedAt.getTime()),
        occurrenceDate: toBangladeshDateString(publishedAt),
        timeOfDay,
        temporalCertainty: 'EXPLICIT_TODAY',
        isHistorical: false,
        isRecentOrToday: true,
        isResolvedOrAftermath: false,
        confidence: 0.95,
        matchedExpressions,
      };
    }
  }

  // 6. Check Explicit "Yesterday" / "Last Night" (গতকাল / গত রাতে / yesterday / last night)
  for (const pat of YESTERDAY_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      const estimated = new Date(publishedAt.getTime() - 24 * 60 * 60 * 1000);
      return {
        hasExplicitTime: true,
        estimatedIncidentDate: estimated,
        occurrenceDate: toBangladeshDateString(estimated),
        timeOfDay,
        temporalCertainty: 'EXPLICIT_YESTERDAY',
        isHistorical: false,
        isRecentOrToday: true,
        isResolvedOrAftermath: false,
        confidence: 0.90,
        matchedExpressions,
      };
    }
  }

  // 7. Check Relative Days Ago (কয়েক দিন আগে / ২ দিন আগে / last week)
  for (const pat of RELATIVE_DAYS_PATTERNS) {
    const match = combined.match(pat);
    if (match) {
      matchedExpressions.push(match[0]);
      let dayOffset = 3;
      if (/(\d+|দুই|তিন|চার|পাঁচ|ছয়|সাত)\s*দিন\s*আগে|\b(\d+)\s+days?\s+ago\b/u.test(combined)) {
        const daysMatch = combined.match(/(\d+|দুই|তিন|চার|পাঁচ|ছয়|সাত)\s*দিন\s*আগে|\b(\d+)\s+days?\s+ago\b/u);
        const rawVal = daysMatch?.[1] || daysMatch?.[2];
        const numWords: Record<string, number> = { 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'ছয়': 6, 'সাত': 7 };
        if (rawVal) {
          dayOffset = parseInt(rawVal, 10) || numWords[rawVal] || 3;
        }
      } else if (/(?:গত\s*পরশু|পরশু\s*দিন)/u.test(combined)) {
        dayOffset = 2;
      }
      const estimated = new Date(publishedAt.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      return {
        hasExplicitTime: true,
        estimatedIncidentDate: estimated,
        occurrenceDate: toBangladeshDateString(estimated),
        timeOfDay,
        temporalCertainty: 'EXPLICIT_RELATIVE_DAYS',
        isHistorical: true, // Events > 48h ago are past incidents
        isRecentOrToday: false,
        isResolvedOrAftermath: true,
        confidence: 0.85,
        matchedExpressions,
      };
    }
  }

  // 8. Default: Unknown explicit temporal marker
  // Preserve uncertainty. Do not fabricate an exact time or assume current without evidence.
  return {
    hasExplicitTime: false,
    estimatedIncidentDate: null,
    timeOfDay,
    temporalCertainty: 'UNKNOWN',
    isHistorical: false,
    isRecentOrToday: false,
    isResolvedOrAftermath: false,
    confidence: 0.50,
    matchedExpressions: [],
  };
}
