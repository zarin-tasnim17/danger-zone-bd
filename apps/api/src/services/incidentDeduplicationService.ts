import { prisma } from '../db/prisma';
import { Report, ReportCategory } from '@prisma/client';
import { LOCAL_LANDMARK_MAP, findLandmarkInText } from './geocodingService';

const BENGALI_STOPWORDS = new Set([
  'ও',
  'এবং',
  'বা',
  'এ',
  'এর',
  'কে',
  'তে',
  'হতে',
  'থেকে',
  'পর',
  'হয়ে',
  'হলে',
  'করে',
  'করা',
  'হয়েছে',
  'নিয়ে',
  'সঙ্গে',
  'সাথে',
  'জন',
  'হওয়ায়',
  'নিহতদের',
  'নিহতরা',
  'আহতরা',
  'জানিয়েছে',
  'জানান',
  'পুলিশ',
  'থানার',
  'উপজেলার',
  'এলাকায়',
  'ইন',
  'অন',
  'দ্য',
  'জাতীয়',
  'জাতীয়',
  'সংবাদ',
  'সংস্থা',
  'news',
  'the',
  'and',
  'with',
  'from',
  'near',
  'hospital',
  'police',
  'case',
  'tv',
  'com',
  'in',
  'at',
  'on',
  'of',
  'to',
  'for',
]);

const OUTLET_NAMES = [
  'jagonews24',
  'the daily star',
  'daily star',
  'দ্য ডেইলি স্টার বাংলা',
  'দ্য ডেইলি স্টার',
  'ডেইলি স্টার',
  'bangladesh times',
  'বাংলাদেশ টাইমস',
  'risingbd',
  'dhakapost',
  'ঢাকা পোস্ট',
  'dbcnews',
  'প্রথম আলো',
  'prothom alo',
  'বিডিনিউজ টোয়েন্টিফোর ডটকম',
  'বিডিনিউজ',
  'bdnews24',
  'বাংলাদেশ সংবাদ সংস্থা',
  'বাসস',
  'সমকাল',
  'কালের কণ্ঠ',
  'যুগান্তর',
  'ইত্তেফাক',
  'বাংলাদেশ প্রতিদিন',
  'ইনকিলাব',
  'মানবজমিন',
  'বণিক বার্তা',
  'বাংলানিউজ',
  'banglanews24',
  'সারাবাংলা',
  'বাংলা ট্রিবিউন',
  'bangla tribune',
  'সময় টিভি',
  'somoy tv',
  'যমুনা টিভি',
  'jamuna tv',
  'ডিবিসি নিউজ',
  'চ্যানেল ২৪',
  'channel 24',
  'ekattor tv',
  'google news',
];

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BENGALI_DIGITS[d] || d);
}

/**
 * Cross-lingual Concept Dictionary:
 * Bridges English and Bangla news headlines so identical incidents reported across
 * different languages (e.g. The Daily Star in English vs Jagonews24 in Bangla)
 * resolve to the exact same canonical tokens.
 */
