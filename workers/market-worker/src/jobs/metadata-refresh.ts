import { prisma } from "@tass/db";
import type { MetadataProvider } from "../providers/contracts";

export async function metadataRefreshJob(metadataProvider: MetadataProvider) {
  const rows = await metadataProvider.fetchMetadata();
  let updated = 0;

  for (const row of rows.slice(0, 5000)) {
    const symbol = await prisma.symbol.findUnique({ where: { ticker: row.ticker } });
    if (!symbol) continue;

    await prisma.symbol.update({
      where: { id: symbol.id },
      data: {
        name: row.name,
        exchange: row.exchange ?? symbol.exchange,
        sector: row.sector ?? symbol.sector,
        industry: row.industry ?? symbol.industry,
      },
    });
    updated += 1;
  }

  return {
    recordsRead: rows.length,
    recordsWritten: updated,
    metadata: { provider: metadataProvider.name },
  };
}
