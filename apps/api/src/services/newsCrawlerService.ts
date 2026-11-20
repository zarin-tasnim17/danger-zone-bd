import Parser from 'rss-parser';
import { prisma } from '../db/prisma';
import { ReportCategory } from '@prisma/client';
import { resolveLocationFromText } from './geocodingService';
import { classifyNewsText } from './newsClassifierService';
import { isForeignIncident } from './internationalIncidentFilter';
import { evaluateActiveThreatEligibility } from './activeThreatEligibilityService';
import { crossVerifyCitizenReports } from './newsVerificationService';
import { findDuplicateActiveReport, normalizeCanonicalUrl, cleanIncidentTitle, candidateLock } from './incidentDeduplicationService';
import { emitNewReport, emitReportEnriched } from '../sockets';
import { isActiveThreatIncident } from '@repo/shared';
import { broadcastPlatformStats } from './statsService';
import { setReportLocation } from '../db/spatialUtils';
import { newsObservabilityService, CrawlRunRecorder } from './newsObservabilityService';
import {
  isWireSyndicatedStory,
  resolvePublisherDomain,
  DIRECT_PUBLISHER_FEEDS,
  type DirectFeedDefinition,
} from './publisherRegistry';
import {
  validateUrlForSafeFetch,
  sanitizeXmlPayload,
  MAX_FEED_RESPONSE_BYTES,
} from '../utils/ssrfFilter';

const parser = new Parser({
  headers: {
    'User-Agent': 'DangerZoneBD-PublicSafetyNewsCrawler/1.0 (contact@dangerzonebd.org)',
  },
  timeout: 10000,
});

export interface FeedConfig {
  name: string;
  category: ReportCategory;
  categoryHint: ReportCategory;
  url: string;
  timeoutMs?: number;
}