const BILINGUAL_CONCEPT_MAP: Record<string, string> = {
  // Vehicles
  'ট্রাক': 'truck',
  'ট্রাকের': 'truck',
  'truck': 'truck',
  'trucks': 'truck',
  'লরি': 'truck',
  'লরির': 'truck',
  'lorry': 'truck',
  'ডাম্প': 'truck',
  'dump': 'truck',
  'পিকআপ': 'pickup',
  'পিকআপের': 'pickup',
  'পিকআপভ্যান': 'pickup',
  'pickup': 'pickup',
  'pickups': 'pickup',
  'বাস': 'bus',
  'বাসের': 'bus',
  'bus': 'bus',
  'buses': 'bus',
  'সিএনজি': 'cng',
  'সিএনজির': 'cng',
  'cng': 'cng',
  'অটোরিকশা': 'cng',
  'autorickshaw': 'cng',
  'মাইক্রোবাস': 'microbus',
  'microbus': 'microbus',
  'মোটরসাইকেল': 'motorcycle',
  'মোটরসাইকেলের': 'motorcycle',
  'motorcycle': 'motorcycle',
  'বাইক': 'motorcycle',
  'bike': 'motorcycle',
  'ভ্যান': 'van',
  'van': 'van',
  'গাড়ি': 'car',
  'গাড়ির': 'car',
  'গাড়ী': 'car',
  'car': 'car',
  'cars': 'car',
  'প্রাইভেটকার': 'car',
  'ট্রেন': 'train',
  'ট্রেনের': 'train',
  'train': 'train',

  // Collision & Crash
  'সংঘর্ষ': 'collision',
  'সংঘর্ষে': 'collision',
  'মুখোমুখি': 'collision',
  'collision': 'collision',
  'crash': 'collision',
  'crashes': 'collision',
  'ধাক্কা': 'collision',
  'ধাক্কায়': 'collision',
  'hit': 'collision',
  'দুর্ঘটনা': 'accident',
  'accident': 'accident',

  // Casualty & Harm
  'নিহত': 'killed',
  'প্রাণহানি': 'killed',
  'killed': 'killed',
  'kill': 'killed',
  'dead': 'killed',
  'dies': 'killed',
  'death': 'killed',
  'deaths': 'killed',
  'fatal': 'killed',
  'fatality': 'killed',
  'লাশ': 'killed',
  'মরদেহ': 'killed',
  'আহত': 'injured',
  'injured': 'injured',
  'injuries': 'injured',
  'hurt': 'injured',

  // Crimes & Violence
  'ডাকাতি': 'robbery',
  'ডাকাতির': 'robbery',
  'robbery': 'robbery',
  'dacoity': 'robbery',
  'লুণ্ঠন': 'robbery',
  'লুণ্ঠিত': 'robbery',
  'looted': 'robbery',
  'চুরি': 'theft',
  'theft': 'theft',
  'burglary': 'theft',
  'stolen': 'theft',
  'ছিনতাই': 'snatching',
  'ছিনতাইয়ের': 'snatching',
  'ছিনতাইকারী': 'snatching',
  'snatching': 'snatching',
  'mugging': 'snatching',
  'গ্রেপ্তার': 'arrest',
  'গ্রেফতার': 'arrest',
  'আটক': 'arrest',
  'arrest': 'arrest',
  'arrested': 'arrest',
  'held': 'arrest',
  'detained': 'arrest',
  'খুন': 'murder',
  'হত্যা': 'murder',
  'murder': 'murder',
  'কোপানো': 'stabbing',
  'কুপিয়ে': 'stabbing',
  'ছুরিকাঘাত': 'stabbing',
  'stabbed': 'stabbing',
  'stabbing': 'stabbing',
  'গুলি': 'gunfire',
  'গুলিবিদ্ধ': 'gunfire',
  'shot': 'gunfire',
  'gunfire': 'gunfire',
  'shooting': 'gunfire',
  'আগুন': 'arson',
  'অগ্নিসংযোগ': 'arson',
  'fire': 'arson',
  'arson': 'arson',
  'কিশোর': 'teengang',
  'গ্যাং': 'teengang',
  'gang': 'teengang',
  'চাঁদাবাজি': 'extortion',
  'extortion': 'extortion',
};

/**
 * Normalizes root words / synonyms in Bengali
 */
function stemBengaliToken(token: string): string {
  let word = token.normalize('NFC').toLowerCase();

  // Strip known trailing plural/case inflections
  word = word
    .replace(/(?:গুলোর|গুলোতে|গুলোয়|গুলো|দের|খানা|খানি|টুকু)$/, '')
    .replace(/(?:ের|কে|তে|ে)$/, '')
    .replace(/(?:য়|য়ে|ায়)$/, '');

  // Normalize common synonyms / alternative spellings
  if (word.startsWith('গ্রেপ্তা') || word.startsWith('গ্রেফতা') || word === 'আটক') return 'গ্রেপ্তার';
  if (word.startsWith('পিকআপ')) return 'পিকআপ';
  if (word.startsWith('ট্রাক')) return 'ট্রাক';
  if (word.startsWith('বাস')) return 'বাস';
  if (word.startsWith('লরি')) return 'লরি';
  if (word.startsWith('গাড়ি') || word.startsWith('গাড়ী')) return 'গাড়ি';
  if (word.startsWith('ডাকাতি')) return 'ডাকাতি';
  if (word.startsWith('ছিনতাই')) return 'ছিনতাই';
  if (word.startsWith('লুণ্ঠ')) return 'লুণ্ঠন';
  if (word.startsWith('টাকা')) return 'টাকা';
  if (word.startsWith('মামলা')) return 'মামলা';
  if (word.startsWith('ঘটনা')) return 'ঘটনা';

  return word;
}

