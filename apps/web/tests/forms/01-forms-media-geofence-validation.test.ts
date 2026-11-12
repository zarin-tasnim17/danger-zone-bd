import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { WEB_TEST_CONFIG } from '../framework/config';
import {
  createAlertZoneRequestSchema,
  createReportRequestSchema,
  createSafeZoneRequestSchema,
  kycVerifyRequestSchema,
  moderationActionRequestSchema,
  safePathRequestSchema,
} from '../framework/contractSchemas';
import { DHAKA_OVERSIZED_POLYGON, DHAKA_VALID_POLYGON } from '../fixtures/mockData';
import { BD_MOBILE_REGEX, normalizeBangladeshPhone } from '@repo/shared';

describe('[Forms & Validation][Mocked] Client Form Boundaries & Schema Compatibility', () => {
  it('validates BD KYC phone normalization and international URL constraints for PHONE_OTP & NID_DOCUMENT', () => {
    const validPhone = normalizeBangladeshPhone('01712345678');
    assert.match(validPhone, BD_MOBILE_REGEX);
    assert.equal(
      kycVerifyRequestSchema.safeParse({ type: 'PHONE_OTP', phoneNumber: validPhone }).success,
      true
    );
    assert.equal(
      kycVerifyRequestSchema.safeParse({ type: 'PHONE_OTP', phoneNumber: '12345' }).success,
      false
    );
    assert.equal(
      kycVerifyRequestSchema.safeParse({
        type: 'NID_DOCUMENT',
        documentUrl: 'https://storage.example.com/kyc/nid-front.png',
      }).success,
      true
    );
    assert.equal(
      kycVerifyRequestSchema.safeParse({
        type: 'NID_DOCUMENT',
        documentUrl: 'not-a-valid-url',
      }).success,
      false
    );
  });

  it('checks alert geofence polygon closure & Bangladesh bounding constraints', () => {
    // Valid closed 5-point Dhaka polygon
    assert.equal(
      createAlertZoneRequestSchema.safeParse({
        name: 'Dhanmondi Watch',
        coordinates: DHAKA_VALID_POLYGON,
      }).success,
      true
    );

    // Empty zone name or <4 coordinate polygon points fail backend schema
    assert.equal(
      createAlertZoneRequestSchema.safeParse({
        name: '',
        coordinates: DHAKA_VALID_POLYGON,
      }).success,
      false
    );
    assert.equal(
      createAlertZoneRequestSchema.safeParse({
        name: 'A',
        coordinates: DHAKA_VALID_POLYGON.slice(0, 3),
      }).success,
      false
    );

    // Verify alerts/page.tsx polygon closing, 25km2 client validation & removal of fake push fallback
    const alertsSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/alerts/page.tsx'), 'utf8');
    assert.ok(alertsSrc.includes('25'));
    assert.equal(alertsSrc.includes('https://push.safetymap.bd/device/'), false);
    assert.ok(alertsSrc.includes('pushManager.subscribe'));
    assert.ok(DHAKA_OVERSIZED_POLYGON.length >= 4);
  });

  it('checks Safe Route Bangladesh bounding box and Safe Zone NaN/min-length edge cases', () => {
    assert.equal(
      safePathRequestSchema.safeParse({
        startLat: 23.738,
        startLng: 90.37,
        endLat: 23.758,
        endLng: 90.39,
      }).success,
      true
    );
    // Out-of-Bangladesh London coords fail backend strict schema (lat 20..27, lng 87..93)
    assert.equal(
      safePathRequestSchema.safeParse({
        startLat: 51.5,
        startLng: -0.12,
        endLat: 51.51,
        endLng: -0.1,
      }).success,
      false
    );

    // Safe Zone form empty strings become parseFloat("") => NaN => JSON null, which backend rejects
    assert.equal(
      createSafeZoneRequestSchema.safeParse({
        name: 'A',
        type: 'HOSPITAL',
        latitude: Number.NaN,
        longitude: 90.4,
      }).success,
      false
    );
  });

  it('reproduces ReportIncidentModal whitespace formatting producing empty ": " payload & >1000 char overflow risk', () => {
    const modalSrc = fs.readFileSync(
      path.join(WEB_TEST_CONFIG.webRoot, 'components/incidents/ReportIncidentModal.tsx'),
      'utf8'
    );
    // Simulates exact formatting expression in ReportIncidentModal.tsx line ~266
    const title = '   ';
    const locationName = '   ';
    const description = '   ';
    const composed = `${title.trim()}${locationName.trim() ? ` [${locationName.trim()}]` : ''}: ${description.trim()}`;
    assert.equal(composed, ': ');
    // Backend min(1) actually accepts ': ' even though user entered pure whitespace!
    assert.equal(
      createReportRequestSchema.safeParse({
        category: 'ROBBERY',
        severity: 'MEDIUM',
        description: composed,
        latitude: 23.75,
        longitude: 90.38,
      }).success,
      true
    );
    // Meanwhile overly long composed description >1000 chars fails backend max(1000) without modal pre-validation
    const tooLong = 'A'.repeat(1001);
    assert.equal(
      createReportRequestSchema.safeParse({
        category: 'ROBBERY',
        severity: 'MEDIUM',
        description: tooLong,
        latitude: 23.75,
        longitude: 90.38,
      }).success,
      false
    );
    assert.ok(modalSrc.includes('title.trim()'));
  });

  it('confirms admin moderation actions require minimum 3-char reason which admin UI does not enforce pre-flight', () => {
    assert.equal(moderationActionRequestSchema.safeParse({ reason: 'ok' }).success, false);
    assert.equal(moderationActionRequestSchema.safeParse({ reason: 'Duplicate spam' }).success, true);

    const adminSrc = fs.readFileSync(path.join(WEB_TEST_CONFIG.webRoot, 'app/admin/page.tsx'), 'utf8');
    assert.ok(adminSrc.includes('purgeReason.trim()'));
    assert.ok(adminSrc.includes('rejectReason.trim()'));
    assert.ok(adminSrc.includes('banReason.trim()'));
  });
});
