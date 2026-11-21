import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_BYTES,
  normalizeEvidenceMimeType,
  validateEvidenceFile,
} from '@/lib/mediaUpload';

describe('[Unit] Photo Evidence Adding & Validation', () => {
  it('1. Accepts valid JPEG, PNG, and WebP evidence photos within 5MB limit', () => {
    const validPng = new File([new Uint8Array(500 * 1024)], 'evidence.png', { type: 'image/png' });
    const validJpg = new File([new Uint8Array(1.5 * 1024 * 1024)], 'crime_scene.jpeg', { type: 'image/jpeg' });
    const validWebp = new File([new Uint8Array(800 * 1024)], 'damage.webp', { type: 'image/webp' });

    assert.deepEqual(validateEvidenceFile(validPng), { valid: true });
    assert.deepEqual(validateEvidenceFile(validJpg), { valid: true });
    assert.deepEqual(validateEvidenceFile(validWebp), { valid: true });
  });

  it('2. Normalizes mobile device MIME variants (image/jpg, image/pjpeg, uppercase)', () => {
    assert.equal(normalizeEvidenceMimeType('image/jpg'), 'image/jpeg');
    assert.equal(normalizeEvidenceMimeType('image/pjpeg'), 'image/jpeg');
    assert.equal(normalizeEvidenceMimeType('IMAGE/JPEG'), 'image/jpeg');
    assert.equal(normalizeEvidenceMimeType('image/png'), 'image/png');
    assert.equal(normalizeEvidenceMimeType('image/webp'), 'image/webp');

    const mobileJpg = new File([new Uint8Array(100 * 1024)], 'camera.jpg', { type: 'image/jpg' });
    assert.deepEqual(validateEvidenceFile(mobileJpg), { valid: true });
  });

  it('3. Strictly rejects unsupported MIME types (PDF, GIF, SVG, Executables)', () => {
    const unsupported = [
      new File([new Uint8Array(1024)], 'report.pdf', { type: 'application/pdf' }),
      new File([new Uint8Array(1024)], 'animated.gif', { type: 'image/gif' }),
      new File([new Uint8Array(1024)], 'vector.svg', { type: 'image/svg+xml' }),
      new File([new Uint8Array(1024)], 'malware.exe', { type: 'application/x-msdownload' }),
    ];

    for (const file of unsupported) {
      const res = validateEvidenceFile(file);
      assert.equal(res.valid, false);
      if (!res.valid) {
        assert.equal(res.code, 'UNSUPPORTED_TYPE');
      }
    }
  });

  it('4. Rejects empty (0-byte) image files', () => {
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    const res = validateEvidenceFile(emptyFile);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.equal(res.code, 'EMPTY_FILE');
    }
  });

  it('5. Strictly rejects files exceeding the 5MB maximum limit', () => {
    const exactly5MB = new File([new Uint8Array(MAX_EVIDENCE_FILE_BYTES)], 'max.jpg', {
      type: 'image/jpeg',
    });
    assert.deepEqual(validateEvidenceFile(exactly5MB), { valid: true });

    const oversized = new File([new Uint8Array(MAX_EVIDENCE_FILE_BYTES + 1)], 'too_large.jpg', {
      type: 'image/jpeg',
    });
    const res = validateEvidenceFile(oversized);
    assert.equal(res.valid, false);
    if (!res.valid) {
      assert.equal(res.code, 'FILE_TOO_LARGE');
    }
  });

  it('6. Enforces exact constant boundaries', () => {
    assert.equal(MAX_EVIDENCE_FILE_BYTES, 5 * 1024 * 1024);
    assert.deepEqual([...ALLOWED_EVIDENCE_MIME_TYPES], ['image/jpeg', 'image/png', 'image/webp']);
  });
});