/**
 * Extracts normalized, stemmed, cross-lingual significant entity/event tokens from a news title
 */
export function extractSignificantTokens(rawTitle: string): Set<string> {
  const normDigits = normalizeDigits(rawTitle);
  let text = normDigits.normalize('NFC').toLowerCase();

  // Strip [Google News ...] prefixes
  text = text.replace(/^\[(?:google news[^\]]*|the daily star[^\]]*)\]\s*/i, '');

  // Strip media outlet brand signatures
  for (const outlet of OUTLET_NAMES) {
    text = text.split(outlet).join(' ');
  }

  // Extract canonical landmark if present (bridges English "Mymensingh" with Bangla "ময়মনসিংহ")
  const landmark = findLandmarkInText(rawTitle);
  const significant = new Set<string>();
  if (landmark) {
    significant.add(landmark.locationName.toLowerCase());
  }

  // Extract standalone digits (e.g. casualty counts: '2', '3', '8')
  const digitMatches = normDigits.match(/\b\d+\b/g);
  if (digitMatches) {
    digitMatches.forEach((d) => significant.add(d));
  }

  // Strip punctuation and special characters
  text = text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।|—]/g, ' ');

  const rawWords = text.split(/\s+/).map((w) => w.trim()).filter(Boolean);

  for (const w of rawWords) {
    if (BENGALI_STOPWORDS.has(w)) continue;

    // Check cross-lingual concept dictionary
    const canonicalConcept = BILINGUAL_CONCEPT_MAP[w];
    if (canonicalConcept) {
      significant.add(canonicalConcept);
    }

    const stemmed = stemBengaliToken(w);
    if (stemmed.length >= 1 && !BENGALI_STOPWORDS.has(stemmed)) {
      significant.add(stemmed);
      const conceptFromStemmed = BILINGUAL_CONCEPT_MAP[stemmed];
      if (conceptFromStemmed) {
        significant.add(conceptFromStemmed);
      }
    }
  }

  return significant;
}

/**
 * Identifies major location names mentioned in title
 */
function extractLocations(tokens: Set<string>): string[] {
  const locs: string[] = [];
  for (const t of tokens) {
    if (
      LOCAL_LANDMARK_MAP[t] ||
      LOCAL_LANDMARK_MAP[t + 'ে'] ||
      LOCAL_LANDMARK_MAP[t + 'ের'] ||
      Object.values(LOCAL_LANDMARK_MAP).some((m) => m.standardName.toLowerCase() === t)
    ) {
      locs.push(t);
    }
  }
  return locs;
}

/**
 * Calculates token overlap similarity between two titles.
 * Fully supports bilingual matching (English <-> Bangla).
 */
