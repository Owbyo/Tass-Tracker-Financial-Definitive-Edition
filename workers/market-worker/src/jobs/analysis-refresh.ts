import { type DailyBar, type MarketRegime, prisma } from "@tass/db";
import { TassV1ScoringEngine } from "../scoring/engine";

const engine = new TassV1ScoringEngine();

type DbBar = Pick<DailyBar, "sessionDate" | "open" | "high" | "low" | "close" | "volume">;

function toBars(rows: DbBar[]) {
  return rows.map((r) => ({
    sessionDate: r.sessionDate,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume ?? 0n),
  }));
}

export async function analysisRefreshJob() {
  return analysisRefreshJobForSymbols();
}

type AnalysisRefreshOptions = {
  tickers?: string[];
};

export async function analysisRefreshJobForSymbols(options: AnalysisRefreshOptions = {}) {
  const scopedTickers = options.tickers?.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);

  const watchlistItems = await prisma.watchlistItem.findMany({
    where: {
      isActive: true,
      symbol: {
        isActive: true,
        ...(scopedTickers?.length ? { ticker: { in: scopedTickers } } : {}),
      },
    },
    select: { symbolId: true },
  });
  const watchlistSymbolIds = watchlistItems.map((item) => item.symbolId);

  const symbols = await prisma.symbol.findMany({
    where: {
      isActive: true,
      id: { in: watchlistSymbolIds },
    },
    include: {
      dailyBars: { orderBy: { sessionDate: "asc" }, take: 320 },
      sectorEtfMap: { include: { sectorEtfSymbol: { include: { dailyBars: { orderBy: { sessionDate: "asc" }, take: 320 } } } } },
    },
  });

  const spy = await prisma.symbol.findUnique({
    where: { ticker: "SPY" },
    include: { dailyBars: { orderBy: { sessionDate: "asc" }, take: 320 } },
  });

  const latestMarket = await prisma.marketSnapshot.findFirst({ orderBy: { snapshotAt: "desc" } });

  const sectorTickers = [...new Set(symbols.map((s) => s.sectorEtfMap[0]?.sectorEtfSymbol?.ticker).filter((t): t is string => Boolean(t)))];

  const sectorSnapshots = sectorTickers.length
    ? await prisma.sectorSnapshot.findMany({
        where: { sectorEtfTicker: { in: sectorTickers } },
        orderBy: [{ sectorEtfTicker: "asc" }, { snapshotAt: "desc" }],
      })
    : [];

  const latestSectorByTicker = new Map<string, number>();
  for (const snap of sectorSnapshots) {
    if (!latestSectorByTicker.has(snap.sectorEtfTicker)) {
      latestSectorByTicker.set(snap.sectorEtfTicker, Number(snap.sectorScore));
    }
  }

  let written = 0;

  for (const symbol of symbols) {
    const sectorMap = symbol.sectorEtfMap[0] ?? null;
    const sectorTicker = sectorMap?.sectorEtfSymbol?.ticker ?? null;

    const result = await engine.compute({
      ticker: symbol.ticker,
      sector: symbol.sector,
      industry: symbol.industry,
      symbolBars: toBars(symbol.dailyBars),
      spyBars: spy ? toBars(spy.dailyBars) : null,
      sectorBars: sectorMap ? toBars(sectorMap.sectorEtfSymbol.dailyBars) : null,
      marketRegime: (latestMarket?.regime as MarketRegime | null) ?? null,
      sectorScore: sectorTicker ? latestSectorByTicker.get(sectorTicker) ?? null : null,
    });

    await prisma.stockAnalysisSnapshot.create({
      data: {
        symbolId: symbol.id,
        snapshotAt: new Date(),
        sessionDate: new Date(),
        formulaVersion: result.formulaVersion,
        dataStatus: result.dataStatus,
        isPlaceholder: result.dataStatus === "INSUFFICIENT_DATA",
        tassScore: result.tassScore,
        tassCategory: result.tassCategory,
        entryScore: result.entryScore,
        entryWindow: result.entryWindow,
        exitScore: result.exitScore,
        exitWindow: result.exitWindow,
        momentumScore: null,
        structureScore: null,
        relativeStrengthScore: null,
        stabilityScore: null,
        factorScoresJson: result.factorScores,
        hardInvalidationsJson: result.hardInvalidations,
        explanationJson: result.explanation,
        signalsJson: {
          hardExitCandidates: result.hardExitCandidates,
        },
      },
    });

    written += 1;
  }

  return {
    recordsRead: symbols.length,
    recordsWritten: written,
    metadata: { formulaVersion: "tass-v1.0.0", sectorSnapshotsPrefetched: sectorTickers.length },
  };
}
