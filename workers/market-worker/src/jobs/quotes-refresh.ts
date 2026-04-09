import { prisma } from "@tass/db";
import type { QuotesProvider } from "../providers/contracts";

const RECONCILIATION_LOOKBACK = 40;
const ANALYSIS_MIN_BARS = 250;
const BACKFILL_LOOKBACK = 320;

type QuotesRefreshOptions = {
  tickers?: string[];
  forceBackfill?: boolean;
};

export async function quotesRefreshJob(quotesProvider: QuotesProvider, options: QuotesRefreshOptions = {}) {
  const scopedTickers = options.tickers?.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);

  const watchlistItems = await prisma.watchlistItem.findMany({
    where: {
      isActive: true,
      symbol: {
        isActive: true,
        ...(scopedTickers?.length ? { ticker: { in: scopedTickers } } : {}),
      },
    },
    select: { symbol: { select: { id: true, ticker: true } } },
    orderBy: { positionOrder: "asc" },
  });
  const symbols = watchlistItems.map((item) => item.symbol);
  if (symbols.length === 0) {
    return {
      recordsRead: 0,
      recordsWritten: 0,
      metadata: {
        provider: quotesProvider.name,
        mode: "incremental-reconciliation",
        lookbackSessions: RECONCILIATION_LOOKBACK,
        barsUpserted: 0,
        backfillLookbackSessions: BACKFILL_LOOKBACK,
      },
    };
  }

  const latestBars = await prisma.dailyBar.findMany({
    where: { symbolId: { in: symbols.map((s) => s.id) } },
    orderBy: [{ symbolId: "asc" }, { sessionDate: "desc" }],
  });
  const barCounts = await prisma.dailyBar.groupBy({
    by: ["symbolId"],
    where: { symbolId: { in: symbols.map((s) => s.id) } },
    _count: { symbolId: true },
  });

  const latestBySymbolId = new Map<string, Date>();
  for (const row of latestBars) {
    if (!latestBySymbolId.has(row.symbolId)) {
      latestBySymbolId.set(row.symbolId, row.sessionDate);
    }
  }
  const barCountBySymbolId = new Map<string, number>();
  for (const row of barCounts) {
    barCountBySymbolId.set(row.symbolId, row._count.symbolId);
  }

  let written = 0;
  let barsUpserted = 0;

  for (const symbol of symbols) {
    const persistedCount = barCountBySymbolId.get(symbol.id) ?? 0;
    const needsBackfill = options.forceBackfill || persistedCount < ANALYSIS_MIN_BARS;
    const lookback = needsBackfill ? BACKFILL_LOOKBACK : RECONCILIATION_LOOKBACK;
    const bars = await quotesProvider.fetchDailyBars(symbol.ticker, lookback);
    const latestBar = bars[bars.length - 1];
    if (!latestBar) continue;

    const lastPersistedDate = latestBySymbolId.get(symbol.id) ?? null;
    const barsToPersist = needsBackfill
      ? bars
      : lastPersistedDate
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
      backfillLookbackSessions: BACKFILL_LOOKBACK,
      barsUpserted,
    },
  };
}