export function calculateStorySimilarity(
  title1: string,
  title2: string
): { isDuplicate: boolean; score: number; sharedTokens: string[] } {
  const set1 = extractSignificantTokens(title1);
  const set2 = extractSignificantTokens(title2);

  if (set1.size === 0 || set2.size === 0) {
    return { isDuplicate: false, score: 0, sharedTokens: [] };
  }

  // If both titles explicitly mention conflicting districts (e.g. Mymensingh vs Sylhet), reject duplicate
  const locs1 = extractLocations(set1);
  const locs2 = extractLocations(set2);
  if (locs1.length > 0 && locs2.length > 0) {
    const hasSharedLoc = locs1.some((l1) =>
      locs2.some((l2) => {
        if (l1 === l2) return true;
        const s1 = LOCAL_LANDMARK_MAP[l1]?.standardName || l1;
        const s2 = LOCAL_LANDMARK_MAP[l2]?.standardName || l2;
        return s1.toLowerCase() === s2.toLowerCase();
      })
    );
    if (!hasSharedLoc) {
      return { isDuplicate: false, score: 0, sharedTokens: [] };
    }
  }

  const sharedTokens: string[] = [];
  for (const t of set1) {
    if (set2.has(t)) {
      sharedTokens.push(t);
    }
  }

  const unionSize = new Set([...set1, ...set2]).size;
  const jaccard = unionSize > 0 ? sharedTokens.length / unionSize : 0;
  const overlapRatio = sharedTokens.length / Math.min(set1.size, set2.size);

  // Core anchor entities that strongly indicate identical incidents
  const highValueEntities = [
    'truck',
    'pickup',
    'bus',
    'microbus',
    'cng',
    'motorcycle',
    'collision',
    'accident',
    'killed',
    'injured',
    'robbery',
    'theft',
    'snatching',
    'arrest',
    'murder',
    'stabbing',
    'gunfire',
    'arson',
    'teengang',
    'extortion',
    'ট্রাক',
    'পিকআপ',
    'বাস',
    'সংঘর্ষ',
    'ডাকাতি',
    'ছিনতাই',
    'গ্রেপ্তার',
    'খুন',
  ];

  const sharedHighValue = sharedTokens.filter((st) => highValueEntities.includes(st));

  // Incident Duplicate Criteria:
  // 1. 3 or more shared tokens and Jaccard >= 0.25
  // 2. OR 2 or more shared high-value entities (e.g. [truck, pickup] or [robbery, arrest]) and overlapRatio >= 0.35
  // 3. OR high overall overlap (>= 0.50)
  const isDuplicate =
    (sharedTokens.length >= 3 && jaccard >= 0.25) ||
    (sharedHighValue.length >= 2 && overlapRatio >= 0.35) ||
    overlapRatio >= 0.5;

  return {
    isDuplicate,
    score: Math.max(jaccard, overlapRatio),
    sharedTokens,
  };
}

/**
 * Searches the database for an existing active report representing the same incident.
 * Checks spatial proximity (approx 3.5km), category match, and title token similarity.
 */
export async function findDuplicateActiveReport(params: {
  title: string;
  category: ReportCategory;
  latitude: number;
  longitude: number;
  maxDistanceDegrees?: number;
  lookbackHours?: number;
}): Promise<{ existingReport: Report; sharedTokens: string[] } | null> {
  const { title, category, latitude, longitude } = params;
  const maxDelta = params.maxDistanceDegrees ?? 0.035; // ~3.5 km
  const lookbackHours = params.lookbackHours ?? 48; // 48 hours
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  // Categories that can be considered compatible when matching duplicate press coverage
  const compatibleCategories: Record<string, ReportCategory[]> = {
    ROAD_ACCIDENT: ['ROAD_ACCIDENT', 'ARMED_ASSAULT'],
    ROBBERY: ['ROBBERY', 'DACOITY', 'THEFT_ROBBERY'],
    THEFT_ROBBERY: ['THEFT_ROBBERY', 'ROBBERY', 'THEFT'],
    SNATCHING: ['SNATCHING', 'MUGGING', 'SNATCHING_ARMED_ASSAULT'],
    ARMED_ASSAULT: ['ARMED_ASSAULT', 'ROAD_ACCIDENT'],
  };

  const allowedCategories = compatibleCategories[category] || [category];

  const candidates = await prisma.report.findMany({
    where: {
      status: 'ACTIVE',
      createdAt: { gte: cutoff },
      latitude: { gte: latitude - maxDelta, lte: latitude + maxDelta },
      longitude: { gte: longitude - maxDelta, lte: longitude + maxDelta },
      category: { in: allowedCategories },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  for (const candidate of candidates) {
    const candidateTitle = candidate.description ? candidate.description.split('\n')[0] : '';
    const sim = calculateStorySimilarity(title, candidateTitle);

    if (sim.isDuplicate) {
      return { existingReport: candidate, sharedTokens: sim.sharedTokens };
    }
  }

  return null;
}
