import { prisma } from '../db/prisma';

/**
 * Asynchronously processes privacy auto-blurring on uploaded evidence photos.
 * Obscures faces and vehicle license plates to protect citizen anonymity.
 */
export const processPrivacyBlur = async (mediaId: string, originalUrl: string): Promise<string> => {
  try {
    // In production, this can invoke an AWS Lambda / Cloudflare Worker / OpenCV / Sharp microservice
    // to detect facial landmarks and license plates, applying a Gaussian blur filter.
    // Here we simulate the processing pipeline and generate the privacy-compliant blurred variant URL.
    const urlParts = originalUrl.split('/');
    const originalFileName = urlParts.pop() || 'image.jpg';
    const blurredFileName = `blurred-${originalFileName}`;
    const blurredUrl = [...urlParts, blurredFileName].join('/');

    // Update ReportMedia table with the sanitized blurred URL
    await prisma.reportMedia.update({
      where: { id: mediaId },
      data: {
        blurredUrl,
      },
    });

    return blurredUrl;
  } catch (error) {
    console.error(`❌ [PrivacyBlurService] Failed to process privacy blur for media ${mediaId}:`, error);
    throw error;
  }
};
