import { ReportCategory, ReportSeverity } from '@prisma/client';

export interface ClassifiedNews {
  isSafetyRelated: boolean;
  category: ReportCategory;
  severity: ReportSeverity;
  matchedKeywords: string[];
}

const CATEGORY_KEYWORDS: Record<ReportCategory, string[]> = {
  MUGGING: [
    'ছিনতাই',
    'ছিনতাইকারী',
    'ধারালো অস্ত্র',
    'কোপানো',
    'ছুরিকাঘাত',
    'ছুরি',
    'কোপাল',
    'mugging',
    'mugger',
    'snatching',
    'snatcher',
    'stabbed',
    'stabbing',
    'knife attack',
  ],
  THEFT: [
    'চুরি',
    'চোর',
    'ডাকাতি',
    'ডাকাত',
    'লুট',
    'সিন্দুক',
    'লুণ্ঠন',
    'theft',
    'thief',
    'thieves',
    'robbery',
    'robbers',
    'burglary',
    'burgled',
    'stolen',
    'looted',
  ],
  EXTORTION: [
    'চাঁদাবাজি',
    'চাঁদা',
    'কিশোর গ্যাং',
    'মারধর',
    'মারপিট',
    'দখল',
    'extortion',
    'extortionist',
    'extorted',
    'gang violence',
    'teenage gang',
    'assault',
    'clash',
  ],
  DRUG_ACTIVITY: [
    'মাদক',
    'ইয়াবা',
    'গাঁজা',
    'ফেনসিডিল',
    'হেরোইন',
    'মাদক কারবারি',
    'মাদকদ্রব্য',
    'narcotics',
    'yaba',
    'drug peddler',
    'drug dealer',
    'drugs seized',
    'phensedyl',
    'heroin',
    'cannabis',
  ],
  UNLIT_ROAD: [
    'সড়ক দুর্ঘটনা',
    'দুর্ঘটনা',
    'ভাঙা রাস্তা',
    'খানাখন্দ',
    'গর্ত',
    'আগুন',
    'অগ্নিকাণ্ড',
    'অন্ধকার',
    'বাতি নেই',
    'অন্ধকার রাস্তা',
    'সড়ক বাতি',
    'স্ট্রিট লাইট',
    'ঝুঁকিপূর্ণ সড়ক',
    'road accident',
    'deadly crash',
    'collision',
    'overturned',
    'fire',
    'blaze',
    'gas leak',
    'collapsed',
    'unlit',
    'dark street',
    'street light',
    'blackout',
  ],
};

const HIGH_SEVERITY_KEYWORDS = [
  'নিহত',
  'মৃত',
  'লাশ',
  'গুলিবিদ্ধ',
  'গুলি',
  'বন্দুক',
  'অস্ত্র',
  'অস্ত্রধারী',
  'বোমা',
  'কোপানো',
  'খুন',
  'হত্যা',
  'ডাকাতি',
  'dead',
  'killed',
  'murdered',
  'fatal',
  'fatality',
  'shot dead',
  'firearm',
  'bomb',
  'blast',
  'armed',
  'robbery',
  'kidnap',
  'kidnapped',
];

const MEDIUM_SEVERITY_KEYWORDS = [
  'আহত',
  'আটক',
  'গ্রেফতার',
  'লুট',
  'ছিনতাই',
  'হামলা',
  'মারধর',
  'চুরি',
  'চোর',
  'হুমকি',
  'চাঁদাবাজি',
  'চাঁদা',
  'injured',
  'hospitalized',
  'arrested',
  'arrest',
  'seized',
  'seize',
  'robbed',
  'snatched',
  'theft',
  'stolen',
  'burglary',
  'clash',
  'extortion',
];

/**
 * Classifies an article's headline and summary into a public safety category and severity level.
 * Supports both Bangla and English news content.
 */
export const classifyNewsText = (title: string, summary: string = ''): ClassifiedNews => {
  const combinedText = `${title} ${summary}`.toLowerCase();
  const matchedKeywords: string[] = [];

  let matchedCategory: ReportCategory | null = null;
  let maxCategoryMatches = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ReportCategory, string[]][]) {
    let count = 0;
    for (const kw of keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        count++;
        matchedKeywords.push(kw);
      }
    }
    if (count > maxCategoryMatches) {
      maxCategoryMatches = count;
      matchedCategory = category;
    }
  }

  if (!matchedCategory || maxCategoryMatches === 0) {
    return {
      isSafetyRelated: false,
      category: 'MUGGING',
      severity: 'LOW',
      matchedKeywords: [],
    };
  }

  // Determine Severity
  let severity: ReportSeverity = 'LOW';
  for (const kw of HIGH_SEVERITY_KEYWORDS) {
    if (combinedText.includes(kw.toLowerCase())) {
      severity = 'HIGH';
      break;
    }
  }

  if (severity !== 'HIGH') {
    for (const kw of MEDIUM_SEVERITY_KEYWORDS) {
      if (combinedText.includes(kw.toLowerCase())) {
        severity = 'MEDIUM';
        break;
      }
    }
  }

  return {
    isSafetyRelated: true,
    category: matchedCategory,
    severity,
    matchedKeywords,
  };
};
