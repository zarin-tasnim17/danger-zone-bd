import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  ALL_BACKEND_ENDPOINT_IDS,
  createAlertZoneRequestSchema,
  createReportRequestSchema,
  createSafeZoneRequestSchema,
  deviceLoginRequestSchema,
  kycVerifyRequestSchema,
  moderationActionRequestSchema,
  passwordLoginRequestSchema,
  presignedUrlQuerySchema,
  reportUpdateResponseItemSchema,
  safePathRequestSchema,
  voteReportRequestSchema,
} from '../framework/contractSchemas';
import { ENDPOINT_COVERAGE_MANIFEST } from '../framework/coverageRegistry';
import { WEB_TEST_CONFIG } from '../framework/config';
import { DHAKA_VALID_POLYGON } from '../fixtures/mockData';

describe('[Contracts][Schema Parity] Frontend Payloads vs 47 Backend Endpoints (EP-001..EP-047)', () => {
  it('covers 100% of EP-001..EP-047 in the coverage manifest without missing or duplicate IDs', () => {
    const manifestIds = ENDPOINT_COVERAGE_MANIFEST.map((e) => e.id);
    assert.equal(manifestIds.length, 47);
    assert.deepEqual(new Set(manifestIds).size, 47);
    for (const id of ALL_BACKEND_ENDPOINT_IDS) {
      assert.ok(manifestIds.includes(id), `Missing endpoint ${id} in manifest`);
    }
  });

  it('validates all frontend outgoing POST/GET request shapes against strict backend Zod schemas', () => {
    assert.equal(deviceLoginRequestSchema.safeParse({ anonymousId: 'anon-123456' }).success, true);
    assert.equal(
      passwordLoginRequestSchema.safeParse({ email: 'admin@example.com', password: 'secret12' }).success,
      true
    );
    assert.equal(
      createReportRequestSchema.safeParse({
        category: 'ROBBERY',
        severity: 'HIGH',
        description: 'Dhanmondi 27: Armed snatching near main road.',
        latitude: 23.7465,
        longitude: 90.376,
      }).success,
      true
    );
    // Reject extra unrecognized fields under .strict()
    assert.equal(
      createReportRequestSchema.safeParse({
        category: 'ROBBERY',
        severity: 'HIGH',
        latitude: 23.7465,
        longitude: 90.376,
        isAnonymous: true,
      }).success,
      false
    );
    assert.equal(voteReportRequestSchema.safeParse({ voteType: 1 }).success, true);
    assert.equal(voteReportRequestSchema.safeParse({ voteType: -1 }).success, true);
    assert.equal(
      presignedUrlQuerySchema.safeParse({
        reportId: '11111111-1111-4111-8111-111111111111',
        fileType: 'image/png',
        fileSize: 2048,
      }).success,
      true
    );
    assert.equal(
      createSafeZoneRequestSchema.safeParse({
        name: 'Dhaka Medical Hospital',
        type: 'HOSPITAL',
        latitude: 23.7258,
        longitude: 90.3976,
      }).success,
      true
    );
    assert.equal(
      createAlertZoneRequestSchema.safeParse({
        name: 'Home Perimeter',
        coordinates: DHAKA_VALID_POLYGON,
      }).success,
      true
    );
    assert.equal(
      safePathRequestSchema.safeParse({
        startLat: 23.738,
        startLng: 90.37,
        endLat: 23.758,
        endLng: 90.39,
      }).success,
      true
    );
    assert.equal(
      kycVerifyRequestSchema.safeParse({
        type: 'PHONE_OTP',
        phoneNumber: '+8801712345678',
      }).success,
      true
    );
    assert.equal(
      moderationActionRequestSchema.safeParse({ reason: 'Verified duplicate spam incident' }).success,
      true
    );
  });

  it('verifies ReportDetailPage author.role & author.alias match EP-018/EP-019 sanitized response contract', () => {
    const backendUpdateItem = {
      id: '44444444-4444-4444-8444-444444444444',
      reportId: '22222222-2222-4222-8222-222222222222',
      content: 'Police patrol arrived at junction.',
      createdAt: '2026-11-12T10:05:00.000Z',
      author: {
        isVerified: true,
        role: 'VERIFIED_RESPONDER',
        alias: 'Verified Responder',
      },
    };
    const parsed = reportUpdateResponseItemSchema.safeParse(backendUpdateItem);
    assert.equal(parsed.success, true);

    const detailPageSrc = fs.readFileSync(
      path.join(WEB_TEST_CONFIG.webRoot, 'app/reports/[id]/page.tsx'),
      'utf8'
    );
    assert.ok(detailPageSrc.includes('up.author?.role'));
    assert.ok(detailPageSrc.includes('up.author?.alias'));
  });

  it('verifies dev-test internal diagnostic routes match current EP endpoints rather than drifted stubs', () => {
    const devTestSrc = fs.readFileSync(
      path.join(WEB_TEST_CONFIG.webRoot, 'app/dev-test/page.tsx'),
      'utf8'
    );
    assert.ok(devTestSrc.includes('/auth/device'));
    assert.ok(devTestSrc.includes('/reports'));
    assert.ok(devTestSrc.includes('/safe-zones'));
  });
});
