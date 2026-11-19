import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNewsText,
  type ClassificationResult,
} from '../../../apps/api/src/services/newsClassifierService';
import type { ReportCategory } from '@repo/shared';

describe('Tier 4: Real-World Ingestion - F02: Ground-Reality Physical Incident Filtering (50+ Benchmark Corpus)', () => {
  // =========================================================================
  // NEGATIVE CORPUS: 27 Legal, Corruption, Political & Non-Physical Articles
  // =========================================================================
  const NEGATIVE_BENCHMARK_ARTICLES: Array<{
    id: string;
    title: string;
    summary: string;
    expectedReason: string;
  }> = [
    // --- 1. Court Proceedings (8 articles) ---
    {
      id: 'NEG-CRT-01',
      title: 'হত্যা মামলায় সাবেক মেয়রের ৫ দিনের রিমান্ড মঞ্জুর',
      summary: 'আদালতের বিচারক শুনানি শেষে আসামিকে পুলিশ হেফাজতে রিমান্ডের আদেশ দেন।',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-02',
      title: 'জজ আদালতে অস্ত্র মামলায় আসামির বিচার শুরু',
      summary: 'অভিযোগ গঠন করে সাক্ষ্যগ্রহণের দিন ধার্য করেছেন আদালত।',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-03',
      title: 'স্বর্ণ ডাকাতি মামলায় ৮ আসামির বিরুদ্ধে চার্জশিট দাখিল',
      summary: 'পুলিশ তদন্ত শেষে আদালতে চূড়ান্ত অভিযোগপত্র দাখিল করেছে।',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-04',
      title: 'সড়ক দুর্ঘটনায় প্রাণহানির মামলায় বাস চালকের ৩ বছরের কারাদণ্ড',
      summary: 'রায় ঘোষণা করে বিচারক আসামিকে সাজার নির্দেশ প্রদান করেন।',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-05',
      title: 'হাইকোর্টে হত্যা মামলার ডেথ রেফারেন্স ও আপিলের শুনানি শেষ',
      summary: 'উভয় পক্ষের যুক্তিতর্ক শেষে রায়ের জন্য অপেক্ষমাণ রাখা হয়েছে।',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-06',
      title: 'আদালতের নির্দেশে ছিনতাইকারী দলের প্রধানকে জেলহাজতে প্রেরণ',
      summary: 'হাজিরা শেষে আদালত আসামিকে কারাগারে পাঠানোর নির্দেশ দেন।',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-07',
      title: 'Supreme Court stays legal proceedings in extortion case against businessman',
      summary: 'Appellate division bench issued the stay order following a writ petition hearing.',
      expectedReason: 'COURT_PROCEEDING',
    },
    {
      id: 'NEG-CRT-08',
      title: 'Sessions court convicts 4 robbers, sentences them to 10 years imprisonment',
      summary: 'The judge delivered the verdict after examining prosecution witnesses in the trial.',
      expectedReason: 'COURT_PROCEEDING',
    },

    // --- 2. Bail Hearings (6 articles) ---
    {
      id: 'NEG-BAL-01',
      title: 'হত্যাচেষ্টা মামলায় সাবেক সংসদ সদস্যের জামিন আবেদন খারিজ',
      summary: 'মহানগর দায়রা জজ আদালতে জামিন চেয়ে আবেদন করলে বিচারক তা নামঞ্জুর করেন।',
      expectedReason: 'BAIL_HEARING',
    },
    {
      id: 'NEG-BAL-02',
      title: 'হাইকোর্ট থেকে ৩ সপ্তাহের অন্তর্বর্তীকালীন জামিন পেলেন সাবেক মন্ত্রী',
      summary: 'বিচারপতিদের দ্বৈত বেঞ্চ এই আগাম জামিন মঞ্জুর করেন।',
      expectedReason: 'BAIL_HEARING',
    },
    {
      id: 'NEG-BAL-03',
      title: 'মাদক মামলায় নেতার জামিন নামঞ্জুর, কারাগারে পাঠানোর নির্দেশ',
      summary: 'আসামিপক্ষের জামিনের শুনানি নাকচ করে জেলহাজতে প্রেরণের আদেশ।',
      expectedReason: 'BAIL_HEARING',
    },
    {
      id: 'NEG-BAL-04',
      title: 'High Court grants anticipatory bail to union parishad chairman in assault case',
      summary: 'The HC bench granted eight-week interim bail upon submission of the bail petition.',
      expectedReason: 'BAIL_HEARING',
    },
    {
      id: 'NEG-BAL-05',
      title: 'Bail plea of prime suspect in robbery case rejected by metropolitan magistrate',
      summary: 'The court ordered the accused to be sent to judicial custody as bail was denied.',
      expectedReason: 'BAIL_HEARING',
    },
    {
      id: 'NEG-BAL-06',
      title: 'Supreme Court upholds cancellation of bail in financial scam trial',
      summary: 'Chamber judge rejected the petition seeking stay on bail cancellation order.',
      expectedReason: 'BAIL_HEARING',
    },

    // --- 3. ACC & Corruption Probes (6 articles) ---
    {
      id: 'NEG-COR-01',
      title: 'দুদকের মামলায় সাবেক সচিবের ২০০ কোটি টাকার অবৈধ সম্পদ জব্দ',
      summary: 'দুর্নীতি দমন কমিশনের আবেদনের পরিপ্রেক্ষিতে আদালত এই ক্রোকের নির্দেশ দেন।',
      expectedReason: 'CORRUPTION_PROBE',
    },
    {
      id: 'NEG-COR-02',
      title: 'ব্যাংক ঋণ জালিয়াতি ও অর্থ পাচারের অভিযোগে দুদকের নতুন অনুসন্ধান',
      summary: 'মানি লন্ডারিং ও তহবিল তছরুপের অভিযোগে ব্যাংক কর্মকর্তাদের জিজ্ঞাসাবাদ চলছে।',
      expectedReason: 'CORRUPTION_PROBE',
    },
    {
      id: 'NEG-COR-03',
      title: 'ঘুষ গ্রহণের অভিযোগে ভূমি অফিসের কর্মকর্তাকে হাতেনাতে গ্রেফতার করল দুদক',
      summary: 'দুদকের সমন্বিত জেলা কার্যালয়ের দল ফাঁদ পেতে ঘুষ নেওয়ার সময় তাকে ধরে।',
      expectedReason: 'CORRUPTION_PROBE',
    },
    {
      id: 'NEG-COR-04',
      title: 'ACC files charge sheet against 12 bank officials over 500cr embezzlement',
      summary: 'Anti-Corruption Commission inquiry established systematic illegal wealth accumulation.',
      expectedReason: 'CORRUPTION_PROBE',
    },
    {
      id: 'NEG-COR-05',
      title: 'Anti-Corruption Commission probes illicit wealth of former revenue official',
      summary: 'The anti-graft watchdog summoned asset statement over unexplained wealth.',
      expectedReason: 'CORRUPTION_PROBE',
    },
    {
      id: 'NEG-COR-06',
      title: 'Money laundering investigation launched into financial company directors',
      summary: 'Financial scam uncovered systematic bribe kickbacks and illegal overseas asset transfers.',
      expectedReason: 'CORRUPTION_PROBE',
    },

    // --- 4. Political Statements & Rhetoric (4 articles) ---
    {
      id: 'NEG-POL-01',
      title: 'সংবাদ সম্মেলনে রাজপথে কঠোর আন্দোলনের হুঁশিয়ারি ফখরুলের',
      summary: 'প্রেস ব্রিফিংয়ে অবিলম্বে নিরপেক্ষ সরকারের অধীনে নির্বাচনের দাবি জানান তিনি।',
      expectedReason: 'POLITICAL_STATEMENT',
    },
    {
      id: 'NEG-POL-02',
      title: 'সমাবেশে বললেন নির্বাচন ছাড়া কোনো সমাধান নেই: জামায়াত আমির',
      summary: 'আলোচনা সভায় নেতৃবৃন্দের বক্তব্য, অবিলম্বে রোডম্যাপ ঘোষণার আহ্বান।',
      expectedReason: 'POLITICAL_STATEMENT',
    },
    {
      id: 'NEG-POL-03',
      title: 'প্রেস ব্রিফিংয়ে ৭ দফা দাবি পেশ করল ইসলামী আন্দোলন বাংলাদেশ',
      summary: 'সংবাদ সম্মেলনে লিখিত বক্তব্য পাঠ করে দেশবাসীকে ঐক্যবদ্ধ হওয়ার আহ্বান।',
      expectedReason: 'POLITICAL_STATEMENT',
    },
    {
      id: 'NEG-POL-04',
      title: 'Opposition party issues joint statement demanding immediate institutional reforms',
      summary: 'At a roundtable discussion, political party leaders spoke at rally warning against delays.',
      expectedReason: 'POLITICAL_STATEMENT',
    },

    // --- 5. Administrative Disputes & Historical Allegations (3 articles) ---
    {
      id: 'NEG-ADM-01',
      title: 'জমি সংক্রান্ত সীমানা বিরোধে দুই ইউনিয়নের মধ্যে চরম উত্তেজনা ও পাল্টাপাল্টি নোটিশ',
      summary: 'জেলা প্রশাসকের কার্যালয় থেকে সীমানা নির্ধারণের প্রশাসনিক আদেশ জারি করা হয়েছে।',
      expectedReason: 'ADMINISTRATIVE_DISPUTE',
    },
    {
      id: 'NEG-ADM-02',
      title: 'Ministry transfers 25 upazila nirbahi officers in administrative shake-up',
      summary: 'Public administration ministry issued official transfer notification for field officers.',
      expectedReason: 'ADMINISTRATIVE_DISPUTE',
    },
    {
      id: 'NEG-HIS-01',
      title: '১৯৭১ সালের মানবতাবিরোধী অপরাধ মামলায় আন্তর্জাতিক অপরাধ ট্রাইব্যুনালে শুনানি',
      summary: 'মুক্তিযুদ্ধকালীন অপরাধের ঐতিহাসিক মামলায় সাক্ষীর জবানবন্দি গ্রহণ করা হয়েছে।',
      expectedReason: 'HISTORICAL_ALLEGATION',
    },
  ];

  // =========================================================================
  // POSITIVE CORPUS: 27 Real-World Physical Safety Incidents Across Bangladesh
  // =========================================================================
  const POSITIVE_BENCHMARK_ARTICLES: Array<{
    id: string;
    title: string;
    summary: string;
    expectedCategory: ReportCategory;
  }> = [
    // --- 1. Road Accidents (5 articles) ---
    {
      id: 'POS-ACC-01',
      title: 'কুমিল্লার চৌদ্দগ্রামে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ৪',
      summary: 'ঢাকা-চট্টগ্রাম মহাসড়কে যাত্রীবাহী বাস নিয়ন্ত্রণ হারিয়ে ড্রাম ট্রাকের সঙ্গে ধাক্কা লাগলে এ দুর্ঘটনা ঘটে।',
      expectedCategory: 'ROAD_ACCIDENT',
    },
    {
      id: 'POS-ACC-02',
      title: 'সিরাজগঞ্জে মহাসড়কে যাত্রীবাহী বাস উল্টে খাদে, আহত ২০',
      summary: 'বঙ্গবন্ধু সেতু পশ্চিম সংযোগ সড়কে ঘন কুয়াশায় দ্রুতগতির বাস খাদে পড়ে উল্টে যায়।',
      expectedCategory: 'ROAD_ACCIDENT',
    },
    {
      id: 'POS-ACC-03',
      title: 'গাড়ির ধাক্কায় মোটরসাইকেল চালক নিহত, ঢাকা-মাওয়া এক্সপ্রেসওয়েতে যানজট',
      summary: 'বেপরোয়া গতির প্রাইভেটকারের চাপায় মোটরসাইকেল আরোহী ঘটনাস্থলেই প্রাণ হারান।',
      expectedCategory: 'ROAD_ACCIDENT',
    },
    {
      id: 'POS-ACC-04',
      title: 'Head-on collision between passenger bus and truck in Tangail leaves 3 dead',
      summary: 'The fatal road accident took place on Dhaka-Tangail highway when the bus lost control.',
      expectedCategory: 'ROAD_ACCIDENT',
    },
    {
      id: 'POS-ACC-05',
      title: 'Overturned pickup truck on highway crushes auto-rickshaw, 2 killed',
      summary: 'Deadly vehicle collision reported on regional highway as pickup plunged into ditch.',
      expectedCategory: 'ROAD_ACCIDENT',
    },

    // --- 2. Thefts (3 articles) ---
    {
      id: 'POS-THF-01',
      title: 'উত্তরায় মধ্যরাতে ফ্ল্যাটের তালা ভেঙে ৩০ ভরি স্বর্ণালঙ্কার ও নগদ টাকা চুরি',
      summary: 'পরিবারের সদস্যরা বাইরে থাকার সুযোগে চোর চক্র আলমারি ভেঙে মূল্যবান মালামাল চুরি করে নিয়ে যায়।',
      expectedCategory: 'THEFT',
    },
    {
      id: 'POS-THF-02',
      title: 'ফার্মগেটে দোকানের গ্রিল কেটে নগদ টাকা ও মূল্যবান মালামাল চুরি',
      summary: 'রাতের আঁধারে শাটারের তালা ও গ্রিল কেটে স্বর্ণ ও টাকা চুরি করেছে চোরের দল।',
      expectedCategory: 'THEFT',
    },
    {
      id: 'POS-THF-03',
      title: 'Motorcycle stolen from outside commercial bank in Motijheel',
      summary: 'Thief broke handle lock of the parked bike and fled with the stolen vehicle.',
      expectedCategory: 'THEFT',
    },

    // --- 3. Robberies & Dacoities (3 articles) ---
    {
      id: 'POS-ROB-01',
      title: 'টঙ্গীতে গভীর রাতে ব্যবসায়ীর বাড়ি ঘিরে সশস্ত্র ডাকাত দলের লুণ্ঠন',
      summary: 'অস্ত্রধারী ডাকাত দল গৃহকর্তাকে বেঁধে নগদ ১০ লাখ টাকা ও স্বর্ণালঙ্কার লুট করে পালিয়ে যায়।',
      expectedCategory: 'ROBBERY',
    },
    {
      id: 'POS-ROB-02',
      title: 'যাত্রাবাড়ীতে অস্ত্রের মুখে নৈশপ্রহরীকে বেঁধে দোকানে ডাকাতি',
      summary: '১০-১২ জনের একদল ডাকাত সিন্দুক ভেঙে মালামাল লুটপাট করে ট্রাকযোগে চম্পট দেয়।',
      expectedCategory: 'ROBBERY',
    },
    {
      id: 'POS-ROB-03',
      title: 'Armed gang robs jewelry showroom in Chattogram after tying up security guard',
      summary: 'Dacoits armed with firearms and machetes looted 50 bhori of gold in brazen robbery.',
      expectedCategory: 'ROBBERY',
    },

    // --- 4. Snatchings & Muggings (3 articles) ---
    {
      id: 'POS-SNA-01',
      title: 'ধানমন্ডিতে রিকশা আরোহী নারীর ভ্যানিটি ব্যাগ ও মোবাইল টান দিয়ে ছিনতাই',
      summary: 'মোটরসাইকেলে আসা দুই ছিনতাইকারী চলন্ত রিকশা থেকে ব্যাগ টান মেরে ছিটকে ফেলে দেয়।',
      expectedCategory: 'SNATCHING',
    },
    {
      id: 'POS-SNA-02',
      title: 'মিরপুর ১০ নম্বরে পথচারীর পথ রোধ করে মানিব্যাগ ও ফোন ছিনতাই',
      summary: 'অন্ধকার গলিতে ছিনতাইকারী চক্র চাকু দেখিয়ে সর্বস্ব কেড়ে নিয়ে দ্রুত সটকে পড়ে।',
      expectedCategory: 'SNATCHING',
    },
    {
      id: 'POS-SNA-03',
      title: 'Bag snatching incident reported near airport road, pedestrian robbed',
      summary: 'Snatchers on a speeding motorcycle snatched purse and mobile phone from woman.',
      expectedCategory: 'SNATCHING',
    },

    // --- 5. Armed Assaults & Clashes (4 articles) ---
    {
      id: 'POS-ASL-01',
      title: 'মোহাম্মদপুরে দুর্বৃত্তদের ছুরিকাঘাতে কলেজ শিক্ষার্থী গুরুতর আহত',
      summary: 'ধারালো ছুরি দিয়ে কুপিয়ে জখম করে রক্তাক্ত অবস্থায় ফেলে রেখে পালিয়ে যায় অস্ত্রধারীরা।',
      expectedCategory: 'ARMED_ASSAULT',
    },
    {
      id: 'POS-ASL-02',
      title: 'ফেনীতে আধিপত্য বিস্তার নিয়ে দুই পক্ষের রক্তক্ষয়ী সংঘর্ষে গুলিবিদ্ধ ৫',
      summary: 'দুপক্ষের মধ্যে দফায় দফায় ধাওয়া-পাল্টাধাওয়া, ককটেল বিস্ফোরণ ও আগ্নেয়াস্ত্র থেকে গুলিবর্ষণ।',
      expectedCategory: 'ARMED_ASSAULT',
    },
    {
      id: 'POS-ASL-03',
      title: 'Man stabbed and severely injured by armed attackers in Old Dhaka',
      summary: 'Machete attack leaves victim in critical condition with severe knife wounds.',
      expectedCategory: 'ARMED_ASSAULT',
    },
    {
      id: 'POS-ASL-04',
      title: 'Factional armed clash erupts between two local groups with gunfire and machetes',
      summary: 'Violent clash in neighborhood leaves multiple injured as cocktail bombs explode.',
      expectedCategory: 'ARMED_ASSAULT',
    },

    // --- 6. Compound Combinations (2 articles) ---
    {
      id: 'POS-CMP-01',
      title: 'মিরপুরে পথচারীকে কুপিয়ে জখম করে নগদ টাকা ও মুঠোফোন ছিনতাই',
      summary: 'ছিনতাইকালে বাধা দেওয়ায় ধারালো অস্ত্র দিয়ে কুপিয়ে রক্তাক্ত করে সর্বস্ব ছিনতাই করে।',
      expectedCategory: 'SNATCHING_ARMED_ASSAULT',
    },
    {
      id: 'POS-CMP-02',
      title: 'ব্যবসায়ীর বাড়িতে মধ্যরাতে চুরি ও ডাকাতির ঘটনায় মামলা',
      summary: 'বাসার তালা ভেঙে চুরি ও সিন্দুক ভেঙে সশস্ত্র ডাকাতি চালিয়ে স্বর্ণালঙ্কার লুণ্ঠন।',
      expectedCategory: 'THEFT_ROBBERY',
    },

    // --- 7. Extortion & Youth Gangs (3 articles) ---
    {
      id: 'POS-EXT-01',
      title: 'কাওরান বাজারে চাঁদা না দেওয়ায় দোকানদারকে পিটিয়ে হাত-পা ভেঙে দিল চাঁদাবাজরা',
      summary: 'চিহ্নিত চাঁদাবাজ দল ৫ লাখ টাকা চাঁদা দাবি করে না পেয়ে ধারালো অস্ত্র নিয়ে হামলা চালায়।',
      expectedCategory: 'EXTORTION',
    },
    {
      id: 'POS-EXT-02',
      title: 'Extortionist gang threatens factory owner demanding 10 lakh toll',
      summary: 'Illegal toll collectors issued death threats to workers if extortion money was unpaid.',
      expectedCategory: 'EXTORTION',
    },
    {
      id: 'POS-GNG-01',
      title: 'মিরপুরে কিশোর গ্যাংয়ের দুই দলের মধ্যে ধারালো অস্ত্র নিয়ে দফায় দফায় মহড়া ও সংঘর্ষ',
      summary: 'এলাকায় আতঙ্ক ছড়াতে কিশোর অপরাধী ও teen gang সদস্যরা দেশি অস্ত্র নিয়ে মারামারিতে লিপ্ত হয়।',
      expectedCategory: 'YOUTH_GANG_ACTIVITY',
    },

    // --- 8. Drug-Related Crime (2 articles) ---
    {
      id: 'POS-DRG-01',
      title: 'টেকনাফে নাফ নদী সীমান্তে বিজিবির অভিযানে ৫০ হাজার পিস ইয়াবাসহ মাদক কারবারি আটক',
      summary: 'মিয়ানমার থেকে পাচারকালে বিপুল narcotics ও yaba ট্যাবলেট উদ্ধার করেছে বর্ডার গার্ড।',
      expectedCategory: 'DRUG_RELATED_CRIME',
    },
    {
      id: 'POS-DRG-02',
      title: 'Police seize 500 bottles of phensedyl and arrest two drug peddlers',
      summary: 'Special anti-narcotics drive led to recovery of banned syrup from border area.',
      expectedCategory: 'DRUG_RELATED_CRIME',
    },

    // --- 9. Immediate Violent Emergency Exceptions (2 articles) ---
    {
      id: 'POS-EXC-01',
      title: 'আদালত চত্বরে ককটেল বিস্ফোরণ, পুলিশসহ আহত ৩',
      summary: 'বিচার চলাকালে আদালত ভবনের প্রবেশমুখে অজ্ঞাত দুর্বৃত্তরা ককটেল ছুড়ে বিস্ফোরণ ঘটায়।',
      expectedCategory: 'ARMED_ASSAULT', // Exception: active bomb attack at court premises!
    },
    {
      id: 'POS-EXC-02',
      title: 'Court premises bombed: 2 security personnel injured in cocktail blast',
      summary: 'Attackers hurled homemade explosive device at courthouse gate before fleeing.',
      expectedCategory: 'ARMED_ASSAULT', // Exception: active bomb attack at courthouse!
    },
  ];

  it('T4-02-01: Disqualifies 100% of negative benchmark articles (court proceedings, bail, ACC, politics, historical)', () => {
    assert.strictEqual(
      NEGATIVE_BENCHMARK_ARTICLES.length,
      27,
      'Must evaluate all 27 negative benchmark test cases'
    );

    for (const article of NEGATIVE_BENCHMARK_ARTICLES) {
      const result: ClassificationResult = classifyNewsText(article.title, article.summary);

      assert.strictEqual(
        result.isSafetyRelated,
        false,
        `Article [${article.id}] "${article.title}" must have isSafetyRelated: false. Got true!`
      );

      assert.strictEqual(
        result.disqualifiedReason,
        article.expectedReason,
        `Article [${article.id}] expected reason "${article.expectedReason}", got "${result.disqualifiedReason}"`
      );
    }
  });

  it('T4-02-02: Accepts 100% of positive benchmark articles representing genuine physical localized incidents', () => {
    assert.strictEqual(
      POSITIVE_BENCHMARK_ARTICLES.length,
      27,
      'Must evaluate all 27 positive benchmark test cases'
    );

    for (const article of POSITIVE_BENCHMARK_ARTICLES) {
      const result: ClassificationResult = classifyNewsText(article.title, article.summary);

      assert.strictEqual(
        result.isSafetyRelated,
        true,
        `Article [${article.id}] "${article.title}" must have isSafetyRelated: true. Got false (Reason: ${result.disqualifiedReason})`
      );

      assert.strictEqual(
        result.category,
        article.expectedCategory,
        `Article [${article.id}] expected category ${article.expectedCategory}, got ${result.category}`
      );

      assert.ok(
        result.confidence >= 0.6,
        `Article [${article.id}] confidence must be >= 0.6, got ${result.confidence}`
      );
    }
  });

  it('T4-02-03: Immediate violent emergency exception permits live attacks on court or political venues', () => {
    const attackOnCourt = classifyNewsText(
      'আদালত চত্বরে ককটেল বিস্ফোরণ, পুলিশসহ আহত ৩',
      'আদালত ভবনে বোমা হামলা চালিয়ে আতঙ্ক তৈরি করে দুর্বৃত্তরা।'
    );
    assert.strictEqual(attackOnCourt.isSafetyRelated, true);
    assert.strictEqual(attackOnCourt.category, 'ARMED_ASSAULT');

    const attackOnPoliticalRally = classifyNewsText(
      'রাজনৈতিক সমাবেশে ককটেল হামলা ও গুলিবর্ষণ, আহত ১০',
      'সমাবেশস্থলে ককটেল বিস্ফোরণ ও অস্ত্রধারীদের গুলিতে রণক্ষেত্র।'
    );
    assert.strictEqual(attackOnPoliticalRally.isSafetyRelated, true);
    assert.strictEqual(attackOnPoliticalRally.category, 'ARMED_ASSAULT');
  });

  it('T4-02-04: Retrospective legal coverage of past violent crimes remains strictly disqualified', () => {
    // Mentions "বোমা হামলা", but is 10-year-old case with charge sheet
    const pastBombingTrial = classifyNewsText(
      '১০ বছর আগের বোমা হামলা মামলায় চার্জশিট দাখিল',
      'আদালতে অভিযোগপত্র দাখিল করে বিচার শুরুর আবেদন পুলিশের।'
    );
    assert.strictEqual(pastBombingTrial.isSafetyRelated, false);
    assert.ok(
      pastBombingTrial.disqualifiedReason === 'COURT_PROCEEDING' ||
        pastBombingTrial.disqualifiedReason === 'HISTORICAL_ALLEGATION'
    );

    // Mentions "হত্যা", but is remand proceeding
    const pastMurderRemand = classifyNewsText(
      'মিতু হত্যা মামলায় বাবুল আক্তারের রিমান্ড মঞ্জুর',
      'আদালতের নির্দেশে পুলিশ হেফাজতে জিজ্ঞাসাবাদ।'
    );
    assert.strictEqual(pastMurderRemand.isSafetyRelated, false);
    assert.strictEqual(pastMurderRemand.disqualifiedReason, 'COURT_PROCEEDING');
  });

  it('T4-02-05: Court trial verdicts and sentencings for violent crimes are strictly disqualified as COURT_PROCEEDING', () => {
    // English court verdict on past bomb attack: must not exploit emergency exception
    const engVerdictBomb = classifyNewsText(
      'Court sentences 3 to life term for bomb attack',
      'Special tribunal announced the verdict on Tuesday.'
    );
    assert.strictEqual(engVerdictBomb.isSafetyRelated, false);
    assert.strictEqual(engVerdictBomb.disqualifiedReason, 'COURT_PROCEEDING');

    // Bengali court verdict on past bomb attack: must not exploit emergency exception
    const bnVerdictBomb = classifyNewsText(
      'বোমা হামলা মামলায় ৩ জনের যাবজ্জীবন',
      'বিশেষ ট্রাইব্যুনাল আজ এ আদেশ দেন।'
    );
    assert.strictEqual(bnVerdictBomb.isSafetyRelated, false);
    assert.strictEqual(bnVerdictBomb.disqualifiedReason, 'COURT_PROCEEDING');

    // Bengali court verdict on past road accident fatality
    const bnAccidentVerdict = classifyNewsText(
      'সড়ক দুর্ঘটনায় প্রাণহানির মামলায় বাস চালকের যাবজ্জীবন',
      'আজ আদালত এই আদেশ দেন।'
    );
    assert.strictEqual(bnAccidentVerdict.isSafetyRelated, false);
    assert.strictEqual(bnAccidentVerdict.disqualifiedReason, 'COURT_PROCEEDING');

    // Retrospective court sentence with past time anchor
    const pastBombLife = classifyNewsText(
      '১০ বছর আগের ককটেল বিস্ফোরণ মামলায় আসামির যাবজ্জীবন',
      'আদালতের বিচারক রায় ঘোষণা করেন।'
    );
    assert.strictEqual(pastBombLife.isSafetyRelated, false);
    assert.strictEqual(pastBombLife.disqualifiedReason, 'COURT_PROCEEDING');
  });

  it('T4-02-06: Total benchmark corpus contains 54 rigorously evaluated test articles', () => {
    const totalBenchmarkCount =
      NEGATIVE_BENCHMARK_ARTICLES.length + POSITIVE_BENCHMARK_ARTICLES.length;
    assert.ok(
      totalBenchmarkCount >= 50,
      `Expected at least 50 benchmark articles, evaluated ${totalBenchmarkCount}`
    );
    assert.strictEqual(totalBenchmarkCount, 54);
  });
});
