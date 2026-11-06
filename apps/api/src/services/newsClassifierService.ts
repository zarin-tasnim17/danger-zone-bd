import { ReportCategory, ReportSeverity } from '@prisma/client';

export interface ClassifiedNews {
  isSafetyRelated: boolean;
  category: ReportCategory;
  severity: ReportSeverity;
  matchedKeywords: string[];
}

const CATEGORY_KEYWORDS: Record<ReportCategory, string[]> = {
  THEFT: [
    'চুরি',
    'চোর',
    'সিঁধেল চুরি',
    'গাড়ি চুরি',
    'টাকা চুরি',
    'মোটরসাইকেল চুরি',
    'স্বর্ণালঙ্কার চুরি',
    'theft',
    'thief',
    'thieves',
    'burglary',
    'burgled',
    'stolen',
  ],
  ROBBERY: [
    'ডাকাতি',
    'ডাকাত দল',
    'ডাকাত',
    'সশস্ত্র ডাকাত',
    'লুণ্ঠন',
    'লুটপাট',
    'সিন্দুক ভেঙে',
    'গৃহকর্তাকে বেঁধে',
    'robbery',
    'robbers',
    'armed robbery',
    'robbers looted',
    'gang robbery',
    'home invasion',
    'dacoity',
    'dacoits',
  ],
  THEFT_ROBBERY: [
    'চুরি ও ডাকাতি',
    'চুরি ডাকাতি',
    'theft and robbery',
    'burglary and robbery',
  ],
  SNATCHING: [
    'ছিনতাই',
    'ছিনতাইকারী',
    'ব্যাগ টান',
    'ব্যাগ ছিনতাই',
    'মোবাইল ছিনতাই',
    'snatching',
    'snatcher',
    'mugging',
    'mugger',
    'bag snatched',
    'phone snatched',
  ],
  ARMED_ASSAULT: [
    'অস্ত্রসহ হামলা',
    'ধারালো অস্ত্র',
    'কোপানো',
    'কুপিয়ে জখম',
    'ছুরিকাঘাত',
    'ছুরি মেরে',
    'গুলিবিদ্ধ',
    'গুলি বর্ষণ',
    'আগ্নেয়াস্ত্র',
    'বন্দুকধারী',
    'বোমা হামলা',
    'knife attack',
    'stabbed',
    'stabbing',
    'machete attack',
    'gunfire',
    'armed attack',
    'shot and injured',
    'bomb attack',
  ],
  SNATCHING_ARMED_ASSAULT: [
    'ছিনতাই ও হামলা',
    'ছিনতাইকালে কুপিয়ে',
    'ছিনতাইকালে গুলি',
    'ছিনতাই ও কোপানো',
    'armed mugging',
    'violent snatching',
    'armed snatching',
  ],
  EXTORTION: [
    'চাঁদাবাজি',
    'চাঁদা দাবি',
    'চাঁদাবাজ',
    'দখলবাজি',
    'দখল',
    'অবৈধ চাঁদা',
    'চাঁদা না দেওয়ায়',
    'extortion',
    'extortionist',
    'extorted',
    'protection money',
    'illegal toll',
  ],
  YOUTH_GANG_ACTIVITY: [
    'কিশোর গ্যাং',
    'কিশোর গ্যাংয়ের',
    'কিশোর অপরাধী',
    'কিশোরদের মারামারি',
    'কিশোর গ্যাংয়ের মহড়া',
    'কিশোর গ্যাংয়ের হামলা',
    'youth gang',
    'youth gang activity',
    'teenage gang',
    'teen gang',
    'juvenile delinquency',
  ],
  DRUG_RELATED_CRIME: [
    'মাদক',
    'ইয়াবা',
    'গাঁজা',
    'ফেনসিডিল',
    'হেরোইন',
    'মাদক কারবারি',
    'মাদকদ্রব্য',
    'আইস',
    'ট্যাপেন্টাডল',
    'মাদকের আড্ডা',
    'drug related crime',
    'narcotics',
    'yaba',
    'drug peddler',
    'drug dealer',
    'drugs seized',
    'phensedyl',
    'heroin',
    'cannabis',
    'meth',
  ],
  UNLIT_ROAD: [
    'অন্ধকার রাস্তা',
    'বাতি নেই',
    'বাতি বন্ধ',
    'স্ট্রিট লাইট নষ্ট',
    'সড়ক বাতি নেই',
    'অন্ধকার সড়ক',
    'ভাঙা রাস্তা',
    'খানাখন্দ',
    'বিপজ্জনক গর্ত',
    'ম্যানহোল খোলা',
    'ঝুঁকিপূর্ণ সড়ক',
    'unlit',
    'unlit road',
    'dark street',
    'street light off',
    'blackout',
    'broken road',
    'pothole hazard',
    'open manhole',
  ],
  ROAD_ACCIDENT: [
    'সড়ক দুর্ঘটনা',
    'সড়ক দুর্ঘটনায়',
    'দুর্ঘটনা',
    'বাস উল্টে',
    'ট্রাক ধাক্কা',
    'সংঘর্ষ',
    'মুখোমুখি সংঘর্ষ',
    'মোটরসাইকেল দুর্ঘটনা',
    'ট্রেন দুর্ঘটনা',
    'ট্রেন ও সড়ক দুর্ঘটনা',
    'অটোরিকশা দুর্ঘটনা',
    'চাপা পড়ে নিহত',
    'চাপা দিয়েছে',
    'road accident',
    'traffic accident',
    'deadly crash',
    'collision',
    'overturned',
    'hit and run',
    'car crash',
    'bus crash',
    'train crash',
  ],
  // Legacy aliases
  MUGGING: [
    'ছিনতাই',
    'mugging',
  ],
  DACOITY: [
    'ডাকাতি',
    'dacoity',
  ],
  THEFT_DACOITY: [
    'চুরি ডাকাতি',
  ],
  TEEN_GANG: [
    'কিশোর গ্যাং',
  ],
  TEEN_GANG_ARMED_ASSAULT: [
    'কিশোর গ্যাং অস্ত্র',
  ],
  DRUG_ACTIVITY: [
    'মাদক',
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
 * Supports both Bangla and English news content with smart combination resolution.
 */
export const classifyNewsText = (title: string, summary: string = ''): ClassifiedNews => {
  const combinedText = `${title} ${summary}`.toLowerCase();
  const matchedKeywords: string[] = [];

  const categoryScores: Partial<Record<ReportCategory, number>> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ReportCategory, string[]][]) {
    let count = 0;
    for (const kw of keywords) {
      if (combinedText.includes(kw.toLowerCase())) {
        count++;
        matchedKeywords.push(kw);
      }
    }
    if (count > 0) {
      categoryScores[category] = count;
    }
  }

  // Detect Smart Combinations
  const hasTheft = (categoryScores['THEFT'] || 0) > 0;
  const hasRobbery = (categoryScores['ROBBERY'] || 0) > 0 || (categoryScores['DACOITY'] || 0) > 0;
  const hasSnatching = (categoryScores['SNATCHING'] || 0) > 0 || (categoryScores['MUGGING'] || 0) > 0;
  const hasArmedAssault = (categoryScores['ARMED_ASSAULT'] || 0) > 0;

  let resolvedCategory: ReportCategory | null = null;

  if (hasTheft && hasRobbery) {
    resolvedCategory = 'THEFT_ROBBERY';
  } else if (hasSnatching && hasArmedAssault) {
    resolvedCategory = 'SNATCHING_ARMED_ASSAULT';
  } else {
    // Pick category with highest score (prefer primary forms over legacy aliases)
    let maxScore = 0;
    for (const [cat, score] of Object.entries(categoryScores) as [ReportCategory, number][]) {
      if (score > maxScore) {
        maxScore = score;
        resolvedCategory = cat;
      }
    }
  }

  // Map legacy aliases to primary forms
  if (resolvedCategory === 'MUGGING') resolvedCategory = 'SNATCHING';
  if (resolvedCategory === 'DACOITY') resolvedCategory = 'ROBBERY';
  if (resolvedCategory === 'THEFT_DACOITY') resolvedCategory = 'THEFT_ROBBERY';
  if (resolvedCategory === 'TEEN_GANG') resolvedCategory = 'YOUTH_GANG_ACTIVITY';
  if (resolvedCategory === 'DRUG_ACTIVITY') resolvedCategory = 'DRUG_RELATED_CRIME';

  if (!resolvedCategory) {
    return {
      isSafetyRelated: false,
      category: 'ROAD_ACCIDENT',
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
    category: resolvedCategory,
    severity,
    matchedKeywords,
  };
};
