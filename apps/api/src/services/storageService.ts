import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_INLINE_MOCK_IMAGE_BYTES = 512 * 1024; // 512KB max decoded inline mock evidence

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_MEDIA_FILENAME_REGEX = /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
const INLINE_IMAGE_DATA_URL_REGEX = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i;

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
  isMock: boolean;
}

export interface ResolveConfirmedMediaInput {
  reportId: string;
  originalUrl?: string;
  fileKey?: string;
}

const MIME_EXTENSION_MAP: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const readRuntimeSetting = (key: keyof typeof env): string | undefined => {
  const raw = key in process.env ? process.env[key] : (env[key] as string | undefined);
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
};

const getStorageConfig = () => ({
  bucket: readRuntimeSetting('S3_BUCKET') || env.S3_BUCKET,
  region: readRuntimeSetting('S3_REGION') || env.S3_REGION,
  s3PublicDomain: readRuntimeSetting('S3_PUBLIC_DOMAIN'),
  storageCdnUrl: readRuntimeSetting('STORAGE_CDN_URL'),
  s3Endpoint: readRuntimeSetting('S3_ENDPOINT'),
});

const parseHttpUrl = (rawUrl: string): URL | null => {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

// Initialize S3 client if credentials exist
let s3Client: S3Client | null = null;
if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: Boolean(env.S3_ENDPOINT),
  });
}

/**
 * Safely URL-decodes a storage object key.
 */
export const decodeStorageKey = (rawKey: string): string | null => {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    return null;
  }
};

/**
 * Validates and parses a report media key matching `reports/{reportId}/{filename}`.
 */
export const parseReportMediaKey = (
  rawKey: string,
  expectedReportId?: string
): { reportId: string; fileKey: string } | null => {
  const decoded = decodeStorageKey(rawKey.trim());
  if (!decoded || decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('..')) {
    return null;
  }

  const parts = decoded.split('/');
  if (parts.length !== 3 || parts[0] !== 'reports') {
    return null;
  }

  const [, reportId, filename] = parts;
  if (!UUID_REGEX.test(reportId)) {
    return null;
  }

  if (expectedReportId && reportId.toLowerCase() !== expectedReportId.toLowerCase()) {
    return null;
  }

  // Skip derivative blurred assets and enforce safe image extensions
  if (filename.startsWith('blurred-') || !SAFE_MEDIA_FILENAME_REGEX.test(filename)) {
    return null;
  }

  return { reportId, fileKey: decoded };
};

/**
 * Resolves the trusted storage base URLs configured for this deployment.
 */
export const getTrustedStorageBaseUrls = (): URL[] => {
  const { bucket, region, s3PublicDomain, storageCdnUrl, s3Endpoint } = getStorageConfig();
  const hasExplicitOverride = Boolean(s3PublicDomain || storageCdnUrl || s3Endpoint);
  const explicitBases: URL[] = [];

  for (const candidate of [
    s3PublicDomain,
    storageCdnUrl,
    s3Endpoint ? `${s3Endpoint.replace(/\/+$/, '')}/${bucket}` : undefined,
  ]) {
    if (!candidate) continue;
    const parsed = parseHttpUrl(candidate);
    if (parsed) {
      explicitBases.push(parsed);
    }
  }

  if (hasExplicitOverride) {
    return explicitBases;
  }

  return [new URL(`https://${bucket}.s3.${region}.amazonaws.com`)];
};

/**
 * Returns public CDN or bucket URL for a given file key
 */
