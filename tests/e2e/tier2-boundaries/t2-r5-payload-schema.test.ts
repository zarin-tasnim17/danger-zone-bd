import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ApiAdapter } from '../harness/apiAdapter';

describe('Tier 2: Boundary & Corner Cases - R5: Payload Schema Boundaries & Strictness', () => {
  const adapter = new ApiAdapter();

  before(async () => {
    await adapter.start();
  });

  after(async () => {
    await adapter.stop();
  });

  it('T2-R5-01: Malformed JSON String Rejection', async () => {
    const rawMalformed = '{"startLat": 23.75, "startLng": ';

    const res = await adapter.calculateSafeRoute(rawMalformed, {
      headers: { 'Content-Type': 'application/json' },
    });

    assert.strictEqual(res.status, 400, `Expected 400 for malformed JSON, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'INVALID_JSON');
  });

  it('T2-R5-02: Strict Schema Rejection of Unexpected Extra Fields', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'driving',
      extraFieldUnrecognized: true,
      injectedPayload: 'malicious',
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 400, `Expected 400 for extra properties, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('T2-R5-03: Rejection of Invalid Transport Mode Enum', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      endLat: 23.765,
      endLng: 90.405,
      mode: 'transit', // Invalid enum
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 400, `Expected 400 for invalid mode, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('T2-R5-04: Rejection of Missing Required Coordinate Fields', async () => {
    const payload = {
      startLat: 23.75,
      startLng: 90.39,
      // endLat omitted
      endLng: 90.405,
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 400, `Expected 400 for missing field, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('T2-R5-05: Rejection of Non-Numeric Coordinate Values', async () => {
    const payload = {
      startLat: '23.75', // string instead of number
      startLng: 90.39,
      endLat: 23.765,
      endLng: null, // null instead of number
    };

    const res = await adapter.calculateSafeRoute(payload);
    assert.strictEqual(res.status, 400, `Expected 400 for non-numeric types, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });
});
