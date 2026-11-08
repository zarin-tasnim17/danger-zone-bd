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
    'সংঘর্ষ',
    'দুই পক্ষের সংঘর্ষ',
    'দুপক্ষের সংঘর্ষ',
    'পক্ষের সংঘর্ষ',
    'মারামারি',
    'মারধর',
    'হামলা',
    'হামলা ও সংঘর্ষ',
    'হামলা-ভাঙচুর',
    'ধাওয়া-পাল্টাধাওয়া',
    'ধাওয়া পাল্টা ধাওয়া',
    'টিয়ারশেল',
    'ককটেল বিস্ফোরণ',
    'ককটেল',
    'গাড়িতে আগুন',
    'ভাঙচুর',
    'আক্রমণ',
    'knife attack',
    'stabbed',
    'stabbing',
    'machete attack',
    'gunfire',
    'armed attack',
    'shot and injured',
    'bomb attack',
    'clash',
    'clashes',
    'violent clash',
    'factional clash',
    'mob clash',
    'riot',
    'assault',
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
    'গাড়ি দুর্ঘটনা',
    'বাস উল্টে',
    'ট্রাক ধাক্কা',
    'বাস-ট্রাক সংঘর্ষ',
    'মুখোমুখি সংঘর্ষ',
    'সংঘর্ষে নিহত',
    'সংঘর্ষে আহত',
    'পিকআপের সংঘর্ষ',
    'পিকআপ সংঘর্ষ',
    'ট্রাক-পিকআপ সংঘর্ষ',
    'ট্রাক-পিকআপের সংঘর্ষ',
    'ট্রাক-পিকআপ মুখোমুখি সংঘর্ষ',
    'বাস-পিকআপ সংঘর্ষ',
    'পিকআপ-ড্রাম ট্রাকের সংঘর্ষ',
    'ড্রাম ট্রাক',
    'গাড়ির সংঘর্ষ',
    'লরির সংঘর্ষ',
    'মোটরসাইকেলের সংঘর্ষ',
    'সিএনজি সংঘর্ষ',
    'অটোরিকশা সংঘর্ষ',
    'কাভার্ডভ্যান সংঘর্ষ',
    'ভ্যানের সংঘর্ষ',
    'গাড়ি চাপায়',
    'গাড়ি উল্টে',
    'ট্রাক উল্টে',
    'পিকআপ উল্টে',
    'যানবাহন সংঘর্ষ',
    'মোটরসাইকেল দুর্ঘটনা',
    'অটোরিকশা দুর্ঘটনা',
    'ট্রেন দুর্ঘটনা',
    'চাপা পড়ে নিহত',
    'চাপা দিয়ে নিহত',
    'চাপা দিয়েছে',
    'road accident',
    'traffic accident',
    'deadly crash',
    'car crash',
    'bus crash',
    'truck crash',
    'train crash',
    'vehicle collision',
    'head-on collision',
    'head on collision',
    'collision between',
    'road crash',
    'highway crash',
    'hit and run',
    'overturned bus',
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

const VEHICLE_KEYWORDS = [
  'ট্রাক',
  'পিকআপ',
  'বাস',
  'মাইক্রোবাস',
  'সিএনজি',
  'অটোরিকশা',
  'লরি',
  'কাভার্ডভ্যান',
  'মোটরসাইকেল',
  'বাইক',
  'টমটম',
  'ভ্যান',
  'ইজিবাইক',
  'নসিমন',
  'করিমন',
  'ড্রাম ট্রাক',
  'কার',
  'প্রাইভেটকার',
  'অ্যাম্বুলেন্স',
  'ট্রেন',
  'গাড়ি',
  'গাড়ির',
  'গাড়িতে',
  'যানবাহন',
  'truck',
  'pickup',
  'bus',
  'microbus',
  'cng',
  'autorickshaw',
  'lorry',
  'motorcycle',
  'bike',
  'van',
  'ambulance',
  'train',
  'vehicle',
  'car',
];

