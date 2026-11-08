import { prisma } from '../db/prisma';
import { classifyNewsText } from '../services/newsClassifierService';
import { calculateNewsReportExpiry } from '../services/newsCrawlerService';

export async function reclassifyAllNewsReports() {
  console.log('[Reclassify] 🚀 Scanning active news reports in database...');

  const reports = await prisma.report.findMany({
    where: {
      sourceUrl: { not: null },
    },
    include: {
      newsArticle: true,
    },
  });

  console.log(`[Reclassify] Found ${reports.length} news reports to evaluate.`);

  let updatedCount = 0;

  for (const report of reports) {
    // Determine the original headline
    const article = report.newsArticle;
    const rawHeadline = article?.title || report.description || '';
    
    // Clean description of bracketed crawler prefix
    const cleanDesc = (report.description || '').replace(/^\[(?:Google News[^\]]*|The Daily Star[^\]]*)\]\s*/i, '').trim();

    const classification = classifyNewsText(rawHeadline, cleanDesc);

    const categoryChanged = report.category !== classification.category;
    const severityChanged = report.severity !== classification.severity;
    const descChanged = report.description !== cleanDesc && cleanDesc.length > 0;

    if (categoryChanged || severityChanged || descChanged) {
      const newExpiresAt = calculateNewsReportExpiry(
        classification.category,
        article?.publishedAt || report.createdAt,
        new Date()
      );

      await prisma.report.update({
        where: { id: report.id },
        data: {
          category: classification.category,
          severity: classification.severity,
          description: cleanDesc || report.description || '',
          expiresAt: newExpiresAt,
        },
      });

      if (article) {
        await prisma.newsArticle.update({
          where: { id: article.id },
          data: {
            category: classification.category,
            severity: classification.severity,
          },
        });
      }

      console.log(
        `[Reclassify] 🔄 ID: ${report.id.substring(0, 8)} | ${report.category} -> ${classification.category} | ${cleanDesc.substring(0, 50)}...`
      );
      updatedCount++;
    }
  }

  console.log(`[Reclassify] ✅ Done. Re-classified and cleaned ${updatedCount} / ${reports.length} reports.`);
  await prisma.$disconnect();
}

if (require.main === module) {
  reclassifyAllNewsReports().catch((e) => {
    console.error('[Reclassify] Error:', e);
    process.exit(1);
  });
}
