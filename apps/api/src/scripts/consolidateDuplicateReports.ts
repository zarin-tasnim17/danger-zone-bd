import { prisma } from '../db/prisma';
import { calculateStorySimilarity } from '../services/incidentDeduplicationService';
import { classifyNewsText } from '../services/newsClassifierService';

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
      if (primary.sourceName) allSources.add(primary.sourceName);

      for (const dup of duplicates) {
        console.log(`  Duplicate: "${dup.description?.substring(0, 60)}..." (${dup.sourceName})`);
        if (dup.sourceName) allSources.add(dup.sourceName);

        // Move or update any associated news articles to unlink from duplicate report
        await prisma.newsArticle.updateMany({
          where: { reportId: dup.id },
          data: { reportId: null },
        });

        // Delete associated records before removing duplicate report
        await prisma.vote.deleteMany({ where: { reportId: dup.id } });
        await prisma.reportUpdate.deleteMany({ where: { reportId: dup.id } });
        await prisma.reportMedia.deleteMany({ where: { reportId: dup.id } });
        await prisma.moderationLog.deleteMany({ where: { targetReportId: dup.id } });

        // Delete the duplicate Report row (eliminates duplicate pin from map)
        await prisma.report.delete({ where: { id: dup.id } });
        duplicatesConsolidated++;
      }

      // Update primary report with consolidated sources and extra confidence upvotes
      const consolidatedSources = Array.from(allSources).join(', ');
      await prisma.report.update({
        where: { id: primary.id },
        data: {
          sourceName: consolidatedSources,
          upvotes: { increment: duplicates.length * 2 },
        },
      });

      console.log(`  ✅ Consolidated into single pin with sources: "${consolidatedSources}"`);
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
