import { prisma } from '../db/prisma';
import { isForeignIncident } from '../services/internationalIncidentFilter';

export async function purgeAllForeignReports() {
  console.log('[Purge Foreign News] 🚀 Scanning active news reports for overseas incidents...');

  const reports = await prisma.report.findMany({
    where: {
      sourceUrl: { not: null },
    },
    include: {
      newsArticle: true,
    },
  });

  console.log(`[Purge Foreign News] Found ${reports.length} total news reports to evaluate.`);

  let purgedCount = 0;

  for (const report of reports) {
    const articleTitle = report.newsArticle?.title || '';
    const desc = report.description || '';

    const check = isForeignIncident(articleTitle || desc, desc);

    if (check.isForeign) {
      console.log(
        `[Purge Foreign News] 🗑️ Deleting overseas report: ID ${report.id.substring(0, 8)} | Term: "${check.matchedTerm}" | Headline: "${(articleTitle || desc).substring(0, 65)}..."`
      );

      // Delete child NewsArticle first if exists
      if (report.newsArticle) {
        await prisma.newsArticle.delete({
          where: { id: report.newsArticle.id },
        });
      }

      // Delete parent Report
      await prisma.report.delete({
        where: { id: report.id },
      });

      purgedCount++;
    }
  }

  console.log(
    `[Purge Foreign News] ✅ Purge complete. Successfully removed ${purgedCount} overseas reports. Remaining domestic reports: ${reports.length - purgedCount}.`
  );

  await prisma.$disconnect();
}

if (require.main === module) {
  purgeAllForeignReports().catch((e) => {
    console.error('[Purge Foreign News] ❌ Error:', e);
    process.exit(1);
  });
}
