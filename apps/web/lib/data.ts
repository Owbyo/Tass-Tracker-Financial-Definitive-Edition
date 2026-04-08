import { prisma, type Prisma } from "@tass/db";

type WatchlistItemWithRelations = Prisma.WatchlistItemGetPayload<{
  include: {
    symbol: {
      include: {
        quoteLatest: true;
        analyses: true;
      };
    };
  };
}>;

function minutesFrom(date: Date | null): number | null {
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

export async function getWatchlistRows() {
  const items = await prisma.watchlistItem.findMany({
    where: { isActive: true },
    orderBy: { positionOrder: "asc" },
    include: {
      symbol: {
        include: {
          quoteLatest: true,
          analyses: {
            orderBy: { snapshotAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return items.map((item: WatchlistItemWithRelations) => {
    const latestAnalysis = item.symbol.analyses[0];
    const quoteAsOf = item.symbol.quoteLatest?.asOf ?? null;

    return {
      watchlistItemId: item.id,
      ticker: item.symbol.ticker,
      name: item.symbol.name,
      positionOrder: item.positionOrder,
      price: item.symbol.quoteLatest?.price?.toString() ?? null,
      changePct: item.symbol.quoteLatest?.changePct?.toString() ?? null,
      quoteAsOf,
      quoteFreshnessMinutes: minutesFrom(quoteAsOf),
      analysis: latestAnalysis
        ? {
            snapshotAt: latestAnalysis.snapshotAt,
            formulaVersion: latestAnalysis.formulaVersion,
            isPlaceholder: latestAnalysis.isPlaceholder,
            dataStatus: latestAnalysis.dataStatus,
            tassScore: latestAnalysis.tassScore?.toString() ?? null,
            tassCategory: latestAnalysis.tassCategory,
            entryWindow: latestAnalysis.entryWindow,
            exitWindow: latestAnalysis.exitWindow,
          }
        : null,
    };
  });
}

export async function getStockDetail(ticker: string) {
  const symbol = await prisma.symbol.findUnique({
    where: { ticker: ticker.toUpperCase() },
    include: {
      quoteLatest: true,
      analyses: { orderBy: { snapshotAt: "desc" }, take: 10 },
    },
  });

  if (!symbol) return null;

  return {
    ...symbol,
    quoteFreshnessMinutes: minutesFrom(symbol.quoteLatest?.asOf ?? null),
  };
}

export async function getOpsSummary() {
  const [quotes, analysis, jobs] = await Promise.all([
    prisma.quoteLatest.aggregate({ _max: { asOf: true }, _count: { symbolId: true } }),
    prisma.stockAnalysisSnapshot.aggregate({ _max: { snapshotAt: true }, _count: { id: true } }),
    prisma.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);

  const quotesAsOf = quotes._max.asOf ?? null;
  const analysisAsOf = analysis._max.snapshotAt ?? null;

  return {
    quotes: {
      count: quotes._count.symbolId,
      asOf: quotesAsOf,
      freshnessMinutes: minutesFrom(quotesAsOf),
    },
    analysis: {
      count: analysis._count.id,
      asOf: analysisAsOf,
      freshnessMinutes: minutesFrom(analysisAsOf),
    },
    jobRuns: jobs,
  };
}