export const getPublicUrl = (fileKey: string): string => {
  const { bucket, region, s3PublicDomain, storageCdnUrl, s3Endpoint } = getStorageConfig();
  const publicBase = s3PublicDomain || storageCdnUrl;
  if (publicBase) {
    return `${publicBase.replace(/\/+$/, '')}/${fileKey}`;
  }
  if (s3Endpoint) {
    return `${s3Endpoint.replace(/\/+$/, '')}/${bucket}/${fileKey}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${fileKey}`;
};

/**
 * Validates `fileKey` and/or `originalUrl` for `/media/confirm`, ensuring trusted origin and report ownership path.
 */
export const resolveTrustedReportMedia = (
  input: ResolveConfirmedMediaInput
): { fileKey: string; originalUrl: string } => {
  const { reportId, originalUrl, fileKey } = input;
  if (!UUID_REGEX.test(reportId)) {
    throw Object.assign(new Error('reportId must be a valid UUID'), { statusCode: 400 });
  }

  if (!originalUrl && !fileKey) {
    throw Object.assign(new Error('Either originalUrl or fileKey must be provided'), { statusCode: 400 });
  }

  let parsedFromKey: { reportId: string; fileKey: string } | null = null;
  if (fileKey) {
    parsedFromKey = parseReportMediaKey(fileKey, reportId);
    if (!parsedFromKey) {
      throw Object.assign(
        new Error(`fileKey must match reports/${reportId}/<valid-image-filename>`),
        { statusCode: 400 }
      );
    }
  }

  let parsedFromUrl: { fileKey: string; normalizedUrl: string; isEndpointOnly: boolean } | null = null;
  if (originalUrl) {
    if (originalUrl.includes('\\')) {
      throw Object.assign(new Error('originalUrl contains invalid path characters'), { statusCode: 400 });
    }

    const candidateUrl = parseHttpUrl(originalUrl);
    if (!candidateUrl) {
      throw Object.assign(
        new Error('originalUrl must be an http/https URL without credentials, query parameters, or fragments'),
        { statusCode: 400 }
      );
    }

    const { bucket, s3PublicDomain, storageCdnUrl, s3Endpoint } = getStorageConfig();
    const endpointBase = s3Endpoint
      ? parseHttpUrl(`${s3Endpoint.replace(/\/+$/, '')}/${bucket}`)
      : null;
    const endpointNormalizedBase = endpointBase
      ? `${endpointBase.origin}${endpointBase.pathname.replace(/\/+$/, '')}`
      : undefined;
    const publicOverrideConfigured = Boolean(s3PublicDomain || storageCdnUrl);

    for (const base of getTrustedStorageBaseUrls()) {
      if (candidateUrl.origin !== base.origin) {
        continue;
      }

      const basePath = base.pathname.replace(/\/+$/, '');
      const expectedPrefix = `${basePath}/`;
      if (!candidateUrl.pathname.startsWith(expectedPrefix)) {
        continue;
      }

      const relativePath = candidateUrl.pathname.slice(expectedPrefix.length);
      const parsedKey = parseReportMediaKey(relativePath, reportId);
      if (parsedKey) {
        const matchedBase = `${base.origin}${basePath}`;
        parsedFromUrl = {
          fileKey: parsedKey.fileKey,
          normalizedUrl: `${matchedBase}/${parsedKey.fileKey}`,
          isEndpointOnly: Boolean(
            endpointNormalizedBase && matchedBase === endpointNormalizedBase && publicOverrideConfigured
          ),
        };
        break;
      }
    }

    if (!parsedFromUrl) {
      throw Object.assign(
        new Error(`originalUrl must start with a trusted storage prefix under reports/${reportId}/`),
        { statusCode: 400 }
      );
    }
  }

  if (parsedFromKey && parsedFromUrl && parsedFromKey.fileKey !== parsedFromUrl.fileKey) {
    throw Object.assign(
      new Error('fileKey and originalUrl refer to different storage objects'),
      { statusCode: 400 }
    );
  }

  const resolvedFileKey = parsedFromUrl?.fileKey || parsedFromKey!.fileKey;
  const resolvedUrl =
    parsedFromUrl && !parsedFromUrl.isEndpointOnly
      ? parsedFromUrl.normalizedUrl
      : getPublicUrl(resolvedFileKey);

  return {
    fileKey: resolvedFileKey,
    originalUrl: resolvedUrl,
  };
};

/**
 * Generates a short-lived presigned upload URL for direct client-to-storage upload
 */
export const generatePresignedUploadUrl = async (
  reportId: string,
  fileType: AllowedMimeType,
  fileSizeBytes: number
): Promise<PresignedUploadResult> => {
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    throw new Error(`Unsupported MIME type: ${fileType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${fileSizeBytes} bytes) exceeds 5MB limit (${MAX_FILE_SIZE_BYTES} bytes).`);
  }

  const extension = MIME_EXTENSION_MAP[fileType];
  const fileKey = `reports/${reportId}/${randomUUID()}.${extension}`;
  const expiresInSeconds = 600; // 10 minutes
  const publicUrl = getPublicUrl(fileKey);

  // If S3 client is configured with real credentials, generate real signed URL
  if (s3Client) {
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: fileKey,
      ContentType: fileType,
      ContentLength: fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    return {
      uploadUrl,
      fileKey,
      publicUrl,
      expiresInSeconds,
      isMock: false,
    };
  }

  // Graceful Fallback / Mock Storage Provider for dev and automated tests
  const mockUploadUrl = `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${fileKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=mock-valid-sig`;

  return {
    uploadUrl: mockUploadUrl,
    fileKey,
    publicUrl,
    expiresInSeconds,
    isMock: true,
  };
};

export const isS3Configured = (): boolean => Boolean(s3Client);

/**
 * Validates and normalizes compressed base64 image data URLs for S3-less mock fallback mode.
 * Verifies exact MIME header, base64 integrity, decoded byte limit (<= 512KB), and binary magic bytes.
 */
export const validateCompressedInlineImage = (
  rawDataUrl: string
): { mimeType: AllowedMimeType; normalizedDataUrl: string } => {
  const trimmed = rawDataUrl.trim();
  const match = trimmed.match(INLINE_IMAGE_DATA_URL_REGEX);
  if (!match) {
    throw Object.assign(
      new Error('Invalid imageDataUrl: must be a base64 data URI for image/jpeg, image/png, or image/webp'),
      { statusCode: 400 }
    );
  }

  const mimeType = match[1].toLowerCase() as AllowedMimeType;
  const base64Payload = match[2];
  const buffer = Buffer.from(base64Payload, 'base64');

  if (buffer.length === 0 || buffer.length > MAX_INLINE_MOCK_IMAGE_BYTES) {
    throw Object.assign(
      new Error(`Compressed mock image must be between 1 byte and ${MAX_INLINE_MOCK_IMAGE_BYTES} bytes (512KB)`),
      { statusCode: 400 }
    );
  }

  const hasValidMagicBytes =
    (mimeType === 'image/jpeg' &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (mimeType === 'image/png' &&
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a) ||
    (mimeType === 'image/webp' &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP');

  if (!hasValidMagicBytes) {
    throw Object.assign(
      new Error(`Invalid image signature: payload bytes do not match declared ${mimeType}`),
      { statusCode: 400 }
    );
  }

  return {
    mimeType,
    normalizedDataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
  };
};
