import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_VISUALS,
  UNKNOWN_CATEGORY_VISUAL,
  getCategoryVisual,
  getCategoryIcon,
  getCategorySvg,
  getCategoryBadgeClass,
  formatCategoryLabel,
  getCategoryDescription,
} from '@/lib/incidentCategoryVisuals';
import { cleanIncidentTitle } from '@/lib/incidentUtils';
import { installBrowserGlobals } from '../framework/domEnv';
import {
  Car,
  KeyRound,
  Skull,
  PackageX,
  Grab,
  Swords,
  Crosshair,
  Banknote,
  Users,
  Pill,
  LightbulbOff,
  ShieldBan,
  Flame,
  Zap,
  Megaphone,
  Siren,
  AlertTriangle,
} from 'lucide-react';
import { classifyNewsText } from '../../../../apps/api/src/services/newsClassifierService';

describe('[Unit] Incident Category Visuals & Classification Parity', () => {
  const ALL_SUPPORTED_CATEGORIES = Object.keys(CATEGORY_VISUALS);

  it('1. Every supported incident category has a unique icon and distinct SVG markup', () => {
    const icons = new Set<any>();
    const svgs = new Set<string>();

    for (const cat of ALL_SUPPORTED_CATEGORIES) {
      const visual = getCategoryVisual(cat);
      assert.ok(visual, `Visual must exist for ${cat}`);
      assert.ok(visual.icon, `Icon component must exist for ${cat}`);

      // Verify uniqueness among all supported categories
      assert.ok(
        !icons.has(visual.icon),
        `Duplicate icon found for category: ${cat}. Every category must have a unique icon.`
      );
      icons.add(visual.icon);

      const svgMarkup = visual.getSvg(14);
      assert.ok(svgMarkup.includes('<svg'), `SVG markup must be valid for ${cat}`);
      assert.ok(
        !svgs.has(svgMarkup),
        `Duplicate SVG geometry found for category: ${cat}. Every category must have distinct SVG markup.`
      );
      svgs.add(svgMarkup);
    }

    // Also assert that UNKNOWN fallback has its own unique icon and SVG distinct from all categories
    assert.ok(!icons.has(UNKNOWN_CATEGORY_VISUAL.icon), 'UNKNOWN icon must not collide with any category icon');
    assert.ok(!svgs.has(UNKNOWN_CATEGORY_VISUAL.getSvg(14)), 'UNKNOWN SVG must not collide with any category SVG');

    assert.equal(icons.size, ALL_SUPPORTED_CATEGORIES.length);
    assert.equal(svgs.size, ALL_SUPPORTED_CATEGORIES.length);
  });

  it('2. ROAD_ACCIDENT displays the Car icon and vehicular collision SVG', () => {
    const icon = getCategoryIcon('ROAD_ACCIDENT');
    assert.strictEqual(icon, Car);

    const svg = getCategorySvg('ROAD_ACCIDENT', 14);
    assert.ok(svg.includes('<circle cx="7" cy="17" r="2"/>'), 'Must contain car wheel geometry');
    assert.ok(svg.includes('m9 9 3 3m0-3-3 3'), 'Must contain collision impact sparks');

    const badge = getCategoryBadgeClass('ROAD_ACCIDENT');
    assert.ok(badge.includes('bg-emerald-50'), 'Must use emerald safety badge');
  });

  it('3. THEFT never displays the Car icon; displays KeyRound', () => {
    const icon = getCategoryIcon('THEFT');
    assert.notStrictEqual(icon, Car, 'THEFT must NEVER display Car icon');
    assert.strictEqual(icon, KeyRound, 'THEFT must display KeyRound icon');

    const svg = getCategorySvg('THEFT', 14);
    assert.ok(!svg.includes('circle cx="7" cy="17"'), 'Must not contain car wheel');
    assert.ok(svg.includes('circle cx="7.5" cy="15.5" r="4.5"'), 'Must contain key head');

    const badge = getCategoryBadgeClass('THEFT');
    assert.ok(badge.includes('bg-amber-50'), 'Must use amber badge');
  });

  it('4. ROBBERY displays its own category-specific icon (Skull) and never Car', () => {
    const icon = getCategoryIcon('ROBBERY');
    assert.notStrictEqual(icon, Car, 'ROBBERY must NEVER display Car icon');
    assert.strictEqual(icon, Skull, 'ROBBERY must display Skull icon');

    const svg = getCategorySvg('ROBBERY', 14);
    assert.ok(svg.includes('circle cx="9" cy="12"'), 'Must contain bandit eye geometry');

    const dacoityIcon = getCategoryIcon('DACOITY');
    assert.strictEqual(dacoityIcon, Skull, 'Legacy alias DACOITY must resolve to Skull icon');
  });

  it('5. ARMED_ASSAULT displays its own category-specific icon (Swords) and never Car', () => {
    const icon = getCategoryIcon('ARMED_ASSAULT');
    assert.notStrictEqual(icon, Car, 'ARMED_ASSAULT must NEVER display Car icon');
    assert.strictEqual(icon, Swords, 'ARMED_ASSAULT must display Swords icon');

    const svg = getCategorySvg('ARMED_ASSAULT', 14);
    assert.ok(svg.includes('m4.5 17.5 15-15'), 'Must contain crossed blades geometry');
  });

  it('6. Specific icons are assigned to each remaining category without collision', () => {
    assert.strictEqual(getCategoryIcon('SNATCHING'), Grab);
    assert.strictEqual(getCategoryIcon('SNATCHING_ARMED_ASSAULT'), Crosshair);
    assert.strictEqual(getCategoryIcon('THEFT_ROBBERY'), PackageX);
    assert.strictEqual(getCategoryIcon('EXTORTION'), Banknote);
    assert.strictEqual(getCategoryIcon('YOUTH_GANG_ACTIVITY'), Users);
    assert.strictEqual(getCategoryIcon('DRUG_RELATED_CRIME'), Pill);
    assert.strictEqual(getCategoryIcon('UNLIT_ROAD'), LightbulbOff);
    assert.strictEqual(getCategoryIcon('ROADBLOCK'), ShieldBan);
    assert.strictEqual(getCategoryIcon('FIRE'), Flame);
    assert.strictEqual(getCategoryIcon('NATURAL_HAZARD'), Zap);
    assert.strictEqual(getCategoryIcon('HARASSMENT'), Megaphone);
    assert.strictEqual(getCategoryIcon('VIOLENCE_RIOT'), Siren);
  });

  it('7. Severity changes do NOT change the category icon or SVG', async () => {
    const sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    try {
      const { createDangerMarkerIcon, getSeverityColors } = await import('@/lib/mapMarkerUtils');
      const severities: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[] = [
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL',
      ];

      for (const severity of severities) {
        // Theft marker across severities
        const theftPin = createDangerMarkerIcon('THEFT', severity, 14);
        const theftHtml = (theftPin.options as any).html;
        assert.ok(theftHtml.includes('circle cx="7.5" cy="15.5"'), 'Theft icon must stay KeyRound');
        assert.ok(!theftHtml.includes('circle cx="7" cy="17" r="2"'), 'Theft must NEVER turn into Car');

        // Armed assault marker across severities
        const assaultPin = createDangerMarkerIcon('ARMED_ASSAULT', severity, 14);
        const assaultHtml = (assaultPin.options as any).html;
        assert.ok(assaultHtml.includes('m4.5 17.5 15-15'), 'Assault icon must stay Swords');
        assert.ok(!assaultHtml.includes('circle cx="7" cy="17" r="2"'), 'Assault must NEVER turn into Car');

        // Road accident marker across severities
        const roadPin = createDangerMarkerIcon('ROAD_ACCIDENT', severity, 14);
        const roadHtml = (roadPin.options as any).html;
        assert.ok(roadHtml.includes('circle cx="7" cy="17" r="2"'), 'Road accident must stay Car');
      }

      // Verify severity colors change independently
      const lowColors = getSeverityColors('LOW');
      const highColors = getSeverityColors('HIGH');
      const critColors = getSeverityColors('CRITICAL');
      assert.notEqual(lowColors.bg, highColors.bg);
      assert.notEqual(highColors.bg, critColors.bg);
    } finally {
      sandbox.restore();
    }
  });

  it('8. Feed cards, popups, and map markers use the exact same category mapping', () => {
    for (const cat of ALL_SUPPORTED_CATEGORIES) {
      const visual = getCategoryVisual(cat);
      const icon = getCategoryIcon(cat);
      const svg = getCategorySvg(cat, 14);
      const badge = getCategoryBadgeClass(cat);
      const labelEn = formatCategoryLabel(cat, 'en');
      const labelBn = formatCategoryLabel(cat, 'bn');

      assert.strictEqual(icon, visual.icon);
      assert.strictEqual(svg, visual.getSvg(14));
      assert.strictEqual(badge, visual.badgeClass);
      assert.strictEqual(labelEn, visual.labelEn);
      assert.strictEqual(labelBn, visual.labelBn);
    }
  });

  it('9. Unknown or unsupported categories fallback to neutral warning triangle, NEVER Car', () => {
    const unknownCases = ['UNKNOWN', 'unsupported_test_type', 'SOMETHING_RANDOM', '', null, undefined];

    for (const unknownCat of unknownCases) {
      const visual = getCategoryVisual(unknownCat as any);
      assert.strictEqual(visual.icon, AlertTriangle, 'Unknown category must use AlertTriangle');
      assert.notStrictEqual(visual.icon, Car, 'Unknown category must NEVER use Car');

      const svg = getCategorySvg(unknownCat as any, 14);
      assert.ok(svg.includes('m21.73 18-8-14'), 'Must be neutral warning triangle SVG');
      assert.ok(!svg.includes('circle cx="7" cy="17"'), 'Must not be car collision SVG');

      const label = formatCategoryLabel(unknownCat as any, 'en');
      if (unknownCat) {
        assert.ok(label.length > 0);
      }
      assert.ok(!label.toLowerCase().includes('car'));
    }

    // Verify formatCategoryLabel localized fallback for known generic alert in Bangla
    assert.strictEqual(
      formatCategoryLabel('general_alert', 'bn'),
      'সাধারণ সতর্কতা',
      'general_alert must translate into Bengali label rather than English'
    );
  });

  it("10. The screenshot's news headline is correctly classified as ARMED_ASSAULT", () => {
    const headline = 'হবিগঞ্জে চুরির ঘটনাকে কেন্দ্র করে দুই গ্রামের সংঘর্ষে আহত অর্ধশত dbcnews.tv';
    const classification = classifyNewsText(headline, '');

    assert.strictEqual(classification.isSafetyRelated, true, 'Headline must be safety related');
    assert.strictEqual(
      classification.category,
      'ARMED_ASSAULT',
      `Expected ARMED_ASSAULT, but received: ${classification.category}`
    );
    assert.notStrictEqual(
      classification.category,
      'ROAD_ACCIDENT',
      'Headline must NOT be classified as ROAD_ACCIDENT'
    );
    assert.notStrictEqual(
      classification.category,
      'THEFT',
      'Theft-induced violent clash must NOT be classified as mere THEFT'
    );

    // Verify cleaned headline strips trailing .tv outlet credit
    const cleaned = cleanIncidentTitle(headline);
    assert.equal(cleaned, 'হবিগঞ্জে চুরির ঘটনাকে কেন্দ্র করে দুই গ্রামের সংঘর্ষে আহত অর্ধশত');
    assert.ok(!cleaned.includes('dbcnews'));
  });

  it('11. Contextual disambiguation correctly distinguishes vehicular collisions from armed clashes', () => {
    // Road accident with vehicles
    const roadRes = classifyNewsText('মহাসড়কে বাস ও পিকআপের সংঘর্ষে নিহত ২', 'সড়ক দুর্ঘটনা');
    assert.strictEqual(roadRes.isSafetyRelated, true);
    assert.strictEqual(roadRes.category, 'ROAD_ACCIDENT');

    // Inter-village clash triggered by theft
    const clashRes = classifyNewsText('চুরির বিরোধ নিয়ে দুই পক্ষের সংঘর্ষে আহত ১০', '');
    assert.strictEqual(clashRes.isSafetyRelated, true);
    assert.strictEqual(clashRes.category, 'ARMED_ASSAULT');

    // Mob lynching / beating of suspected thief
    const lynchingRes = classifyNewsText('চোর সন্দেহে যুবককে গণপিটুনি', '');
    assert.strictEqual(lynchingRes.isSafetyRelated, true);
    assert.strictEqual(lynchingRes.category, 'ARMED_ASSAULT');

    // Pure burglary / theft without violence
    const theftRes = classifyNewsText('বাসায় তালা ভেঙে নগদ টাকা ও স্বর্ণ চুরি', '');
    assert.strictEqual(theftRes.isSafetyRelated, true);
    assert.strictEqual(theftRes.category, 'THEFT');
  });

  it('12. Map marker sizing is responsive across zoom levels', async () => {
    const sandbox = installBrowserGlobals({ origin: 'http://127.0.0.1:3000' });
    try {
      const { getMarkerDimensions } = await import('@/lib/mapMarkerUtils');
      const d10 = getMarkerDimensions(10);
      assert.equal(d10.size, 22);
      assert.equal(d10.iconSize, 11);

      const d13 = getMarkerDimensions(13);
      assert.equal(d13.size, 28);
      assert.equal(d13.iconSize, 14);

      const d16 = getMarkerDimensions(16);
      assert.equal(d16.size, 32);
      assert.equal(d16.iconSize, 16);
    } finally {
      sandbox.restore();
    }
  });

  it('13. Rural clash weapons (বল্লম, টেঁটা, রামদা, চাপাতি, হাঁসুয়া) classify as ARMED_ASSAULT with HIGH severity', () => {
    const weaponClash1 = classifyNewsText('হবিগঞ্জে দুই পক্ষের রক্তক্ষয়ী সংঘর্ষে বল্লম ও টেঁটা বিদ্ধ হয়ে আহত ২০', '');
    assert.strictEqual(weaponClash1.isSafetyRelated, true);
    assert.strictEqual(weaponClash1.category, 'ARMED_ASSAULT');
    assert.strictEqual(weaponClash1.severity, 'HIGH');

    const weaponClash2 = classifyNewsText('রামদা ও চাপাতি নিয়ে প্রতিপক্ষের ওপর সশস্ত্র হামলা, আহত বহু', '');
    assert.strictEqual(weaponClash2.isSafetyRelated, true);
    assert.strictEqual(weaponClash2.category, 'ARMED_ASSAULT');
    assert.strictEqual(weaponClash2.severity, 'HIGH');

    const weaponClash3 = classifyNewsText('হাঁসুয়া ও দেশীয় অস্ত্র দিয়ে কুপিয়ে জখম', '');
    assert.strictEqual(weaponClash3.isSafetyRelated, true);
    assert.strictEqual(weaponClash3.category, 'ARMED_ASSAULT');
  });

  it('14. cleanIncidentTitle cleans trailing publisher suffixes without corrupting valid text containing dots', () => {
    // Preserves intermediate periods/abbreviations
    assert.strictEqual(
      cleanIncidentTitle('Accident at 10.am today near Farmgate'),
      'Accident at 10.am today near Farmgate'
    );

    // Strips trailing domain name without dash
    assert.strictEqual(
      cleanIncidentTitle('হবিগঞ্জে সংঘর্ষে আহত অর্ধশত dbcnews.tv'),
      'হবিগঞ্জে সংঘর্ষে আহত অর্ধশত'
    );

    // Strips dash-separated domain name
    assert.strictEqual(
      cleanIncidentTitle('মহাসড়কে বাস উল্টে নিহত ৩ - dhakapost.com'),
      'মহাসড়কে বাস উল্টে নিহত ৩'
    );

    // Strips pipe-separated news outlet
    assert.strictEqual(
      cleanIncidentTitle('মিরপুরে ছিনতাইকালে পথচারী আহত | প্রথম আলো'),
      'মিরপুরে ছিনতাইকালে পথচারী আহত'
    );
  });
});
