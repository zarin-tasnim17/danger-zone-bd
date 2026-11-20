import assert from 'node:assert/strict';
import { classifyNewsText } from '../services/newsClassifierService';
import { isForeignIncident } from '../services/internationalIncidentFilter';
import { resolveLocationFromText } from '../services/geocodingService';
import { findDuplicateActiveReport, extractVehicles } from '../services/incidentDeduplicationService';
import { isWireSyndicatedStory, resolvePublisherDomain } from '../services/publisherRegistry';
import {
  NATIONWIDE_CLUSTERS,
  CLUSTER_ROTATION_SCHEDULE,
  getNextClusterPair,
  resetClusterRotationIndex,
  buildClusterFeeds,
  checkGoogleNewsCircuit,
  recordGoogleNewsFailure,
  recordGoogleNewsSuccess,
  circuitBreaker,
} from '../services/newsCrawlerService';

async function runScenarioVerification() {
  console.log('===============================================================');
  console.log('  Danger Zone BD - Nationwide Engine Scenarios A through G');
  console.log('===============================================================\n');

  // Scenario A: Locality Crime Separation
  console.log('Testing Scenario A: Locality Crime Separation...');
  const crime1Loc = await resolveLocationFromText('মিরপুরে ছিনতাইকারীর ছুরিকাঘাতে যুবক আহত', 'মিরপুর ১০ নম্বর গোলচত্বরে');
  const crime2Loc = await resolveLocationFromText('ধানমন্ডিতে ছিনতাইকারীর কবলে নারী', 'ধানমন্ডি ২৭ নম্বরে');
  assert.ok(crime1Loc, 'Crime 1 must resolve location');
  assert.ok(crime2Loc, 'Crime 2 must resolve location');
  assert.notStrictEqual(crime1Loc.locationName, crime2Loc.locationName, 'Locations must be distinct');
  console.log(`  ✔ Mirpur (${crime1Loc.locationName}) vs Dhanmondi (${crime2Loc.locationName}) properly separated`);

  // Scenario B: Highway Vehicle Conflict Separation
  console.log('\nTesting Scenario B: Highway Vehicle Conflict Separation...');
  const vBusTruck = extractVehicles('ঢাকা-চট্টগ্রাম মহাসড়কে বাস ও ট্রাকের মুখোমুখি সংঘর্ষে নিহত ২');
  const vBikeCng = extractVehicles('ঢাকা-চট্টগ্রাম মহাসড়কে মোটরসাইকেল ও সিএনজি অটোরিকশা সংঘর্ষে আহত ৩');
  console.log('  Extracted Set 1:', Array.from(vBusTruck));
  console.log('  Extracted Set 2:', Array.from(vBikeCng));
  assert.ok(vBusTruck.has('BUS') && vBusTruck.has('TRUCK'), 'Must detect bus and truck');
  assert.ok(vBikeCng.has('MOTORCYCLE') && vBikeCng.has('CNG'), 'Must detect motorcycle and cng');
  const hasOverlap = Array.from(vBusTruck).some((v) => vBikeCng.has(v));
  assert.strictEqual(hasOverlap, false, 'Vehicle sets must be disjoint to prevent false highway merges');
  console.log('  ✔ Disjoint vehicle sets detected (bus/truck vs motorcycle/cng) -> Highway collision merge rejected');

  // Scenario C: Precision Coordinate Upgrade
  console.log('\nTesting Scenario C: Precision Coordinate Upgrade...');
  const broadGeo = await resolveLocationFromText('সিরাজগঞ্জে সড়ক দুর্ঘটনায় নিহত ১');
  const exactGeo = await resolveLocationFromText('সিরাজগঞ্জের শাহজাদপুরে ট্রাকচাপায় পথচারী নিহত');
  assert.ok(broadGeo && exactGeo, 'Both geocodes must resolve');
  assert.strictEqual(broadGeo.locationPrecision, 'DISTRICT', 'First match must be DISTRICT precision');
  assert.strictEqual(exactGeo.locationPrecision, 'UPAZILA', 'Second match must be UPAZILA precision');
  assert.strictEqual(exactGeo.upazila, 'Shahjadpur', 'Must identify Shahjadpur upazila');
  console.log(`  ✔ Broad (${broadGeo.locationPrecision}: ${broadGeo.locationName}) -> Exact (${exactGeo.locationPrecision}: ${exactGeo.upazila}, ${exactGeo.district}) upgrade verified`);

  // Scenario D: Mourning / Janaza Disqualification
  console.log('\nTesting Scenario D: Mourning / Janaza Follow-up Disqualification...');
  const janazaCase = classifyNewsText('নিহত চালকের জানাজা সম্পন্ন, এলাকায় শোকের ছায়া', 'পারিবারিক কবরস্থানে দাফন সম্পন্ন হয়েছে');
  assert.strictEqual(janazaCase.isSafetyRelated, false, 'Janaza/burial follow-up must NOT be classified as active safety incident');
  assert.strictEqual(janazaCase.disqualifiedReason, 'MOURNING_FOLLOWUP', 'Reason must be MOURNING_FOLLOWUP');
  console.log('  ✔ Funeral memorial correctly disqualified as MOURNING_FOLLOWUP');

  // Scenario E: Wire Syndication Isolation
  console.log('\nTesting Scenario E: Wire Syndication Isolation...');
  const bssWire = isWireSyndicatedStory('https://bssnews.net/news/12345', 'BSS', 'DHAKA, Nov 19 (BSS) - Two killed in road crash');
  const unbWire = isWireSyndicatedStory('https://daily-outlet.com/story', 'Staff Reporter', 'Four injured in highway accident — UNB');
  const independentStory = isWireSyndicatedStory('https://dhakatribune.com/bangladesh/accident', 'Dhaka Tribune', 'Our correspondent reports accident');
  assert.strictEqual(bssWire.isWire, true, 'BSS URL must be recognized as wire');
  assert.strictEqual(bssWire.agency, 'BSS');
  assert.strictEqual(unbWire.isWire, true, 'UNB inline dispatch must be recognized as wire');
  assert.strictEqual(unbWire.agency, 'UNB');
  assert.strictEqual(independentStory.isWire, false, 'Direct reporting must NOT be marked wire');
  console.log('  ✔ Wire syndication isolation verified: BSS and UNB isolated, direct press admitted');

  // Scenario F: Foreign Filter Precision (Word Boundary)
  console.log('\nTesting Scenario F: Foreign Filter Precision & Word Boundaries...');
  const domesticWoman = isForeignIncident('Woman injured as snatchers drag her off rickshaw in Mirpur', 'Mirpur Dhaka incident');
  const realOman = isForeignIncident('Bangladeshi expatriate killed in Oman road crash', 'Muscat accident');
  assert.strictEqual(domesticWoman.isForeign, false, 'Domestic headline with "Woman" must NOT match "Oman"');
  assert.strictEqual(realOman.isForeign, true, 'Expatriate news in Oman must be excluded');
  console.log('  ✔ "Woman" vs "Oman" word boundary disambiguation confirmed');

  // Scenario G: 10-Cluster Nationwide Rotation & Circuit Breaker
  console.log('\nTesting Scenario G: 10-Cluster Schedule & Circuit Breaker...');
  assert.strictEqual(NATIONWIDE_CLUSTERS.length, 10, 'Must have 10 clusters covering 64 districts');
  const totalDistricts = NATIONWIDE_CLUSTERS.reduce((acc, c) => acc + c.districtsEn.length, 0);
  assert.strictEqual(totalDistricts, 64, 'Must cover all 64 districts');
  assert.strictEqual(CLUSTER_ROTATION_SCHEDULE.length, 5, 'Must have 5 rotation batches for 50-minute full cycle');

  resetClusterRotationIndex();
  const pair1 = getNextClusterPair();
  const pair2 = getNextClusterPair();
  assert.deepStrictEqual(pair1, ['C1', 'C2']);
  assert.deepStrictEqual(pair2, ['C3', 'C4']);

  const feedsC1 = buildClusterFeeds('C1');
  assert.strictEqual(feedsC1.length, 2, 'C1 feeds must contain 1 EN and 1 BN feed');
  assert.ok(feedsC1[0].url.includes('news.google.com'), 'Must target Google News RSS');

  // Circuit breaker test
  recordGoogleNewsSuccess();
  assert.strictEqual(circuitBreaker.state, 'CLOSED');
  assert.strictEqual(checkGoogleNewsCircuit(), true);

  recordGoogleNewsFailure(true); // 429 rate limit
  assert.strictEqual(circuitBreaker.state, 'OPEN');
  assert.strictEqual(checkGoogleNewsCircuit(), false);

  // During 30-minute cooldown, direct publisher success must NOT prematurely close Google News circuit breaker
  recordGoogleNewsSuccess();
  assert.strictEqual(circuitBreaker.state, 'OPEN', 'Google News circuit breaker must remain OPEN during 30m cooldown');
  assert.strictEqual(checkGoogleNewsCircuit(), false);

  // Expire the cooldown manually to verify half-open recovery
  circuitBreaker.openUntil = Date.now() - 1000;
  assert.strictEqual(checkGoogleNewsCircuit(), true, 'Must transition to HALF_OPEN after cooldown expires');
  recordGoogleNewsSuccess();
  assert.strictEqual(circuitBreaker.state, 'CLOSED');
  console.log('  ✔ 10-cluster rotation covering all 64 districts and Google News circuit breaker verified');

  // Scenario H: Corroboration Stage Promotion Logic (Publisher Domain Isolation)
  console.log('\nTesting Scenario H: Press Corroboration Stage Promotion...');
  const existingCitations = [
    {
      sourceName: 'Dhaka Tribune',
      sourceUrl: 'https://www.dhakatribune.com/bangladesh/2026/crash',
      title: 'Bus plunged into ditch on highway',
    },
  ];
  const newCitationSamePublisher = {
    sourceName: 'Dhaka Tribune',
    sourceUrl: 'https://www.dhakatribune.com/bangladesh/2026/crash-followup',
    title: 'Bus accident death toll rises',
  };
  const newCitationDifferentPublisher = {
    sourceName: 'Prothom Alo',
    sourceUrl: 'https://www.prothomalo.com/bangladesh/crash-report',
    title: 'মহাসড়কে বাস দুর্ঘটনায় নিহত',
  };

  const domain1 = resolvePublisherDomain(existingCitations[0].sourceUrl, existingCitations[0].sourceName);
  const domainSame = resolvePublisherDomain(newCitationSamePublisher.sourceUrl, newCitationSamePublisher.sourceName);
  const domainDiff = resolvePublisherDomain(newCitationDifferentPublisher.sourceUrl, newCitationDifferentPublisher.sourceName);
  assert.strictEqual(domain1, 'dhakatribune.com');
  assert.strictEqual(domainSame, 'dhakatribune.com');
  assert.strictEqual(domainDiff, 'prothomalo.com');

  const priorDomains = existingCitations.map((c) => resolvePublisherDomain(c.sourceUrl, c.sourceName));
  const isDiffSame = !priorDomains.includes(domainSame);
  const isDiffOther = !priorDomains.includes(domainDiff);
  assert.strictEqual(isDiffSame, false, 'Same publisher story must NOT promote to corroborated');
  assert.strictEqual(isDiffOther, true, 'Different publisher story MUST promote to corroborated');
  console.log('  ✔ Multi-press corroboration stage promotion domain isolation verified');

  // Scenario I: Rural Transport Extraction & Vehicle Conflict Separation
  console.log('\nTesting Scenario I: Rural Transport Entities & Highway Disjoint Penalty...');
  const vNosimon = extractVehicles('ঢাকা-সিলেট মহাসড়কে নসিমন ও ট্রাকের সংঘর্ষে নিহত ১');
  const vKorimon = extractVehicles('ঢাকা-সিলেট মহাসড়কে করিমন ও বাসের সংঘর্ষে আহত ৩');
  const vBhotbhoti = extractVehicles('কুষ্টিয়ায় ভটভটি উল্টে চালক নিহত');
  const vLeguna = extractVehicles('গাজীপুরে লেগুনা ও কাভার্ডভ্যানের সংঘর্ষ');
  assert.ok(vNosimon.has('NOSIMON') && vNosimon.has('TRUCK'), 'Must extract NOSIMON and TRUCK');
  assert.ok(vKorimon.has('KORIMON') && vKorimon.has('BUS'), 'Must extract KORIMON and BUS');
  assert.ok(vBhotbhoti.has('BHOTBHOTI'), 'Must extract BHOTBHOTI');
  assert.ok(vLeguna.has('LEGUNA') && vLeguna.has('COVERED_VAN'), 'Must extract LEGUNA and COVERED_VAN');

  const nosimonKorimonOverlap = Array.from(vNosimon).some((v) => vKorimon.has(v));
  assert.strictEqual(nosimonKorimonOverlap, false, 'Nosimon/Truck vs Korimon/Bus must be recognized as disjoint');
  console.log('  ✔ Rural vehicles (Nosimon, Korimon, Bhotbhoti, Leguna) canonicalized and highway conflict penalty applied');

  // Scenario J: Bengali Homonym Disambiguation with Bengali District Context
  console.log('\nTesting Scenario J: Bengali Homonym Disambiguation with Bengali District Context...');
  const boguraShibganj = await resolveLocationFromText('বগুড়ার শিবগঞ্জে সড়ক দুর্ঘটনায় নিহত ২');
  const chapaiShibganj = await resolveLocationFromText('চাঁপাইনবাবগঞ্জের শিবগঞ্জে বজ্রপাতে নিহত ১');
  assert.ok(boguraShibganj && chapaiShibganj, 'Both homonym thanas must resolve');
  assert.strictEqual(boguraShibganj.district, 'Bogura', 'Must resolve to Bogura district');
  assert.strictEqual(chapaiShibganj.district, 'Chapainawabganj', 'Must resolve to Chapainawabganj district');
  assert.strictEqual(boguraShibganj.upazila, 'Shibganj');
  assert.strictEqual(chapaiShibganj.upazila, 'Shibganj');
  console.log('  ✔ Bengali district context successfully disambiguates homonym upazilas (Bogura vs Chapainawabganj)');

  console.log('\n===============================================================');
  console.log('  ALL SCENARIOS VERIFIED SUCCESSFULLY (0 FAILURES)');
  console.log('===============================================================\n');
}

runScenarioVerification().catch((err) => {
  console.error('Scenario verification failed:', err);
  process.exit(1);
});
