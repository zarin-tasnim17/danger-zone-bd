import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TestServerHandle } from '../framework/server';
import { TestDataTracker, prisma } from '../framework/dbTracker';
import { ApiClient } from '../framework/apiClient';
import { createDeviceActor, nextTestIp } from '../framework/authHelpers';
import { assertSuccessEnvelope } from '../framework/assertions';
import { classifyNewsText } from '../../src/services/newsClassifierService';
import { extractIncidentTemporalData } from '../../src/services/temporalExtractionService';
import { evaluateActiveThreatEligibility } from '../../src/services/activeThreatEligibilityService';
import { resolveLocationFromText } from '../../src/services/geocodingService';
import { validateUrlForSafeFetch, sanitizeXmlPayload } from '../../src/utils/ssrfFilter';
import { setReportLocation } from '../../src/db/spatialUtils';
import { LocationPrecision, ReportStatus, ThreatStatus } from '@prisma/client';

describe('Screenshot Inaccuracies & Active Threat Eligibility Regression Suite', () => {
  let server: TestServerHandle;
  const tracker = new TestDataTracker();

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await tracker.cleanup();
    await server.stop();
  });

  it('Case A (Screenshot Example A): Feni Khaleda Zia 2017 convoy case arrest must NOT be an active armed assault pin', async () => {
    const headline = 'ফেনীতে খালেদা জিয়ার গাড়িবহরে হামলা, মামলার পলাতক আসামি গ্রেফতার | জাতীয় | বাংলাদেশ সংবাদ সংস্থা (বাসস)';
    const snippet = '২০১৭ সালের ৩১ অক্টোবর ফেনীতে বিএনপি চেয়ারপারসন বেগম খালেদা জিয়ার গাড়িবহরে হামলা মামলার এক পলাতক আসামিকে গ্রেফতার করেছে পুলিশ।';

    // 1. Classifier contextual disqualification
    const classification = classifyNewsText(headline, snippet);
    assert.equal(classification.isSafetyRelated, false, 'Arrest follow-up must be disqualified from violent threat category');
    assert.ok(
      classification.disqualifiedReason === 'ARREST_FOLLOWUP' ||
        classification.disqualifiedReason === 'HISTORICAL_CASE_MENTION',
      `Unexpected disqualifier reason: ${classification.disqualifiedReason}`
    );

    // 2. Temporal extraction detects historical case
    const temporal = extractIncidentTemporalData(headline, snippet, new Date());
    assert.equal(temporal.isHistorical, true, 'Must be identified as historical incident from 2017 case');

    // 3. Active threat eligibility state machine
    const geocode = {
      district: 'Feni',
      precision: LocationPrecision.DISTRICT,
      lat: 23.0159,
      lng: 91.3976,
      source: 'test' as const,
    };

    const eligibility = evaluateActiveThreatEligibility({
      title: headline,
      summary: snippet,
      category: classification.category || 'ARMED_ASSAULT',
      severity: 'LOW',
      isSafetyRelated: classification.isSafetyRelated,
      disqualifiedReason: classification.disqualifiedReason,
      geocode,
      publishedAt: new Date(),
    });

    assert.equal(eligibility.isEligibleForActiveMap, false, 'Historical arrest news must NOT be eligible for active map pin');
    assert.equal(eligibility.threatStatus, 'RESOLVED', 'Threat status must be RESOLVED');
    assert.ok(
      ['HISTORICAL_INCIDENT', 'FOLLOW_UP_NEWS_ONLY'].includes(eligibility.conceptualOutcome),
      `Conceptual outcome was ${eligibility.conceptualOutcome}`
    );

    // 4. Geocoding masking: Case title venue must be masked so it is not treated as current scene of violence
    const location = resolveLocationFromText(headline, snippet);
    // If resolved, location must not treat "ফেনীতে" as active fresh crime scene
    assert.ok(location === null || location.source !== 'explicit_active_scene');
  });

  it('Case B (Screenshot Example B): Rajshahi University student altercation must NOT create active armed assault pin', async () => {
    const headline = 'ছাত্রলীগ অভিযোগে শিক্ষার্থীকে মারধর, ৪ ঘণ্টা অবরুদ্ধ ছাত্রদল নেতারা';
    const snippet = 'রাজশাহী বিশ্ববিদ্যালয়ের হোসেন শহীদ সোহরাওয়ার্দী হলে শিক্ষার্থীকে মারধরের পর চার ঘণ্টা অবরুদ্ধ করে রাখা হয় ছাত্রদল নেতাদের। পরে প্রক্টরিয়াল বডির উপস্থিতিতে পরিস্থিতি নিয়ন্ত্রণে আসে।';

    // 1. Classifier identifies altercation as resolved standoff without lethal weapons
    const classification = classifyNewsText(headline, snippet);
    assert.equal(classification.isSafetyRelated, false, 'Resolved university confinement must be disqualified');
    assert.ok(
      classification.disqualifiedReason === 'RESOLVED_ALTERCATION' ||
        classification.disqualifiedReason === 'UNARMED_SCUFFLE',
      `Unexpected disqualifier reason: ${classification.disqualifiedReason}`
    );

    // 2. Active threat eligibility
    const eligibility = evaluateActiveThreatEligibility({
      title: headline,
      summary: snippet,
      category: 'ARMED_ASSAULT',
      severity: 'LOW',
      isSafetyRelated: classification.isSafetyRelated,
      disqualifiedReason: classification.disqualifiedReason,
      geocode: {
        district: 'Rajshahi',
        precision: LocationPrecision.UPAZILA,
        lat: 24.3745,
        lng: 88.6042,
        source: 'test' as const,
      },
      publishedAt: new Date(),
    });

    assert.equal(eligibility.isEligibleForActiveMap, false, 'Resolved altercation must not appear on active threat map');
    assert.equal(eligibility.threatStatus, 'RESOLVED');
    assert.equal(eligibility.conceptualOutcome, 'RESOLVED_INCIDENT');
  });

  it('True Positive: Current violent armed clash with weapons is admitted with HIGH confidence and ACTIVE threat status', async () => {
    const headline = 'রাজশাহীতে ধারালো অস্ত্র ও রামদা নিয়ে দুই পক্ষের রক্তক্ষয়ী সংঘর্ষ, নিহত ১, আহত ১০';
    const snippet = 'আজ সকালে রাজশাহীর বাঘায় জমি সংক্রান্ত বিরোধের জেরে দেশীয় ধারালো অস্ত্র ও রামদা নিয়ে সংঘর্ষে জড়িয়ে পড়ে দুই পক্ষ। এতে ঘটনাস্থলেই একজন নিহত হন।';

    const classification = classifyNewsText(headline, snippet);
    assert.equal(classification.isSafetyRelated, true, 'Real deadly clash must NOT be disqualified');
    assert.equal(classification.category, 'ARMED_ASSAULT');
    assert.ok(classification.confidence >= 0.7, 'Confidence must be strong for armed lethal violence');

    const eligibility = evaluateActiveThreatEligibility({
      title: headline,
      summary: snippet,
      category: classification.category!,
      severity: 'CRITICAL',
      isSafetyRelated: true,
      sourceUrl: 'https://www.prothomalo.com/bangladesh/district/bagha-armed-clash',
      sourceName: 'Prothom Alo',
      geocode: {
        district: 'Rajshahi',
        upazila: 'Bagha',
        precision: LocationPrecision.UPAZILA,
        lat: 24.195,
        lng: 88.756,
        source: 'test' as const,
      },
      publishedAt: new Date(),
    });

    assert.equal(eligibility.isEligibleForActiveMap, true, 'Fresh violent clash must be admitted to active map');
    assert.equal(eligibility.threatStatus, 'ACTIVE');
    assert.equal(eligibility.conceptualOutcome, 'ACTIVE_QUALIFYING_THREAT');
    assert.equal(eligibility.effectiveLifespanHours, 48);
  });

  it('Spatial bounds query (/api/v1/reports/bounds) strictly filters out RESOLVED and UNDER_REVIEW threats', async () => {
    const actor = await createDeviceActor(server.baseUrl, tracker);
    const client = new ApiClient(server.baseUrl, nextTestIp());

    // Create 3 reports in Mirpur, Dhaka:
    // 1. ACTIVE threat
    const activeRep = await prisma.report.create({
      data: {
        userId: actor.id,
        category: 'ARMED_ASSAULT',
        severity: 'HIGH',
        latitude: 23.805,
        longitude: 90.365,
        district: 'Dhaka',
        locationPrecision: LocationPrecision.UPAZILA,
        threatStatus: ThreatStatus.ACTIVE,
        status: ReportStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        description: 'Active armed altercation in Mirpur',
      },
    });
    tracker.trackReport(activeRep.id);
    await setReportLocation(prisma, activeRep.id, 23.805, 90.365);

    // 2. RESOLVED threat (arrest follow-up / resolved standoff)
    const resolvedRep = await prisma.report.create({
      data: {
        userId: actor.id,
        category: 'ARMED_ASSAULT',
        severity: 'LOW',
        latitude: 23.806,
        longitude: 90.366,
        district: 'Dhaka',
        locationPrecision: LocationPrecision.UPAZILA,
        threatStatus: ThreatStatus.RESOLVED,
        status: ReportStatus.RESOLVED,
        expiresAt: new Date(Date.now() - 1000),
        description: 'Resolved past altercation',
      },
    });
    tracker.trackReport(resolvedRep.id);
    await setReportLocation(prisma, resolvedRep.id, 23.806, 90.366);

    // 3. UNDER_REVIEW threat (ambiguous location / unconfirmed)
    const reviewRep = await prisma.report.create({
      data: {
        userId: actor.id,
        category: 'ARMED_ASSAULT',
        severity: 'MEDIUM',
        latitude: 23.807,
        longitude: 90.367,
        district: 'Dhaka',
        locationPrecision: LocationPrecision.AMBIGUOUS,
        threatStatus: ThreatStatus.UNDER_REVIEW,
        status: ReportStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        description: 'Ambiguous unverified mention',
      },
    });
    tracker.trackReport(reviewRep.id);
    await setReportLocation(prisma, reviewRep.id, 23.807, 90.367);

    // Query spatial bounds enclosing Mirpur [minLat: 23.80, minLng: 90.36, maxLat: 23.81, maxLng: 90.37]
    const boundsRes = assertSuccessEnvelope<any[]>(
      await client.get('/api/v1/reports?minLat=23.80&minLng=90.36&maxLat=23.81&maxLng=90.37'),
      200
    );

    const ids = boundsRes.map((r: any) => r.id);
    assert.ok(ids.includes(activeRep.id), 'Active threat MUST appear in bounds response');
    assert.ok(!ids.includes(resolvedRep.id), 'Resolved threat MUST NOT appear in active bounds response');
    assert.ok(!ids.includes(reviewRep.id), 'Ambiguous/under-review threat MUST NOT appear in active bounds response');
  });

  it('SSRF Boundary Validator blocks loopback, private subnets, cloud metadata, and bad protocols', async () => {
    // Loopback / Localhost
    assert.equal((await validateUrlForSafeFetch('http://127.0.0.1:8080/feed.xml')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('http://localhost/rss')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('http://127.0.0.100/atom')).isSafe, false);

    // Cloud Metadata (AWS, GCP, Azure, DigitalOcean)
    assert.equal((await validateUrlForSafeFetch('http://169.254.169.254/latest/meta-data/')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('http://metadata.google.internal/computeMetadata/v1/')).isSafe, false);

    // Private RFC 1918 subnets
    assert.equal((await validateUrlForSafeFetch('http://10.0.0.1/rss')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('http://172.16.5.10/feed')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('http://192.168.1.1/feed.rss')).isSafe, false);

    // Non-HTTP/HTTPS protocols
    assert.equal((await validateUrlForSafeFetch('file:///etc/passwd')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('ftp://attacker.com/rss')).isSafe, false);
    assert.equal((await validateUrlForSafeFetch('gopher://attacker.com/')).isSafe, false);

    // Permitted legitimate public publishers
    assert.equal((await validateUrlForSafeFetch('https://www.thedailystar.net/rss')).isSafe, true);
    assert.equal((await validateUrlForSafeFetch('https://news.google.com/rss/search?q=bangladesh')).isSafe, true);
  });

  it('XML Payload Sanitizer strips XXE and Billion Laughs entity expansions', () => {
    const maliciousXxe = `<?xml version="1.0"?>
<!DOCTYPE rss [
  <!ELEMENT rss ANY >
  <!ENTITY xxe SYSTEM "file:///etc/shadow" >
]>
<rss version="2.0">
  <channel>
    <title>&xxe;</title>
  </channel>
</rss>`;

    const sanitized = sanitizeXmlPayload(maliciousXxe);
    assert.ok(!sanitized.includes('<!DOCTYPE'), 'DOCTYPE must be stripped');
    assert.ok(!sanitized.includes('<!ENTITY'), 'ENTITY must be stripped');
    assert.ok(!sanitized.includes('file:///etc/shadow'), 'Local system references must be stripped');
    assert.ok(sanitized.includes('<rss version="2.0">'), 'Valid RSS XML structure must be preserved');
  });

  it('Dhaka Metropolitan landmark disambiguation preserves Dhaka district over distant namesake upazilas', async () => {
    const mirpur = await resolveLocationFromText('মিরপুরে প্রকাশ্য দিবালোকে ছিনতাই', '');
    assert.ok(mirpur, 'Mirpur should be geocoded');
    assert.equal(mirpur.district, 'Dhaka', `Expected Dhaka, got ${mirpur.district}`);
    assert.equal(mirpur.upazila, 'Mirpur');
    assert.equal(mirpur.division, 'Dhaka');

    const mohammadpur = await resolveLocationFromText('মোহাম্মদপুরে অস্ত্রের মুখে ডাকাতি', '');
    assert.ok(mohammadpur, 'Mohammadpur should be geocoded');
    assert.equal(mohammadpur.district, 'Dhaka', `Expected Dhaka, got ${mohammadpur.district}`);
    assert.equal(mohammadpur.upazila, 'Mohammadpur');
    assert.equal(mohammadpur.division, 'Dhaka');
  });

  it('Temporal extraction identifies relative days and historical case mentions', () => {
    const relativeRes = extractIncidentTemporalData('৩ দিন আগে ঘটে যাওয়া ডাকাতির ঘটনা', '');
    assert.equal(relativeRes.isHistorical, true, 'Event from 3 days ago must be marked historical');

    const lastWeekRes = extractIncidentTemporalData('গত সপ্তাহে বাসে হামলার ঘটনা', '');
    assert.equal(lastWeekRes.isHistorical, true, 'Event from last week must be marked historical');

    const todayRes = extractIncidentTemporalData('আজ সকালে গুলশানে সশস্ত্র ছিনতাই', '');
    assert.equal(todayRes.isRecentOrToday, true, 'Event from today must be marked recent');
    assert.equal(todayRes.isHistorical, false);
  });
});