const VIOLENT_FACTION_KEYWORDS = [
  'বিএনপি',
  'আওয়ামী',
  'আওয়ামী লীগ',
  'ছাত্রলীগ',
  'ছাত্রদল',
  'যুবলীগ',
  'জামায়াত',
  'শিবির',
  'দুই পক্ষ',
  'দুপক্ষ',
  'দুই দলের',
  'পক্ষের সংঘর্ষ',
  'রাজনৈতিক সংঘর্ষ',
  'দলাদলি',
  'মারামারি',
  'মারধর',
  'ককটেল',
  'টিয়ারশেল',
  'টিয়ারশেল',
  'আগ্নেয়াস্ত্র',
  'আগ্নেয়াস্ত্র',
  'বন্দুকধারী',
  'গুলিবিদ্ধ',
  'গুলি বর্ষণ',
  'ধারালো অস্ত্র',
  'কোপানো',
  'কুপিয়ে',
  'ছুরিকাঘাত',
  'ছুরি মেরে',
  'অস্ত্রসহ হামলা',
  'ভাঙচুর',
  'শ্রমিক-পুলিশ',
  'শ্রমিকদের সঙ্গে পুলিশের',
  'পুলিশ-শ্রমিক',
  'পোশাকশ্রমিক',
  'পোশাক শ্রমিক',
  'শ্রমিক আন্দোলন',
  'বিক্ষোভ',
  'রণক্ষেত্র',
  'অবরোধ',
  'গাড়িতে আগুন',
  'গাড়িতে অগ্নিসংযোগ',
  'বাসে আগুন',
  'আগুন জ্বালিয়ে',
  'আগুন দিয়ে',
  'knife attack',
  'stabbing',
  'machete',
  'gunfire',
  'armed clash',
  'political clash',
  'factional clash',
  'protest clash',
  'police clash',
  'arson',
];

/**
 * Classifies an article's headline and summary into a public safety category and severity level.
 * Supports both Bangla and English news content with smart combination resolution.
 */
export const classifyNewsText = (title: string, summary: string = ''): ClassifiedNews => {
  // Normalize Unicode (NFC) to handle decomposed nuktas (e.g. ড+় vs ড়) across different Bengali news sources
  const combinedText = `${title} ${summary}`.normalize('NFC').toLowerCase();
  const matchedKeywords: string[] = [];

  const categoryScores: Partial<Record<ReportCategory, number>> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [ReportCategory, string[]][]) {
    let count = 0;
    for (const kw of keywords) {
      const normalizedKw = kw.normalize('NFC').toLowerCase();
      if (combinedText.includes(normalizedKw)) {
        count++;
        matchedKeywords.push(kw);
      }
    }
    if (count > 0) {
      categoryScores[category] = count;
    }
  }

  // Distinguish vehicular collisions from violent armed/political clashes:
  // In Bengali, vehicular crashes are often titled "মুখোমুখি সংঘর্ষ" or "বাস-ট্রাক সংঘর্ষ".
  // If the story involves vehicles and NO human violent faction/weapon/protest terms, it must resolve to ROAD_ACCIDENT.
  const hasVehicle = VEHICLE_KEYWORDS.some((vk) => combinedText.includes(vk.normalize('NFC').toLowerCase()));
  const hasViolentFaction = VIOLENT_FACTION_KEYWORDS.some((fk) => combinedText.includes(fk.normalize('NFC').toLowerCase()));
  const hasRoadCollisionTerms =
    combinedText.includes('মুখোমুখি সংঘর্ষ') ||
    combinedText.includes('সড়ক দুর্ঘটনা') ||
    combinedText.includes('গাড়ি দুর্ঘটনা') ||
    combinedText.includes('বাস-ট্রাক') ||
    combinedText.includes('ট্রাক-পিকআপ') ||
    combinedText.includes('পিকআপ-ড্রাম') ||
    combinedText.includes('গাড়ির সংঘর্ষ') ||
    combinedText.includes('লরির সংঘর্ষ') ||
    combinedText.includes('মোটরসাইকেল দুর্ঘটনা') ||
    combinedText.includes('অটোরিকশা দুর্ঘটনা') ||
    combinedText.includes('চাপা পড়ে নিহত') ||
    combinedText.includes('চাপা দিয়ে নিহত') ||
    combinedText.includes('চাপা দিয়েছে') ||
    combinedText.includes('উল্টে খাদে') ||
    combinedText.includes('বাস উল্টে') ||
    combinedText.includes('ট্রাক উল্টে') ||
    combinedText.includes('পিকআপ উল্টে') ||
    combinedText.includes('collision') ||
    combinedText.includes('traffic accident') ||
    combinedText.includes('head-on collision') ||
    combinedText.includes('road crash');

  if (hasVehicle && !hasViolentFaction && hasRoadCollisionTerms) {
    categoryScores['ROAD_ACCIDENT'] = (categoryScores['ROAD_ACCIDENT'] || 0) + 15;
    categoryScores['ARMED_ASSAULT'] = 0; // Clear collision with generic "সংঘর্ষ" keyword
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
  } else if (hasArmedAssault && (categoryScores['ROAD_ACCIDENT'] || 0) > 0) {
    // If genuine violent political/weapon terms are present, violent clash overrides road keywords
    if (hasViolentFaction) {
      resolvedCategory = 'ARMED_ASSAULT';
    } else {
      resolvedCategory = 'ROAD_ACCIDENT';
    }
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
    if (combinedText.includes(kw.normalize('NFC').toLowerCase())) {
      severity = 'HIGH';
      break;
    }
  }

  if (severity !== 'HIGH') {
    for (const kw of MEDIUM_SEVERITY_KEYWORDS) {
      if (combinedText.includes(kw.normalize('NFC').toLowerCase())) {
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
