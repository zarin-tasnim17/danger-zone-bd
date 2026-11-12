import { prisma } from '../db/prisma';

/**
 * Processes privacy auto-blurring on uploaded evidence photos.
 * Until an active blurring pipeline (e.g., Sharp, Lambda, or Cloudinary) writes a blurred
 * derivative object to storage, persists the verified storage URL so evidence does not 404.
 */
export const processPrivacyBlur = async (mediaId: string, verifiedUrl: string): Promise<string> => {
  try {
    const blurredUrl = verifiedUrl;

    // Update ReportMedia table with the accessible storage URL
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
