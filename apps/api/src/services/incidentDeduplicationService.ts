import { prisma } from '../db/prisma';
import { Report, ReportCategory } from '@prisma/client';
import { LOCAL_LANDMARK_MAP } from './geocodingService';

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
  'নিহত',
  'আহত',
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
  'killed',
  'injured',
  'dead',
  'dies',
  'death',
  'hospital',
  'police',
  'case',
  'tv',
  'com',
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
 * Extracts normalized, stemmed significant entity/event tokens from a news title
 */
export function extractSignificantTokens(rawTitle: string): Set<string> {
  let text = rawTitle.normalize('NFC').toLowerCase();

  // Strip [Google News ...] prefixes
  text = text.replace(/^\[(?:google news[^\]]*|the daily star[^\]]*)\]\s*/i, '');

  // Strip media outlet brand signatures
  for (const outlet of OUTLET_NAMES) {
    text = text.split(outlet).join(' ');
  }

  // Strip punctuation and special characters
  text = text.replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~‘’“”।|—]/g, ' ');

  const rawWords = text.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  const significant = new Set<string>();

  for (const w of rawWords) {
    // Allow single digits (e.g. '২', '৮') as incident casualty counts
    if (w.length === 1 && !/^[০-৯0-9]$/.test(w)) continue;
    if (BENGALI_STOPWORDS.has(w)) continue;

    const stemmed = stemBengaliToken(w);
    if (stemmed.length >= 1 && !BENGALI_STOPWORDS.has(stemmed)) {
      significant.add(stemmed);
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
    if (LOCAL_LANDMARK_MAP[t] || LOCAL_LANDMARK_MAP[t + 'ে'] || LOCAL_LANDMARK_MAP[t + 'ের']) {
      locs.push(t);
    }
  }
  return locs;
}

/**
 * Calculates token overlap similarity between two titles
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
    const hasSharedLoc = locs1.some((l) => locs2.includes(l));
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
    'ট্রাক',
    'পিকআপ',
    'বাস',
    'মাইক্রোবাস',
    'সিএনজি',
    'অটোরিকশা',
    'লরি',
    'সংঘর্ষ',
    'মুখোমুখি',
    'ডাকাতি',
    'ছিনতাই',
    'গ্রেপ্তার',
    'লুণ্ঠন',
    'কিশোর গ্যাং',
    'খুন',
    'হত্যা',
  ];

  const sharedHighValue = sharedTokens.filter((st) => highValueEntities.includes(st));

  // Incident Duplicate Criteria:
  // 1. 3 or more shared tokens and Jaccard >= 0.25
  // 2. OR 2 or more shared high-value entities (e.g. [ট্রাক, পিকআপ] or [ডাকাতি, গ্রেপ্তার]) and overlapRatio >= 0.35
  // 3. OR high overall overlap (>= 0.55)
  const isDuplicate =
    (sharedTokens.length >= 3 && jaccard >= 0.25) ||
    (sharedHighValue.length >= 2 && overlapRatio >= 0.35) ||
    overlapRatio >= 0.55;

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
    ROAD_ACCIDENT: ['ROAD_ACCIDENT', 'ARMED_ASSAULT'], // Handle previously misclassified reports
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
