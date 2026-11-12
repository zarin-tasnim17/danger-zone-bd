import { apiFetch } from "@/lib/api";

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024; // 5MB

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
  isMock?: boolean;
}

export interface ConfirmedMediaResponse {
  id: string;
  reportId: string;
  blurredUrl: string | null;
  createdAt: string;
}

export type EvidenceValidationResult =
  | { valid: true }
  | {
      valid: false;
      code: "EMPTY_FILE" | "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE";
      message: string;
    };

export function validateEvidenceFile(file: File): EvidenceValidationResult {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type as (typeof ALLOWED_EVIDENCE_MIME_TYPES)[number])) {
    return {
      valid: false,
      code: "UNSUPPORTED_TYPE",
      message: "Unsupported image format. Please select a JPEG, PNG, or WebP photo.",
    };
  }

  if (!file.size || file.size <= 0) {
    return {
      valid: false,
      code: "EMPTY_FILE",
      message: "Selected image file is empty.",
    };
  }

  if (file.size > MAX_EVIDENCE_FILE_BYTES) {
    return {
      valid: false,
      code: "FILE_TOO_LARGE",
      message: "File size exceeds the 5MB maximum limit.",
    };
  }

  return { valid: true };
}

function estimateBase64Bytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) return Infinity;
  const base64 = dataUrl.slice(commaIdx + 1);
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Downscales and compresses an evidence image in-browser for S3-less mock environments.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDimension = 1024,
  maxBytes = 350 * 1024
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode selected image for upload."));
      el.src = objectUrl;
    });

    const naturalW = img.naturalWidth || img.width || maxDimension;
    const naturalH = img.naturalHeight || img.height || maxDimension;
    const initialScale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));

    const preferredMime =
      file.type === "image/webp" ? "image/webp" : "image/jpeg";

    for (const scaleFactor of [1, 0.75, 0.55]) {
      const targetW = Math.max(1, Math.round(naturalW * initialScale * scaleFactor));
      const targetH = Math.max(1, Math.round(naturalH * initialScale * scaleFactor));

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Browser canvas is unavailable to compress evidence photo.");
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      for (const mime of [preferredMime, "image/jpeg"] as const) {
        for (const quality of [0.82, 0.7, 0.56, 0.42]) {
          const dataUrl = canvas.toDataURL(mime, quality);
          if (
            (dataUrl.startsWith("data:image/jpeg;base64,") ||
              dataUrl.startsWith("data:image/webp;base64,") ||
              dataUrl.startsWith("data:image/png;base64,")) &&
            estimateBase64Bytes(dataUrl) <= maxBytes
          ) {
            return dataUrl;
          }
        }
      }
    }

    throw new Error("Compressed photo still exceeds mock upload size limit (350KB). Please choose a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Full citizen photo evidence pipeline:
 * 1. Requests presigned upload metadata (`GET /media/presigned-url`).
 * 2. When S3/R2/Supabase Storage is configured (`isMock === false`):
 *    performs direct binary PUT to `uploadUrl`, then confirms via `POST /media/confirm`
 *    with `{ reportId, fileKey, originalUrl: publicUrl }`.
 * 3. When cloud S3 is unconfigured (`isMock === true`):
 *    compresses the image client-side and submits via `POST /media/mock-upload`.
 */
export async function uploadReportEvidence(
  reportId: string,
  file: File
): Promise<ConfirmedMediaResponse> {
  const validation = validateEvidenceFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const query = new URLSearchParams({
    reportId,
    fileType: file.type,
    fileSize: String(file.size),
  });

  const presigned = await apiFetch<PresignedUrlResponse>(
    `/media/presigned-url?${query.toString()}`
  );

  if (presigned.isMock) {
    const imageDataUrl = await compressImageToDataUrl(file);
    return apiFetch<ConfirmedMediaResponse>("/media/mock-upload", {
      method: "POST",
      body: JSON.stringify({
        reportId,
        imageDataUrl,
      }),
    });
  }

  const putRes = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error(`Direct cloud storage upload failed (HTTP ${putRes.status}).`);
  }

  return apiFetch<ConfirmedMediaResponse>("/media/confirm", {
    method: "POST",
    body: JSON.stringify({
      reportId,
      fileKey: presigned.fileKey,
      originalUrl: presigned.publicUrl,
    }),
  });
}
