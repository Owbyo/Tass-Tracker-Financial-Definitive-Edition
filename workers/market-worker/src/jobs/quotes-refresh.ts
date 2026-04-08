import { prisma } from "@tass/db";
import type { QuotesProvider } from "../providers/contracts";

const RECONCILIATION_LOOKBACK = 40;

export async function quotesRefreshJob(quotesProvider: QuotesProvider) {
  const watchlistItems = await prisma.watchlistItem.findMany({
    where: {
      isActive: true,
      symbol: { isActive: true },
    },
    select: { symbol: { select: { id: true, ticker: true } } },
    orderBy: { positionOrder: "asc" },
  });
  const symbols = watchlistItems.map((item) => item.symbol);

  const latestBars = await prisma.dailyBar.findMany({
    where: { symbolId: { in: symbols.map((s) => s.id) } },
    orderBy: [{ symbolId: "asc" }, { sessionDate: "desc" }],
  });

  const latestBySymbolId = new Map<string, Date>();
  for (const row of latestBars) {
    if (!latestBySymbolId.has(row.symbolId)) {
      latestBySymbolId.set(row.symbolId, row.sessionDate);
    }
  }

  let written = 0;
  let barsUpserted = 0;

  for (const symbol of symbols) {
    const bars = await quotesProvider.fetchDailyBars(symbol.ticker, RECONCILIATION_LOOKBACK);
    const latestBar = bars[bars.length - 1];
    if (!latestBar) continue;

    const lastPersistedDate = latestBySymbolId.get(symbol.id) ?? null;
    const barsToPersist = lastPersistedDate
      ? bars.filter((b) => b.sessionDate >= new Date(lastPersistedDate.getTime() - 24 * 60 * 60 * 1000))
      : bars;

    for (const bar of barsToPersist) {
      await prisma.dailyBar.upsert({
        where: { symbolId_sessionDate: { symbolId: symbol.id, sessionDate: bar.sessionDate } },
        create: {
          symbolId: symbol.id,
          sessionDate: bar.sessionDate,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: BigInt(Math.round(bar.volume)),
          source: quotesProvider.name,
        },
        update: {
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: BigInt(Math.round(bar.volume)),
          source: quotesProvider.name,
        },
      });
      barsUpserted += 1;
    }

    const avgVolume20 = bars.slice(-20).reduce((acc, b) => acc + b.volume, 0) / Math.max(1, Math.min(20, bars.length));
    const prev = bars.length >= 2 ? bars[bars.length - 2]! : latestBar;
    const changeAbs = latestBar.close - prev.close;
    const changePct = prev.close !== 0 ? (changeAbs / prev.close) * 100 : null;

    await prisma.quoteLatest.upsert({
      where: { symbolId: symbol.id },
      create: {
        symbolId: symbol.id,
        price: latestBar.close,
        changeAbs,
        changePct,
        volume: BigInt(Math.round(latestBar.volume)),
        avgVolume20d: BigInt(Math.round(avgVolume20)),
        sessionDate: latestBar.sessionDate,
        asOf: new Date(),
        source: quotesProvider.name,
      },
      update: {
        price: latestBar.close,
        changeAbs,
        changePct,
        volume: BigInt(Math.round(latestBar.volume)),
        avgVolume20d: BigInt(Math.round(avgVolume20)),
        sessionDate: latestBar.sessionDate,
        asOf: new Date(),
        source: quotesProvider.name,
      },
    });

    written += 1;
  }

  return {
    recordsRead: symbols.length,
    recordsWritten: written,
    metadata: {
      provider: quotesProvider.name,
      mode: "incremental-reconciliation",
      lookbackSessions: RECONCILIATION_LOOKBACK,
      barsUpserted,
    },
  };
}