export const buildGoogleNewsRssUrl = (query: string, lang: 'bn' | 'en' = 'en'): string => {
  const encodedQuery = encodeURIComponent(query);
  if (lang === 'bn') {
    return `https://news.google.com/rss/search?q=${encodedQuery}&hl=bn&gl=BD&ceid=BD:bn`;
  }
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-BD&gl=BD&ceid=BD:en`;
};

export const DEDICATED_CATEGORY_FEEDS: FeedConfig[] = [
  {
    name: 'Google News BD Theft',
    category: 'THEFT',
    categoryHint: 'THEFT',
    url: buildGoogleNewsRssUrl('(theft OR burglary OR stolen OR "চুরি" OR "চোর" OR "সিঁধেল চুরি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Robbery',
    category: 'ROBBERY',
    categoryHint: 'ROBBERY',
    url: buildGoogleNewsRssUrl('(robbery OR dacoity OR "ডাকাত" OR "ডাকাতি" OR "সশস্ত্র ডাকাত" OR "লুণ্ঠন") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Theft & Robbery',
    category: 'THEFT_ROBBERY',
    categoryHint: 'THEFT_ROBBERY',
    url: buildGoogleNewsRssUrl('("theft and robbery" OR "burglary and robbery" OR "চুরি ও ডাকাতি" OR "চুরি ডাকাতি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching',
    category: 'SNATCHING',
    categoryHint: 'SNATCHING',
    url: buildGoogleNewsRssUrl('(snatching OR mugging OR "ছিনতাই" OR "ছিনতাইকারী" OR "ব্যাগ টান") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Armed Assault',
    category: 'ARMED_ASSAULT',
    categoryHint: 'ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('(assault OR "armed assault" OR "knife attack" OR gunfire OR "কুপিয়ে জখম" OR "ছুরিকাঘাত" OR "গুলিবিদ্ধ" OR "সংঘর্ষ") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching & Armed Assault',
    category: 'SNATCHING_ARMED_ASSAULT',
    categoryHint: 'SNATCHING_ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('("armed mugging" OR "violent snatching" OR "ছিনতাই ও হামলা" OR "ছিনতাইকালে কুপিয়ে" OR "ছিনতাইকালে গুলি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Extortion',
    category: 'EXTORTION',
    categoryHint: 'EXTORTION',
    url: buildGoogleNewsRssUrl('(extortion OR "illegal toll" OR "protection money" OR "চাঁদাবাজি" OR "চাঁদা দাবি" OR "চাঁদাবাজ") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Youth Gang Activity',
    category: 'YOUTH_GANG_ACTIVITY',
    categoryHint: 'YOUTH_GANG_ACTIVITY',
    url: buildGoogleNewsRssUrl('("youth gang" OR "teen gang" OR "teenage gang" OR "juvenile delinquency" OR "কিশোর গ্যাং" OR "কিশোর অপরাধী") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Drug-Related Crime',
    category: 'DRUG_RELATED_CRIME',
    categoryHint: 'DRUG_RELATED_CRIME',
    url: buildGoogleNewsRssUrl('(narcotics OR "yaba" OR phensedyl OR "মাদক" OR "ইয়াবা" OR "গাঁজা" OR "ফেনসিডিল" OR "মাদক কারবারি") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Unlit & Hazardous Road',
    category: 'UNLIT_ROAD',
    categoryHint: 'UNLIT_ROAD',
    url: buildGoogleNewsRssUrl('("unlit road" OR "dark street" OR "street light off" OR "broken road" OR "pothole hazard" OR "অন্ধকার রাস্তা" OR "সড়ক বাতি নেই" OR "ভাঙা রাস্তা") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Road Accident',
    category: 'ROAD_ACCIDENT',
    categoryHint: 'ROAD_ACCIDENT',
    url: buildGoogleNewsRssUrl('("road accident" OR "bus accident" OR "সড়ক দুর্ঘটনা" OR "বাস উল্টে" OR "মুখোমুখি সংঘর্ষ") bangladesh -saudi -india -overseas when:1d'),
    timeoutMs: 10000,
  },
];

export const DEDICATED_CATEGORY_FEEDS_EN: FeedConfig[] = [
  {
    name: 'Google News BD Theft (EN)',
    category: 'THEFT',
    categoryHint: 'THEFT',
    url: buildGoogleNewsRssUrl('(theft OR burglary OR stolen OR burgled OR break-in) bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Robbery (EN)',
    category: 'ROBBERY',
    categoryHint: 'ROBBERY',
    url: buildGoogleNewsRssUrl('(robbery OR dacoity OR "armed robbery" OR "robbers looted" OR "gang robbery") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Theft & Robbery (EN)',
    category: 'THEFT_ROBBERY',
    categoryHint: 'THEFT_ROBBERY',
    url: buildGoogleNewsRssUrl('("theft and robbery" OR "burglary and robbery" OR "burglary and dacoity") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching (EN)',
    category: 'SNATCHING',
    categoryHint: 'SNATCHING',
    url: buildGoogleNewsRssUrl('(snatching OR mugging OR "bag snatched" OR "phone snatched" OR snatcher) bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Armed Assault (EN)',
    category: 'ARMED_ASSAULT',
    categoryHint: 'ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('(assault OR "armed assault" OR "knife attack" OR gunfire OR stabbed OR stabbing OR "violent clash") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching & Armed Assault (EN)',
    category: 'SNATCHING_ARMED_ASSAULT',
    categoryHint: 'SNATCHING_ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('("armed mugging" OR "violent snatching" OR "stabbed during mugging" OR "shot by snatchers") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Extortion (EN)',
    category: 'EXTORTION',
    categoryHint: 'EXTORTION',
    url: buildGoogleNewsRssUrl('(extortion OR "illegal toll" OR "protection money" OR extortionist) bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Youth Gang Activity (EN)',
    category: 'YOUTH_GANG_ACTIVITY',
    categoryHint: 'YOUTH_GANG_ACTIVITY',
    url: buildGoogleNewsRssUrl('("youth gang" OR "teen gang" OR "teenage gang" OR "juvenile delinquency") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Drug-Related Crime (EN)',
    category: 'DRUG_RELATED_CRIME',
    categoryHint: 'DRUG_RELATED_CRIME',
    url: buildGoogleNewsRssUrl('(narcotics OR "yaba" OR phensedyl OR "drug peddler" OR "drugs seized" OR methamphetamine) bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Unlit & Hazardous Road (EN)',
    category: 'UNLIT_ROAD',
    categoryHint: 'UNLIT_ROAD',
    url: buildGoogleNewsRssUrl('("unlit road" OR "dark street" OR "street light off" OR "broken road" OR "pothole hazard" OR "open manhole") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Road Accident (EN)',
    category: 'ROAD_ACCIDENT',
    categoryHint: 'ROAD_ACCIDENT',
    url: buildGoogleNewsRssUrl('("road accident" OR "bus accident" OR "traffic accident" OR "road crash" OR "head-on collision" OR "deadly crash") bangladesh -court -bail -verdict -remand -corruption -politics -saudi -india -overseas when:1d', 'en'),
    timeoutMs: 10000,
  },
];

export const DEDICATED_CATEGORY_FEEDS_BN: FeedConfig[] = [
  {
    name: 'Google News BD Theft (BN)',
    category: 'THEFT',
    categoryHint: 'THEFT',
    url: buildGoogleNewsRssUrl('("চুরি" OR "চোর" OR "সিঁধেল চুরি" OR "টাকা চুরি" OR "স্বর্ণালঙ্কার চুরি") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Robbery (BN)',
    category: 'ROBBERY',
    categoryHint: 'ROBBERY',
    url: buildGoogleNewsRssUrl('("ডাকাতি" OR "ডাকাত দল" OR "ডাকাত" OR "সশস্ত্র ডাকাত" OR "লুণ্ঠন" OR "লুটপাট") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Theft & Robbery (BN)',
    category: 'THEFT_ROBBERY',
    categoryHint: 'THEFT_ROBBERY',
    url: buildGoogleNewsRssUrl('("চুরি ও ডাকাতি" OR "চুরি ডাকাতি") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching (BN)',
    category: 'SNATCHING',
    categoryHint: 'SNATCHING',
    url: buildGoogleNewsRssUrl('("ছিনতাই" OR "ছিনতাইকারী" OR "ব্যাগ ছিনতাই" OR "মোবাইল ছিনতাই" OR "ব্যাগ টান") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Armed Assault (BN)',
    category: 'ARMED_ASSAULT',
    categoryHint: 'ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('("কোপানো" OR "কুপিয়ে জখম" OR "ছুরিকাঘাত" OR "গুলিবিদ্ধ" OR "সংঘর্ষ" OR "অস্ত্রসহ হামলা" OR "মারামারি") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Snatching & Armed Assault (BN)',
    category: 'SNATCHING_ARMED_ASSAULT',
    categoryHint: 'SNATCHING_ARMED_ASSAULT',
    url: buildGoogleNewsRssUrl('("ছিনতাই ও হামলা" OR "ছিনতাইকালে কুপিয়ে" OR "ছিনতাইকালে গুলি" OR "ছিনতাই ও কোপানো") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Extortion (BN)',
    category: 'EXTORTION',
    categoryHint: 'EXTORTION',
    url: buildGoogleNewsRssUrl('("চাঁদাবাজি" OR "চাঁদা দাবি" OR "চাঁদাবাজ" OR "দখলবাজি" OR "অবৈধ চাঁদা") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Youth Gang Activity (BN)',
    category: 'YOUTH_GANG_ACTIVITY',
    categoryHint: 'YOUTH_GANG_ACTIVITY',
    url: buildGoogleNewsRssUrl('("কিশোর গ্যাং" OR "কিশোর অপরাধী" OR "কিশোর গ্যাংয়ের হামলা" OR "কিশোর গ্যাংয়ের মহড়া") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Drug-Related Crime (BN)',
    category: 'DRUG_RELATED_CRIME',
    categoryHint: 'DRUG_RELATED_CRIME',
    url: buildGoogleNewsRssUrl('("মাদক" OR "ইয়াবা" OR "গাঁজা" OR "ফেনসিডিল" OR "মাদক কারবারি" OR "হেরোইন") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Unlit & Hazardous Road (BN)',
    category: 'UNLIT_ROAD',
    categoryHint: 'UNLIT_ROAD',
    url: buildGoogleNewsRssUrl('("অন্ধকার রাস্তা" OR "সড়ক বাতি নেই" OR "ভাঙা রাস্তা" OR "বিপজ্জনক গর্ত" OR "ম্যানহোল খোলা") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
  {
    name: 'Google News BD Road Accident (BN)',
    category: 'ROAD_ACCIDENT',
    categoryHint: 'ROAD_ACCIDENT',
    url: buildGoogleNewsRssUrl('("সড়ক দুর্ঘটনা" OR "বাস উল্টে" OR "মুখোমুখি সংঘর্ষ" OR "চাপা পড়ে নিহত" OR "গাড়ি দুর্ঘটনা") বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি -রাজনীতি -সৌদি -ভারত when:1d', 'bn'),
    timeoutMs: 10000,
  },
];

export const PUBLIC_NEWS_FEEDS: FeedConfig[] = [
  ...DEDICATED_CATEGORY_FEEDS_EN,
  ...DEDICATED_CATEGORY_FEEDS_BN,
];

// ============================================================================
// NATIONWIDE GEOGRAPHIC CLUSTERS (64 DISTRICTS, 10 CLUSTERS)
// ============================================================================

export interface NationwideCluster {
  id: string;
  name: string;
  districtsEn: string[];
  districtsBn: string[];
}

export const NATIONWIDE_CLUSTERS: NationwideCluster[] = [
  {
    id: 'C1',
    name: 'Dhaka North / Industrial',
    districtsEn: ['Gazipur', 'Narayanganj', 'Narsingdi', 'Tangail', 'Manikganj'],
    districtsBn: ['গাজীপুর', 'নারায়ণগঞ্জ', 'নরসিংদী', 'টাঙ্গাইল', 'মানিকগঞ্জ'],
  },
  {
    id: 'C2',
    name: 'Dhaka South / Padma',
    districtsEn: ['Dhaka', 'Munshiganj', 'Faridpur', 'Gopalganj', 'Madaripur', 'Shariatpur', 'Rajbari', 'Kishoreganj'],
    districtsBn: ['ঢাকা', 'মুন্সীগঞ্জ', 'ফরিদপুর', 'গোপালগঞ্জ', 'মাদারীপুর', 'শরীয়তপুর', 'রাজবাড়ী', 'কিশোরগঞ্জ'],
  },
  {
    id: 'C3',
    name: 'Chattogram Urban & Coast',
    districtsEn: ['Chattogram', "Cox's Bazar", 'Feni', 'Noakhali', 'Lakshmipur', 'Chandpur'],
    districtsBn: ['চট্টগ্রাম', 'কক্সবাজার', 'ফেনী', 'নোয়াখালী', 'লক্ষ্মীপুর', 'চাঁদপুর'],
  },
  {
    id: 'C4',
    name: 'Chattogram Hill & Cumilla',
    districtsEn: ['Cumilla', 'Brahmanbaria', 'Bandarban', 'Rangamati', 'Khagrachhari'],
    districtsBn: ['কুমিল্লা', 'ব্রাহ্মণবাড়িয়া', 'বান্দরবান', 'রাঙ্গামাটি', 'খাগড়াছড়ি'],
  },
  {
    id: 'C5',
    name: 'Sylhet',
    districtsEn: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
    districtsBn: ['সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ'],
  },
  {
    id: 'C6',
    name: 'Mymensingh',
    districtsEn: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
    districtsBn: ['ময়মনসিংহ', 'জামালপুর', 'নেত্রকোণা', 'শেরপুর'],
  },
  {
    id: 'C7',
    name: 'Rajshahi',
    districtsEn: ['Rajshahi', 'Bogura', 'Pabna', 'Sirajganj', 'Naogaon', 'Natore', 'Chapainawabganj', 'Joypurhat'],
    districtsBn: ['রাজশাহী', 'বগুড়া', 'পাবনা', 'সিরাজগঞ্জ', 'নওগাঁ', 'নাটোর', 'চাঁপাইনবাবগঞ্জ', 'জয়পুরহাট'],
  },
  {
    id: 'C8',
    name: 'Rangpur',
    districtsEn: ['Rangpur', 'Dinajpur', 'Kurigram', 'Gaibandha', 'Nilphamari', 'Lalmonirhat', 'Panchagarh', 'Thakurgaon'],
    districtsBn: ['রংপুর', 'দিনাজপুর', 'কুড়িগ্রাম', 'গাইবান্ধা', 'নীলফামারী', 'লালমনিরহাট', 'পঞ্চগড়', 'ঠাকুরগাঁও'],
  },
  {
    id: 'C9',
    name: 'Khulna',
    districtsEn: ['Khulna', 'Jashore', 'Kushtia', 'Satkhira', 'Bagerhat', 'Jhenaidah', 'Magura', 'Narail', 'Chuadanga', 'Meherpur'],
    districtsBn: ['খুলনা', 'যশোর', 'কুষ্টিয়া', 'সাতক্ষীরা', 'বাগেরহাট', 'ঝিনাইদহ', 'মাগুরা', 'নড়াইল', 'চুয়াডাঙ্গা', 'মেহেরপুর'],
  },
  {
    id: 'C10',
    name: 'Barishal',
    districtsEn: ['Barishal', 'Patuakhali', 'Bhola', 'Pirojpur', 'Barguna', 'Jhalakathi'],
    districtsBn: ['বরিশাল', 'পটুয়াখালী', 'ভোলা', 'পিরোজপুর', 'বরগুনা', 'ঝালকাঠি'],
  },
];

export const CLUSTER_ROTATION_SCHEDULE: [string, string][] = [
  ['C1', 'C2'],
  ['C3', 'C4'],
  ['C5', 'C6'],
  ['C7', 'C8'],
  ['C9', 'C10'],
];

let clusterRotationIndex = 0;
export const getNextClusterPair = (): [string, string] => {
  const pair = CLUSTER_ROTATION_SCHEDULE[clusterRotationIndex % CLUSTER_ROTATION_SCHEDULE.length];
  clusterRotationIndex = (clusterRotationIndex + 1) % CLUSTER_ROTATION_SCHEDULE.length;
  return pair;
};
export const getClusterRotationIndex = (): number => clusterRotationIndex;
export const resetClusterRotationIndex = (): void => {
  clusterRotationIndex = 0;
};

export const buildClusterFeeds = (clusterId: string): FeedConfig[] => {
  const cluster = NATIONWIDE_CLUSTERS.find((c) => c.id === clusterId);
  if (!cluster) return [];

  const enDistricts = cluster.districtsEn.join(' OR ');
  const bnDistricts = cluster.districtsBn.map((d) => `"${d}"`).join(' OR ');

  const enQuery = `(${enDistricts}) (accident OR collision OR killed OR injured OR assault OR robbery OR theft OR violence OR "youth gang" OR extortion) bangladesh -court -bail -verdict -remand -corruption -politics when:2d`;
  const bnQuery = `(${bnDistricts}) (দুর্ঘটনা OR সংঘর্ষ OR নিহত OR আহত OR ছিনতাই OR ডাকাতি OR চুরি OR হামলা OR "কিশোর গ্যাং" OR চাঁদাবাজি) বাংলাদেশ -আদালত -জামিন -রিমান্ড -দুদক -দুর্নীতি when:2d`;

  return [
    {
      name: `Google News BD ${cluster.name} (EN)`,
      category: 'ROAD_ACCIDENT' as ReportCategory,
      categoryHint: 'ROAD_ACCIDENT' as ReportCategory,
      url: buildGoogleNewsRssUrl(enQuery, 'en'),
      timeoutMs: 10000,
    },
    {
      name: `Google News BD ${cluster.name} (BN)`,
      category: 'ROAD_ACCIDENT' as ReportCategory,
      categoryHint: 'ROAD_ACCIDENT' as ReportCategory,
      url: buildGoogleNewsRssUrl(bnQuery, 'bn'),
      timeoutMs: 10000,
    },
  ];
};

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  openUntil: number;
  consecutiveFailures: number;
}

export const circuitBreaker: CircuitBreakerState = {
  state: 'CLOSED',
  openUntil: 0,
  consecutiveFailures: 0,
};

export const checkGoogleNewsCircuit = (): boolean => {
  const now = Date.now();
  if (circuitBreaker.state === 'OPEN') {
    if (now >= circuitBreaker.openUntil) {
      circuitBreaker.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
  return true;
};

export const recordGoogleNewsSuccess = (): void => {
  if (circuitBreaker.state === 'OPEN') {
    const now = Date.now();
    if (now < circuitBreaker.openUntil) {
      // Cooldown in progress, do not reset early
      return;
    }
  }
  circuitBreaker.state = 'CLOSED';
  circuitBreaker.consecutiveFailures = 0;
};

export const recordGoogleNewsFailure = (isRateLimit: boolean): void => {
  circuitBreaker.consecutiveFailures++;
  if (isRateLimit || circuitBreaker.consecutiveFailures >= 3) {
    circuitBreaker.state = 'OPEN';
    circuitBreaker.openUntil = Date.now() + 30 * 60 * 1000; // 30 minutes cooldown
    console.warn(
      `[News Crawler] ⚠️ Google News circuit breaker OPEN until ${new Date(circuitBreaker.openUntil).toISOString()} (RateLimit: ${isRateLimit})`
    );
  }
};

export const sleepJitter = async (minMs = 1500, maxMs = 2500): Promise<void> => {
  if (process.env.NODE_ENV === 'test' || process.env.HERMETIC_TEST_MODE === 'true' || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  const delay = Math.floor(minMs + Math.random() * (maxMs - minMs));
  await new Promise((r) => setTimeout(r, delay));
};

export const sanitizeXmlString = (xml: string): string => {
  return sanitizeXmlPayload(xml);
};

const NEWS_BOT_EMAIL = 'news-crawler-bot@safety.bd';
let cachedBotUserId: string | null = null;

/**
 * Ensures system news-crawler bot user exists with VERIFIED_RESPONDER privileges
 */
export const getOrCreateNewsBotUser = async (): Promise<string> => {
  if (cachedBotUserId) {
    return cachedBotUserId;
  }

  try {
    let bot = await prisma.user.findUnique({
      where: { email: NEWS_BOT_EMAIL },
    });

    if (!bot) {
      bot = await prisma.user.create({
        data: {
          email: NEWS_BOT_EMAIL,
          anonymousId: 'news-crawler-bot-system-v1',
          role: 'VERIFIED_RESPONDER',
          isVerified: true,
          trustScore: 100,
        },
      });
    }

    cachedBotUserId = bot.id;
    return bot.id;
  } catch {
    cachedBotUserId = 'news-crawler-bot-system-v1';
    return cachedBotUserId;
  }
};

export interface RawNewsItem {
  guid: string;
  title: string;
  link: string;
  pubDate?: string | Date;
  contentSnippet?: string;
  sourceName: string;
  categoryHint?: ReportCategory;
}

/**
 * Returns the active map lifespan (in hours) based on incident category.
 * - Acute traffic incidents: 48 hours
 * - Acute violent / property crimes: 72 hours (3 days)
 * - Recurring social / syndicate hazards: 7 days (168 hours)
 * - Infrastructure hazards: 14 days (336 hours)
 */
export const getNewsCategoryLifespanHours = (category: ReportCategory): number => {
  switch (category) {
    case 'ROAD_ACCIDENT':
      return 48; // 48 hours (2 days)
    case 'SNATCHING':
    case 'ROBBERY':
    case 'THEFT_ROBBERY':
    case 'ARMED_ASSAULT':
    case 'SNATCHING_ARMED_ASSAULT':
    case 'THEFT':
    case 'EXTORTION':
    case 'MUGGING':
    case 'DACOITY':
    case 'THEFT_DACOITY':
      return 72; // 72 hours (3 days)
    case 'YOUTH_GANG_ACTIVITY':
    case 'DRUG_RELATED_CRIME':
    case 'TEEN_GANG':
    case 'TEEN_GANG_ARMED_ASSAULT':
    case 'DRUG_ACTIVITY':
      return 168; // 7 days (168 hours)
    case 'UNLIT_ROAD':
      return 336; // 14 days (336 hours)
    default:
      return 72;
  }
};

/**
 * Computes the expiration date for a news-originated incident report.
 * Guarantees at least 24 hours of visibility from time of ingestion even if
 * the article publication date was several days in the past.
 */
export const calculateNewsReportExpiry = (
  category: ReportCategory,
  publishedAt: Date = new Date(),
  now: Date = new Date()
): Date => {
  const lifespanHours = getNewsCategoryLifespanHours(category);
  const lifespanMs = lifespanHours * 60 * 60 * 1000;
  const candidateExpiry = new Date(publishedAt.getTime() + lifespanMs);

  // Grant at least 24 hours of live map presence from current ingestion time
  const minFutureExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (candidateExpiry.getTime() < minFutureExpiry.getTime()) {
    return minFutureExpiry;
  }

  return candidateExpiry;
};

/**
 * Ingests and processes an array of news items:
 * 1. Batch deduplicates against NewsArticle.guid to eliminate DB round-trip overhead.
 * 2. Filters out articles older than 7 days.
 * 3. Classifies category and severity via bilingual classifier.
 * 4. Resolves Bangladesh coordinates via landmark dictionary / Nominatim.
 * 5. Saves Report and NewsArticle in database.
 * 6. Executes cross-verification against active citizen reports.
 * 7. Broadcasts real-time NEW_REPORT event.
 */
export const processAndIngestNewsItems = async (
  items: RawNewsItem[],
  runRecorder?: CrawlRunRecorder
): Promise<{ ingested: number; skipped: number; verifiedMatches: number }> => {
  const botUserId = await getOrCreateNewsBotUser();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let ingested = 0;
  let skipped = 0;
  let verifiedMatches = 0;

  if (runRecorder) {
    runRecorder.recordDiscoveredArticles(items.length);
  }

  // Batch deduplication check in a single query
  const allGuids = items.map((i) => i.guid || normalizeCanonicalUrl(i.link)).filter(Boolean);
  const allUrls = items.map((i) => normalizeCanonicalUrl(i.link)).filter(Boolean);
  let existingGuidSet = new Set<string>();
  let existingUrlSet = new Set<string>();
  try {
    const existingArticles = await prisma.newsArticle.findMany({
      where: {
        OR: [
          { guid: { in: allGuids } },
          { sourceUrl: { in: allUrls } },
        ],
      },
      select: { guid: true, sourceUrl: true },
    });
    existingGuidSet = new Set(existingArticles.map((a) => a.guid));
    existingUrlSet = new Set(existingArticles.map((a) => a.sourceUrl).filter(Boolean));
  } catch {
    // In hermetic test mode or without live DB, proceed with empty set
  }

  for (const item of items) {
    const canonicalUrl = normalizeCanonicalUrl(item.link);
    const guid = item.guid || canonicalUrl;
    if (!guid || !item.title) {
      skipped++;
      if (runRecorder) runRecorder.recordDuplicateRejection();
      continue;
    }

    // 1. Deduplication check (check both GUID and normalized canonical URL)
    if (existingGuidSet.has(guid) || existingUrlSet.has(canonicalUrl)) {
      skipped++;
      if (runRecorder) runRecorder.recordDuplicateRejection();
      continue;
    }

    // 2. Date check: max 7 days old
    const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
    if (publishedAt < sevenDaysAgo) {
      skipped++;
      continue;
    }

    // 3. Domestic Incident Boundary Check (Strictly exclude overseas/expatriate news)
    const foreignCheck = isForeignIncident(item.title, item.contentSnippet || '');
    if (foreignCheck.isForeign) {
      console.log(
        `[News Crawler] 🌍 Skipping overseas incident: "${item.title.substring(0, 65)}..." (Matched: ${foreignCheck.matchedTerm})`
      );
      skipped++;
      continue;
    }

    // 4. Content-Based Bilingual Classification (Strict Decoupling from Feed categoryHint)
    const classification = classifyNewsText(item.title, item.contentSnippet || '');
    const finalCategory = classification.category;

    // 5. Domestic Geocoding resolution (Headline priority + victim residence exclusion)
    const geocode = await resolveLocationFromText(item.title, item.contentSnippet || '');
    const wireInfo = isWireSyndicatedStory(canonicalUrl, item.sourceName, item.contentSnippet || '', item.title);
    const isWire = wireInfo.isWire;
    const wireAgency = wireInfo.agency || null;
    const initialVerificationStage: any = isWire ? 'WIRE_SYNDICATED' : 'SINGLE_SOURCE_PRESS';

    // 6. Strict 6-Stage Active Threat Eligibility Evaluation
    const eligibility = evaluateActiveThreatEligibility({
      title: item.title,
      summary: item.contentSnippet || '',
      category: finalCategory,
      severity: classification.severity,
      isSafetyRelated: classification.isSafetyRelated,
      disqualifiedReason: classification.disqualifiedReason,
      geocode,
      publishedAt,
      sourceUrl: canonicalUrl,
      sourceName: item.sourceName,
      isWire,
      confidence: classification.confidence,
    });

    if (!eligibility.isEligibleForActiveMap || !geocode) {
      if (runRecorder && !geocode) runRecorder.recordGeocodingFailure();
      // Stage non-active / historical / follow-up / unresolvable article without creating live map pin
      try {
        await prisma.newsArticle.create({
          data: {
            guid,
            title: item.title,
            sourceUrl: canonicalUrl,
            sourceName: item.sourceName,
            publishedAt,
            category: finalCategory,
            severity: classification.severity,
            latitude: geocode?.latitude || 0,
            longitude: geocode?.longitude || 0,
            reportId: null,
            isWireSyndicated: isWire,
            wireAgency,
          },
        });
        existingGuidSet.add(guid);
        existingUrlSet.add(canonicalUrl);
      } catch {
        // Skip on duplicate error
      }
      skipped++;
      continue;
    }

    if (runRecorder) runRecorder.recordGeocodingSuccess();

    // 7. Expiration: Category-specific active lifecycle
    const expiresAt = eligibility.calculatedExpiry;

    // 8. Clean headline and content
    const cleanTitle = cleanIncidentTitle(item.title);
    const cleanDesc = cleanIncidentTitle(item.contentSnippet || item.title);

    // 7. Concurrency-Safe Cross-Outlet Semantic Deduplication & Persistence
    const lockKey = candidateLock.getLockKey(geocode.district, geocode.latitude, geocode.longitude);

    await candidateLock.runExclusive(lockKey, async () => {
      // Re-check GUID and URL inside lock to catch items processed milliseconds earlier by concurrent feeds
      if (existingGuidSet.has(guid) || existingUrlSet.has(canonicalUrl)) {
        skipped++;
        if (runRecorder) runRecorder.recordDuplicateRejection();
        return;
      }

      const duplicateMatch = await findDuplicateActiveReport({
        title: cleanTitle,
        category: finalCategory,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        district: geocode.district,
        upazila: geocode.upazila,
        locationPrecision: geocode.locationPrecision,
        publishedAt,
        summary: cleanDesc,
        isWireSyndicated: isWire,
        wireAgency,
      });

      if (duplicateMatch) {
        const { existingReport, sharedTokens } = duplicateMatch;
        console.log(
          `[News Crawler] 🔄 Consolidated duplicate story from "${item.sourceName}": "${cleanTitle.substring(0, 60)}..." -> Merged with Report ${existingReport.id} (Shared: ${sharedTokens.join(', ')})`
        );

        // Create NewsArticle record linked to existingReport.id (multi-source consolidation)
        await prisma.newsArticle.create({
          data: {
            guid,
            title: item.title,
            sourceUrl: canonicalUrl,
            sourceName: item.sourceName,
            publishedAt,
            category: finalCategory,
            severity: classification.severity,
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            reportId: existingReport.id,
            isWireSyndicated: isWire,
            wireAgency,
          },
        });

        // Format source names to credit multiple outlets
        const currentSources = existingReport.sourceName || '';
        const cleanOutlet = item.sourceName.replace(/^Google News BD[^:]*:\s*/i, '').trim();
        let updatedSources = currentSources;
        if (cleanOutlet && !currentSources.includes(cleanOutlet)) {
          updatedSources = `${currentSources}, ${cleanOutlet}`.replace(/^,\s*/, '');
        }

        // Preserve structured citations array
        const existingCitations: any[] = Array.isArray(existingReport.citations)
          ? (existingReport.citations as any[])
          : existingReport.sourceUrl
            ? [
                {
                  sourceName: (existingReport.sourceName || 'Press').replace(/^Google News BD[^:]*:\s*/i, '').trim(),
                  sourceUrl: existingReport.sourceUrl,
                  title: cleanIncidentTitle(existingReport.description?.split('\n')[0] || ''),
                },
              ]
            : [];

        const newCitation = {
          sourceName: cleanOutlet || item.sourceName,
          sourceUrl: canonicalUrl,
          title: cleanTitle,
          publishedAt: publishedAt.toISOString(),
          isWire,
          wireAgency,
        };

        const incomingDomain = resolvePublisherDomain(canonicalUrl, item.sourceName);
        const priorDomains = existingCitations.map((c) => resolvePublisherDomain(c.sourceUrl, c.sourceName));
        const isDifferentPublisher = incomingDomain !== 'unknown' && !priorDomains.includes(incomingDomain);

        if (!existingCitations.some((c) => c.sourceUrl === canonicalUrl)) {
          existingCitations.push(newCitation);
        }

        // Stage promotion logic & wire syndication trust protection:
        let nextStage: any = existingReport.verificationStage;
        let upvoteIncrement = 0;

        if (existingReport.verificationStage === 'ADMIN_VERIFIED') {
          nextStage = 'ADMIN_VERIFIED';
        } else if (isWire) {
          // Wire stories never advance to corroborated stage and never inflate upvotes
          nextStage = existingReport.verificationStage;
          upvoteIncrement = 0;
        } else {
          if (isDifferentPublisher) {
            nextStage = 'PRESS_CORROBORATED';
            upvoteIncrement = 2; // Genuine multi-press verification confidence boost
          } else if (existingReport.verificationStage === 'CLASSIFIED') {
            nextStage = 'CORROBORATED';
          }
        }

        // If existing report was misclassified as ROAD_ACCIDENT, but a corroborating outlet confirms
        // a specific crime or violent clash (ARMED_ASSAULT, THEFT, ROBBERY, etc.), elevate to specific category:
        const updatedCategory =
          existingReport.category === 'ROAD_ACCIDENT' && finalCategory !== 'ROAD_ACCIDENT'
            ? finalCategory
            : existingReport.category;

        // Coordinate upgrade logic:
        let newLat = existingReport.latitude;
        let newLng = existingReport.longitude;
        let newPrecision = existingReport.locationPrecision || 'UPAZILA';
        let newDistrict = existingReport.district;
        let newUpazila = existingReport.upazila;

        if (duplicateMatch.shouldUpgradeCoords && duplicateMatch.newCoords) {
          newLat = duplicateMatch.newCoords.latitude;
          newLng = duplicateMatch.newCoords.longitude;
          newPrecision = 'UPAZILA';
          if (duplicateMatch.newCoords.district) newDistrict = duplicateMatch.newCoords.district;
          if (duplicateMatch.newCoords.upazila) newUpazila = duplicateMatch.newCoords.upazila;
          await setReportLocation(prisma, existingReport.id, newLat, newLng);
        }

        await prisma.report.update({
          where: { id: existingReport.id },
          data: {
            category: updatedCategory,
            sourceName: updatedSources,
            ...(upvoteIncrement > 0 ? { upvotes: { increment: upvoteIncrement } } : {}),
            verificationStage: nextStage,
            citations: existingCitations,
            latitude: newLat,
            longitude: newLng,
            locationPrecision: newPrecision,
            district: newDistrict,
            upazila: newUpazila,
          },
        });

        // Add a context update linking the confirming news outlet
        await prisma.reportUpdate.create({
          data: {
            reportId: existingReport.id,
            userId: botUserId,
            content: `অতিরিক্ত প্রেস নিশ্চিতকরণ (${cleanOutlet || item.sourceName}): "${cleanTitle}"`,
          },
        });

        // Emit real-time REPORT_ENRICHED event only for active ongoing threats
        if (isActiveThreatIncident(existingReport as any)) {
          emitReportEnriched({
            id: existingReport.id,
            category: updatedCategory,
            severity: existingReport.severity,
            latitude: newLat,
            longitude: newLng,
            description: existingReport.description,
            upvotes: (existingReport.upvotes || 0) + upvoteIncrement,
            downvotes: existingReport.downvotes || 0,
            status: existingReport.status,
            expiresAt: existingReport.expiresAt,
            createdAt: existingReport.createdAt,
            sourceUrl: existingReport.sourceUrl,
            sourceName: updatedSources,
            isGpsVerified: existingReport.isGpsVerified,
            verificationStage: nextStage,
            citations: existingCitations,
            locationPrecision: newPrecision,
            district: newDistrict,
            upazila: newUpazila,
            threatStatus: existingReport.threatStatus,
          });
        }

        existingGuidSet.add(guid);
        existingUrlSet.add(canonicalUrl);
        skipped++;
        if (runRecorder) runRecorder.recordDuplicateRejection();
        return;
      }

      const initialCitations = [
        {
          sourceName: item.sourceName.replace(/^Google News BD[^:]*:\s*/i, '').trim() || item.sourceName,
          sourceUrl: canonicalUrl,
          title: cleanTitle,
          publishedAt: publishedAt.toISOString(),
          isWire,
          wireAgency,
        },
      ];

      // Atomically create report, populate PostGIS location, and persist news article metadata
      const report = await prisma.$transaction(async (tx) => {
        const createdReport = await tx.report.create({
          data: {
            userId: botUserId,
            category: finalCategory,
            severity: classification.severity,
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            description: cleanDesc,
            sourceUrl: canonicalUrl,
            sourceName: item.sourceName,
            verificationStage: initialVerificationStage,
            citations: initialCitations,
            expiresAt,
            locationPrecision: geocode.locationPrecision || 'UPAZILA',
            district: geocode.district,
            upazila: geocode.upazila,
            threatStatus: 'ACTIVE',
          },
        });

        await setReportLocation(tx, createdReport.id, geocode.latitude, geocode.longitude);

        await tx.newsArticle.create({
          data: {
            guid,
            title: item.title,
            sourceUrl: canonicalUrl,
            sourceName: item.sourceName,
            publishedAt,
            category: finalCategory,
            severity: classification.severity,
            latitude: geocode.latitude,
            longitude: geocode.longitude,
            reportId: createdReport.id,
            isWireSyndicated: isWire,
            wireAgency,
          },
        });

        return createdReport;
      });

      existingGuidSet.add(guid);
      existingUrlSet.add(canonicalUrl);
      ingested++;
      if (runRecorder) runRecorder.recordNewIncident();

      // 7. Cross-Verification with active citizen reports
      const verifyResult = await crossVerifyCitizenReports({
        id: report.id,
        category: report.category,
        latitude: report.latitude,
        longitude: report.longitude,
        sourceName: item.sourceName,
        sourceUrl: canonicalUrl,
        title: item.title,
      });
      verifiedMatches += verifyResult.matchedCount;
      if (runRecorder && verifyResult.matchedCount > 0) {
        runRecorder.recordVerifiedMatches(verifyResult.matchedCount);
        // Automatically advance verificationStage to COMMUNITY_CONFIRMED when citizen report matches
        await prisma.report.update({
          where: { id: report.id },
          data: { verificationStage: 'COMMUNITY_CONFIRMED' },
        });
        if (verifyResult.verifiedReportIds.length > 0) {
          await prisma.report.updateMany({
            where: { id: { in: verifyResult.verifiedReportIds } },
            data: { verificationStage: 'COMMUNITY_CONFIRMED' },
          });
        }
      }

      // 8. Real-time broadcast
      if (isActiveThreatIncident(report as any)) {
        emitNewReport({
          id: report.id,
          category: report.category,
          severity: report.severity,
          latitude: report.latitude,
          longitude: report.longitude,
          description: report.description,
          upvotes: report.upvotes,
          downvotes: report.downvotes,
          status: report.status,
          expiresAt: report.expiresAt,
          createdAt: report.createdAt,
          sourceUrl: report.sourceUrl,
          sourceName: report.sourceName,
          isGpsVerified: report.isGpsVerified,
          verificationStage: report.verificationStage,
          citations: report.citations,
          locationPrecision: report.locationPrecision,
          district: report.district,
          upazila: report.upazila,
          threatStatus: report.threatStatus,
        });
      }
    });
  }

  if (ingested > 0) {
    void broadcastPlatformStats();
  }

  return { ingested, skipped, verifiedMatches };
};

/**
 * Crawls all configured public RSS feeds across Bangladesh and ingests verified incident stories
 */
const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    if (typeof val._ === 'string') return val._.trim();
    if (typeof val.value === 'string') return val.value.trim();
    if (typeof val.$t === 'string') return val.$t.trim();
    try {
      return JSON.stringify(val);
    } catch {
      return '';
    }
  }
  return String(val).trim();
};

export const crawlAllNewsFeeds = async (
  feeds: FeedConfig[] = PUBLIC_NEWS_FEEDS
): Promise<{
  feedsChecked: number;
  totalIngested: number;
  totalSkipped: number;
  totalVerifiedMatches: number;
  runId: string;
  durationMs: number;
}> => {
  const runRecorder = newsObservabilityService.startRun();
  let totalIngested = 0;
  let totalSkipped = 0;
  let totalVerifiedMatches = 0;
  let feedsChecked = 0;

  const fetchAndProcessSingleFeed = async (feedConfig: FeedConfig) => {
    // SSRF boundary validation before any network connection
    const safety = await validateUrlForSafeFetch(feedConfig.url);
    if (!safety.isSafe) {
      console.warn(`[News Crawler] Blocked unsafe feed URL "${feedConfig.name}" (${feedConfig.url}): ${safety.reason}`);
      return;
    }

    feedsChecked++;
    const feedStartTime = Date.now();
    const timeoutMs = feedConfig.timeoutMs || 10000;

    try {
      const parsePromise = (async () => {
        // Try fetching raw text first to sanitize XML (handles The Daily Star encoding artifacts)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          const resp = await fetch(feedConfig.url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'DangerZoneBD-PublicSafetyNewsCrawler/1.0 (contact@dangerzonebd.org)',
            },
          });
          clearTimeout(timeoutId);

          if (resp.status === 429) {
            if (feedConfig.url.includes('news.google.com')) {
              recordGoogleNewsFailure(true);
            }
            throw new Error(`HTTP 429 Too Many Requests from ${feedConfig.url}`);
          }
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
          }

          const contentLength = Number(resp.headers.get('content-length'));
          if (contentLength && contentLength > MAX_FEED_RESPONSE_BYTES) {
            throw new Error(`Feed response size ${contentLength} bytes exceeds limit ${MAX_FEED_RESPONSE_BYTES} bytes`);
          }

          const rawText = await resp.text();
          if (rawText.length > MAX_FEED_RESPONSE_BYTES) {
            throw new Error(`Feed response text length ${rawText.length} exceeds limit ${MAX_FEED_RESPONSE_BYTES} bytes`);
          }

          const cleanXml = sanitizeXmlString(rawText);
          return await parser.parseString(cleanXml);
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') {
            throw new Error(`Feed fetch timed out after ${timeoutMs}ms`);
          }
          if (fetchErr.message?.includes('429')) {
            throw fetchErr;
          }
          // Fallback to parser.parseURL in environments or mocks that mock parser directly
          return await parser.parseURL(feedConfig.url);
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Feed fetch timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      const feed = await Promise.race([parsePromise, timeoutPromise]);
      const latencyMs = Date.now() - feedStartTime;

      const items: RawNewsItem[] = (feed.items || []).map((item: any) => {
        const rawLink = safeString(item.link);
        const canonicalLink = normalizeCanonicalUrl(rawLink);
        return {
          guid: safeString(item.guid || canonicalLink || item.title),
          title: safeString(item.title),
          link: canonicalLink,
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          contentSnippet: safeString(item.contentSnippet || item.content),
          sourceName: feedConfig.name,
          categoryHint: feedConfig.categoryHint || feedConfig.category,
        };
      });

      const result = await processAndIngestNewsItems(items, runRecorder);
      totalIngested += result.ingested;
      totalSkipped += result.skipped;
      totalVerifiedMatches += result.verifiedMatches;

      runRecorder.recordFeedExecution({
        feedName: feedConfig.name,
        category: feedConfig.category,
        url: feedConfig.url,
        status: 'SUCCESS',
        latencyMs,
        itemsFetched: items.length,
      });

      if (feedConfig.url.includes('news.google.com')) {
        recordGoogleNewsSuccess();
      }
    } catch (feedErr: any) {
      if (feedConfig.url.includes('news.google.com')) {
        recordGoogleNewsFailure(false);
      }
      const latencyMs = Date.now() - feedStartTime;
      const isTimeout = feedErr?.message?.includes('timed out');
      console.warn(`[News Crawler] Failed to fetch feed "${feedConfig.name}":`, feedErr?.message || feedErr);

      runRecorder.recordFeedExecution({
        feedName: feedConfig.name,
        category: feedConfig.category,
        url: feedConfig.url,
        status: isTimeout ? 'TIMEOUT' : 'FAILED',
        latencyMs,
        itemsFetched: 0,
        errorMessage: feedErr?.message || String(feedErr),
      });
      // Isolated failure handling: continuing crawl loop without aborting
    }
  };

  if (feeds !== PUBLIC_NEWS_FEEDS) {
    // Custom/targeted feeds (e.g. hermetic test mode)
    for (const feedConfig of feeds) {
      await fetchAndProcessSingleFeed(feedConfig);
    }
  } else {
    // Production scheduled crawl:
    // 1. Direct Publisher RSS Feeds (Dhaka Tribune, Dainik Azadi, Jagonews24, Prothom Alo, Daily Star)
    console.log('[News Crawler] 📰 Ingesting direct publisher feeds in parallel...');
    const directFeedConfigs: FeedConfig[] = DIRECT_PUBLISHER_FEEDS.map((df: DirectFeedDefinition) => ({
      name: df.name,
      category: 'ROAD_ACCIDENT' as ReportCategory,
      categoryHint: 'ROAD_ACCIDENT' as ReportCategory,
      url: df.url,
      timeoutMs: 12000,
    }));

    await Promise.allSettled(directFeedConfigs.map((df) => fetchAndProcessSingleFeed(df)));

    // 2. Google News Regional Discovery with Circuit Breaker and 10-Cluster Rotation
    if (checkGoogleNewsCircuit()) {
      const [clusterA, clusterB] = getNextClusterPair();
      console.log(`[News Crawler] 🌐 Executing Google News Regional Discovery for clusters: ${clusterA} + ${clusterB}`);
      const clusterFeeds = [...buildClusterFeeds(clusterA), ...buildClusterFeeds(clusterB)];

      for (const cFeed of clusterFeeds) {
        await sleepJitter(1500, 2500);
        await fetchAndProcessSingleFeed(cFeed);
      }
    } else {
      console.log(
        `[News Crawler] 🔌 Google News Circuit Breaker is OPEN (cooldown until ${new Date(circuitBreaker.openUntil).toISOString()}). Direct publisher feeds completed successfully.`
      );
    }
  }

  const completedRun = runRecorder.complete();

  return {
    feedsChecked,
    totalIngested,
    totalSkipped,
    totalVerifiedMatches,
    runId: completedRun.runId,
    durationMs: completedRun.durationMs,
  };
};
