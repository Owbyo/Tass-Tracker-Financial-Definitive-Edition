import { PrismaClient, UniverseType } from "@prisma/client";

const prisma = new PrismaClient();

const core = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"];
const market = ["SPY", "QQQ", "IWM"];
const sectorEtfs = ["XLK", "XLY", "XLC"];
const sectorMap: Record<string, string> = {
  AAPL: "XLK",
  MSFT: "XLK",
  NVDA: "XLK",
  AMZN: "XLY",
  META: "XLC",
  GOOGL: "XLC",
  TSLA: "XLY",
};

async function ensureSymbol(ticker: string) {
  return prisma.symbol.upsert({
    where: { ticker },
    create: { ticker, name: ticker, exchange: "US" },
    update: {},
  });
}

async function main() {
  const tickers = [...new Set([...core, ...market, ...sectorEtfs])];

  for (const ticker of tickers) {
    const symbol = await ensureSymbol(ticker);

    const universes: UniverseType[] = [];
    if (core.includes(ticker)) universes.push(UniverseType.CORE);
    if (market.includes(ticker)) universes.push(UniverseType.MARKET);

    for (const universe of universes) {
      await prisma.symbolUniverse.upsert({
        where: { symbolId_universe: { symbolId: symbol.id, universe } },
        create: { symbolId: symbol.id, universe },
        update: { isActive: true },
      });
    }

    if (core.includes(ticker)) {
      const count = await prisma.watchlistItem.count();
      await prisma.watchlistItem.upsert({
        where: { symbolId: symbol.id },
        create: { symbolId: symbol.id, positionOrder: count + 1 },
        update: { isActive: true },
      });
    }
  }

  for (const [ticker, etf] of Object.entries(sectorMap)) {
    const symbol = await prisma.symbol.findUniqueOrThrow({ where: { ticker } });
    const etfSymbol = await prisma.symbol.findUniqueOrThrow({ where: { ticker: etf } });
    await prisma.symbolSectorEtfMap.upsert({
      where: { symbolId: symbol.id },
      create: { symbolId: symbol.id, sectorEtfSymbolId: etfSymbol.id },
      update: { sectorEtfSymbolId: etfSymbol.id },
    });
  }
}

main().finally(async () => prisma.$disconnect());
