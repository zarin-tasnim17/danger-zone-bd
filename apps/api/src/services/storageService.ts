import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { env } from '../config/env';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

const MIME_EXTENSION_MAP: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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
 * Returns public CDN or bucket URL for a given file key
 */
export const getPublicUrl = (fileKey: string): string => {
  if (env.STORAGE_CDN_URL) {
    return `${env.STORAGE_CDN_URL.replace(/\/$/, '')}/${fileKey}`;
  }
  if (env.S3_ENDPOINT) {
    return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${fileKey}`;
  }
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${fileKey}`;
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
    };
  }

  // Graceful Fallback / Mock Storage Provider for dev and automated tests
  const mockUploadUrl = `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${fileKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=mock&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=mock-valid-sig`;

  return {
    uploadUrl: mockUploadUrl,
    fileKey,
    publicUrl,
    expiresInSeconds,
  };
};
