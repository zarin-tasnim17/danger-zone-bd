import { randomUUID } from 'crypto';

export class SeededPrng {
  private state: number;

  constructor(seed = 20261112) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }
}

let seq = 0;
export const randomSuffix = (): string => {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 7)}`;
};

export const randomUuid = (): string => randomUUID();
export const nonExistentUuid = (): string => '00000000-0000-4000-8000-000000009999';

export const SMALL_DHAKA_POLYGON: [number, number][] = [
  [90.37, 23.74],
  [90.38, 23.74],
  [90.38, 23.75],
  [90.37, 23.75],
  [90.37, 23.74],
];

export const OVERSIZED_POLYGON: [number, number][] = [
  [90.2, 23.6],
  [90.4, 23.6],
  [90.4, 23.8],
  [90.2, 23.8],
  [90.2, 23.6],
];

export const UNCLOSED_POLYGON: [number, number][] = [
  [90.37, 23.74],
  [90.38, 23.74],
  [90.38, 23.75],
  [90.37, 23.75],
];

export const BOWTIE_SELF_INTERSECTING_POLYGON: [number, number][] = [
  [90.37, 23.74],
  [90.38, 23.75],
  [90.38, 23.74],
  [90.37, 23.75],
  [90.37, 23.74],
];

// Authentic 1x1 PNG bytes
const VALID_PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Authentic minimal JPEG SOI+APP0+EOI header bytes
const VALID_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

// Authentic RIFF....WEBP header bytes
const VALID_WEBP_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
]);

export const TEST_MEDIA = {
  validPngDataUrl: `data:image/png;base64,${VALID_PNG_BYTES.toString('base64')}`,
  validJpegDataUrl: `data:image/jpeg;base64,${VALID_JPEG_BYTES.toString('base64')}`,
  validWebpDataUrl: `data:image/webp;base64,${VALID_WEBP_BYTES.toString('base64')}`,
  spoofedHtmlAsPngDataUrl: `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`,
  mismatchedPngAsJpegDataUrl: `data:image/jpeg;base64,${VALID_PNG_BYTES.toString('base64')}`,
};
