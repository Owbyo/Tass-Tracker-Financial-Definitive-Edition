-- Create enums
CREATE TYPE "UniverseType" AS ENUM ('CORE', 'DISCOVERY', 'MARKET');
CREATE TYPE "TassCategory" AS ENUM ('WEAK', 'FAIR', 'GOOD', 'STRONG', 'ELITE');
CREATE TYPE "EntryWindow" AS ENUM ('NO_ENTRY', 'WATCH', 'VALID_ENTRY', 'STRONG_ENTRY');
CREATE TYPE "ExitWindow" AS ENUM ('HOLD', 'PROFIT_WATCH', 'RISK_ZONE', 'EXIT_SIGNAL');
CREATE TYPE "DataStatus" AS ENUM ('OK', 'INSUFFICIENT_DATA');
CREATE TYPE "MarketRegime" AS ENUM ('RISK_ON', 'NEUTRAL', 'RISK_OFF');
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');
CREATE TYPE "JobTriggerType" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY');

-- Tables
CREATE TABLE "Symbol" (
  "id" TEXT PRIMARY KEY,
  "ticker" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "exchange" TEXT,
  "assetType" TEXT NOT NULL DEFAULT 'EQUITY',
  "sector" TEXT,
  "industry" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "SymbolUniverse" (
  "id" TEXT PRIMARY KEY,
  "symbolId" TEXT NOT NULL,
  "universe" "UniverseType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SymbolUniverse_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SymbolUniverse_symbolId_universe_key" UNIQUE ("symbolId", "universe")
);

CREATE TABLE "DailyBar" (
  "id" TEXT PRIMARY KEY,
  "symbolId" TEXT NOT NULL,
  "sessionDate" DATE NOT NULL,
  "open" DECIMAL(18,6) NOT NULL,
  "high" DECIMAL(18,6) NOT NULL,
  "low" DECIMAL(18,6) NOT NULL,
  "close" DECIMAL(18,6) NOT NULL,
  "volume" BIGINT,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyBar_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DailyBar_symbolId_sessionDate_key" UNIQUE ("symbolId", "sessionDate")
);

CREATE TABLE "SymbolSectorEtfMap" (
  "id" TEXT PRIMARY KEY,
  "symbolId" TEXT NOT NULL UNIQUE,
  "sectorEtfSymbolId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SymbolSectorEtfMap_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SymbolSectorEtfMap_sectorEtfSymbolId_fkey" FOREIGN KEY ("sectorEtfSymbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuoteLatest" (
  "symbolId" TEXT PRIMARY KEY,
  "price" DECIMAL(18,6) NOT NULL,
  "changeAbs" DECIMAL(18,6),
  "changePct" DECIMAL(9,4),
  "volume" BIGINT,
  "avgVolume20d" BIGINT,
  "sessionDate" DATE NOT NULL,
  "asOf" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  CONSTRAINT "QuoteLatest_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "StockAnalysisSnapshot" (
  "id" TEXT PRIMARY KEY,
  "symbolId" TEXT NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "sessionDate" DATE NOT NULL,
  "formulaVersion" TEXT NOT NULL,
  "dataStatus" "DataStatus" NOT NULL,
  "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
  "tassScore" DECIMAL(5,2),
  "tassCategory" "TassCategory",
  "entryScore" DECIMAL(5,2),
  "entryWindow" "EntryWindow",
  "exitScore" DECIMAL(5,2),
  "exitWindow" "ExitWindow",
  "momentumScore" DECIMAL(5,2),
  "structureScore" DECIMAL(5,2),
  "relativeStrengthScore" DECIMAL(5,2),
  "stabilityScore" DECIMAL(5,2),
  "factorScoresJson" JSONB,
  "hardInvalidationsJson" JSONB,
  "explanationJson" JSONB NOT NULL,
  "signalsJson" JSONB,
  CONSTRAINT "StockAnalysisSnapshot_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MarketSnapshot" (
  "id" TEXT PRIMARY KEY,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "regime" "MarketRegime" NOT NULL,
  "score" DECIMAL(5,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SectorSnapshot" (
  "id" TEXT PRIMARY KEY,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "sectorEtfTicker" TEXT NOT NULL,
  "sectorScore" DECIMAL(5,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WatchlistItem" (
  "id" TEXT PRIMARY KEY,
  "symbolId" TEXT NOT NULL UNIQUE,
  "positionOrder" INTEGER NOT NULL,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WatchlistItem_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "JobRun" (
  "id" TEXT PRIMARY KEY,
  "jobName" TEXT NOT NULL,
  "triggerType" "JobTriggerType" NOT NULL,
  "status" "JobStatus" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "recordsRead" INTEGER NOT NULL DEFAULT 0,
  "recordsWritten" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "metadataJson" JSONB
);

-- Indexes
CREATE INDEX "DailyBar_symbolId_sessionDate_idx" ON "DailyBar"("symbolId", "sessionDate" DESC);
CREATE INDEX "QuoteLatest_asOf_idx" ON "QuoteLatest"("asOf");
CREATE INDEX "QuoteLatest_changePct_idx" ON "QuoteLatest"("changePct");
CREATE INDEX "StockAnalysisSnapshot_symbolId_snapshotAt_idx" ON "StockAnalysisSnapshot"("symbolId", "snapshotAt" DESC);
CREATE INDEX "StockAnalysisSnapshot_sessionDate_tassScore_idx" ON "StockAnalysisSnapshot"("sessionDate", "tassScore" DESC);
CREATE INDEX "MarketSnapshot_snapshotAt_idx" ON "MarketSnapshot"("snapshotAt" DESC);
CREATE INDEX "SectorSnapshot_sectorEtfTicker_snapshotAt_idx" ON "SectorSnapshot"("sectorEtfTicker", "snapshotAt" DESC);
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt" DESC);
CREATE INDEX "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt" DESC);
