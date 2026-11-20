import { prisma } from '../db/prisma';
import { calculateStorySimilarity } from '../services/incidentDeduplicationService';
import { classifyNewsText } from '../services/newsClassifierService';
import { isWireSyndicatedStory } from '../services/publisherRegistry';
import { setReportLocation } from '../db/spatialUtils';

async function main() {
  console.log('🚀 Scanning active reports for duplicates and misclassifications...');

  const activeReports = await prisma.report.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Found ${activeReports.length} total active reports in database.`);

  let misclassificationsFixed = 0;
  let duplicatesConsolidated = 0;

  // Step 1: Re-classify any misclassified reports based on refined classifier
  for (const report of activeReports) {
    const reclassified = classifyNewsText(report.description || '');
    if (reclassified.isSafetyRelated && reclassified.category !== report.category) {
      await prisma.report.update({
        where: { id: report.id },
        data: { category: reclassified.category },
      });
      console.log(`[Reclassify] 🔄 Updated "${report.description?.substring(0, 50)}..." (${report.category} -> ${reclassified.category})`);
      report.category = reclassified.category;
      misclassificationsFixed++;
    }
  }

  // Step 2: Find and consolidate spatial/semantic duplicate reports
  const processedReportIds = new Set<string>();

  for (let i = 0; i < activeReports.length; i++) {
    const primary = activeReports[i];
    if (processedReportIds.has(primary.id)) continue;

    const duplicates: typeof activeReports = [];

    for (let j = i + 1; j < activeReports.length; j++) {
      const secondary = activeReports[j];
      if (processedReportIds.has(secondary.id)) continue;

      // Spatial check: ~3.5km (0.035 deg)
      const dLat = Math.abs(primary.latitude - secondary.latitude);
      const dLng = Math.abs(primary.longitude - secondary.longitude);
      if (dLat > 0.035 || dLng > 0.035) continue;

      // Category check
      if (primary.category !== secondary.category) continue;

      // Semantic title similarity check
      const sim = calculateStorySimilarity(primary.description || '', secondary.description || '');
      if (sim.isDuplicate) {
        duplicates.push(secondary);
        processedReportIds.add(secondary.id);
      }
    }

    if (duplicates.length > 0) {
      console.log(`\n[Consolidate] 🔗 Found ${duplicates.length} duplicate(s) for primary Report ${primary.id}:`);
      console.log(`  Primary: "${primary.description?.substring(0, 60)}..." (${primary.sourceName})`);

      const allSources = new Set<string>();
      if (primary.sourceName) {
        primary.sourceName.split(',').forEach((s) => allSources.add(s.trim()));
      }

      // Initialize citations array from primary
      const primaryCitations: any[] = Array.isArray(primary.citations)
        ? [...(primary.citations as any[])]
        : primary.sourceUrl
          ? [{ sourceName: primary.sourceName || 'Press', sourceUrl: primary.sourceUrl, title: primary.description?.split('\n')[0] }]
          : [];
      const existingCitationUrls = new Set(primaryCitations.map((c) => c.sourceUrl).filter(Boolean));

      let nonWireDuplicatesCount = 0;
      let hasIndependentPress = false;

      // Check coordinate upgrades
      let newLat = primary.latitude;
      let newLng = primary.longitude;
      let newPrecision = primary.locationPrecision || 'UPAZILA';
      let upgradedCoords = false;

      for (const dup of duplicates) {
        console.log(`  Duplicate: "${dup.description?.substring(0, 60)}..." (${dup.sourceName})`);
        if (dup.sourceName) {
          dup.sourceName.split(',').forEach((s) => allSources.add(s.trim()));
        }

        // Merge citations losslessly
        const dupCitations: any[] = Array.isArray(dup.citations)
          ? (dup.citations as any[])
          : dup.sourceUrl
            ? [{ sourceName: dup.sourceName || 'Press', sourceUrl: dup.sourceUrl, title: dup.description?.split('\n')[0] }]
            : [];
        for (const c of dupCitations) {
          if (c.sourceUrl && !existingCitationUrls.has(c.sourceUrl)) {
            existingCitationUrls.add(c.sourceUrl);
            primaryCitations.push(c);
          }
        }

        // Wire syndication check for upvotes
        const wireCheck = isWireSyndicatedStory(dup.sourceUrl || '', dup.sourceName || '', dup.description || '');
        if (!wireCheck.isWire) {
          nonWireDuplicatesCount++;
          hasIndependentPress = true;
        }

        // Coordinate precision upgrading
        if (newPrecision === 'DISTRICT' && (dup.locationPrecision === 'UPAZILA' || dup.locationPrecision === 'EXACT')) {
          newLat = dup.latitude;
          newLng = dup.longitude;
          newPrecision = dup.locationPrecision;
          upgradedCoords = true;
        } else if (newPrecision === 'UPAZILA' && dup.locationPrecision === 'EXACT') {
          newLat = dup.latitude;
          newLng = dup.longitude;
          newPrecision = 'EXACT';
          upgradedCoords = true;
        }

        // Lossless NewsArticle re-linking: Point duplicate articles to primary.id (NEVER null or delete!)
        await prisma.newsArticle.updateMany({
          where: { reportId: dup.id },
          data: { reportId: primary.id },
        });

        // Re-link child media and updates to primary
        await prisma.reportMedia.updateMany({
          where: { reportId: dup.id },
          data: { reportId: primary.id },
        });
        await prisma.reportUpdate.updateMany({
          where: { reportId: dup.id },
          data: { reportId: primary.id },
        });

        // Transfer votes safely
        const dupVotes = await prisma.vote.findMany({ where: { reportId: dup.id } });
        for (const vote of dupVotes) {
          try {
            const existingVote = await prisma.vote.findUnique({
              where: { userId_reportId: { userId: vote.userId, reportId: primary.id } },
            });
            if (!existingVote) {
              await prisma.vote.update({
                where: { id: vote.id },
                data: { reportId: primary.id },
              });
            } else {
              await prisma.vote.delete({ where: { id: vote.id } });
            }
          } catch {
            // Safe vote conflict ignore
          }
        }

        await prisma.moderationLog.deleteMany({ where: { targetReportId: dup.id } });

        // Strictly preserve citizen reports: never delete reports without sourceUrl (citizen-authored)
        const isCitizenReport = !dup.sourceUrl;
        if (!isCitizenReport) {
          await prisma.report.delete({ where: { id: dup.id } });
          duplicatesConsolidated++;
        } else {
          console.log(`  🛡️ Preserved citizen report ${dup.id} from deletion during consolidation.`);
        }
      }

      // Synchronize PostGIS location if coordinates were upgraded
      if (upgradedCoords) {
        await setReportLocation(prisma, primary.id, newLat, newLng);
      }

      // Verification stage promotion
      let nextStage = primary.verificationStage;
      if (primary.verificationStage !== 'ADMIN_VERIFIED' && hasIndependentPress) {
        nextStage = 'PRESS_CORROBORATED';
      }

      // Update primary report with consolidated sources, merged citations, and wire-safe upvotes
      const consolidatedSources = Array.from(allSources).join(', ');
      const upvoteIncrement = nonWireDuplicatesCount * 2;

      await prisma.report.update({
        where: { id: primary.id },
        data: {
          sourceName: consolidatedSources,
          citations: primaryCitations,
          verificationStage: nextStage,
          ...(upvoteIncrement > 0 ? { upvotes: { increment: upvoteIncrement } } : {}),
          ...(upgradedCoords ? { latitude: newLat, longitude: newLng, locationPrecision: newPrecision } : {}),
        },
      });

      console.log(`  ✅ Consolidated into single pin with sources: "${consolidatedSources}" (Upvotes: +${upvoteIncrement}, Stage: ${nextStage})`);
    }

    processedReportIds.add(primary.id);
  }

  console.log(`\n🎉 Consolidation complete!`);
  console.log(`- Fixed misclassifications: ${misclassificationsFixed}`);
  console.log(`- Merged duplicate reports: ${duplicatesConsolidated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
