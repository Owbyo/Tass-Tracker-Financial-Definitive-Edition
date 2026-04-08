import { prisma } from "@tass/db";
import type { MetadataProvider } from "../providers/contracts";

const MAX_METADATA_ROWS = 5000;
const METADATA_PROVIDER_TIMEOUT_MS = Number(process.env.METADATA_PROVIDER_TIMEOUT_MS ?? 30_000);

function normalizeProviderTickerToUsCanonical(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.US$/, "");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export async function metadataRefreshJob(metadataProvider: MetadataProvider) {
  console.log(`[metadata-refresh] start provider=${metadataProvider.name} timeoutMs=${METADATA_PROVIDER_TIMEOUT_MS}`);
  const localSymbols = await prisma.symbol.findMany({
    where: {
      isActive: true,
      watchlist: { is: { isActive: true } },
    },
    select: { ticker: true },
    orderBy: { ticker: "asc" },
  });

  const localTickers = localSymbols.map((symbol) => symbol.ticker);
  console.log(`[metadata-refresh] local watchlist symbols=${localTickers.length}`);
  console.log(`[metadata-refresh] calling provider.fetchMetadata provider=${metadataProvider.name}`);

  let rows: Awaited<ReturnType<MetadataProvider["fetchMetadata"]>>;
  try {
    rows = await withTimeout(
      metadataProvider.fetchMetadata(localTickers),
      METADATA_PROVIDER_TIMEOUT_MS,
      `metadataProvider.fetchMetadata(${metadataProvider.name})`,
    );
  } catch (error) {
    console.error(
      `[metadata-refresh] failed while fetching metadata provider=${metadataProvider.name} error=${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
  console.log(`[metadata-refresh] provider response received provider=${metadataProvider.name} rows=${rows.length}`);

  if (rows.length === 0) {
    console.warn(`[metadata-refresh] provider returned empty payload provider=${metadataProvider.name}`);
  }

  const allowedTickers = new Set(localTickers.map((ticker) => normalizeProviderTickerToUsCanonical(ticker)));
  const rowsToProcess = rows
    .filter((row) => allowedTickers.has(normalizeProviderTickerToUsCanonical(row.ticker)))
    .slice(0, MAX_METADATA_ROWS);
  console.log(`[metadata-refresh] symbols to process count=${rowsToProcess.length} (raw=${rows.length})`);

  let processed = 0;
  let resolved = 0;
  let unresolved = 0;
  let totalExistingFound = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let skippedBecauseUnchanged = 0;
  let skippedBecauseInvalid = 0;
  let skippedBecauseMissingData = 0;
  let skippedBecauseAlreadyFresh = 0;
  let writeErrors = 0;

  try {
    for (const row of rowsToProcess) {
      processed += 1;
      try {
        const canonicalTicker = row.ticker ? normalizeProviderTickerToUsCanonical(row.ticker) : "";
        if (!canonicalTicker || !row.name) {
          totalSkipped += 1;
          skippedBecauseInvalid += 1;
          continue;
        }

        const symbol = await prisma.symbol.findUnique({ where: { ticker: canonicalTicker } });
        if (!symbol) {
          unresolved += 1;
          totalSkipped += 1;
          skippedBecauseMissingData += 1;
          console.warn(
            `[metadata-refresh] symbol missing ticker=${row.ticker} canonicalTicker=${canonicalTicker} processed=${processed} resolved=${resolved} unresolved=${unresolved}`,
          );
          continue;
        }

        totalExistingFound += 1;

        const nextName = row.name;
        const nextExchange = row.exchange ?? symbol.exchange;
        const nextSector = row.sector ?? symbol.sector;
        const nextIndustry = row.industry ?? symbol.industry;

        const unchanged =
          symbol.name === nextName &&
          symbol.exchange === nextExchange &&
          symbol.sector === nextSector &&
          symbol.industry === nextIndustry;

        if (unchanged) {
          totalSkipped += 1;
          skippedBecauseUnchanged += 1;
          continue;
        }

        await prisma.symbol.update({
          where: { id: symbol.id },
          data: {
            name: nextName,
            exchange: nextExchange,
            sector: nextSector,
            industry: nextIndustry,
          },
        });
        resolved += 1;
        totalUpdated += 1;
      } catch (error) {
        unresolved += 1;
        writeErrors += 1;
        console.error(
          `[metadata-refresh] failed ticker=${row.ticker} processed=${processed} resolved=${resolved} unresolved=${unresolved} error=${error instanceof Error ? error.message : String(error)}`,
        );
      }

      console.log(`[metadata-refresh] progress processed=${processed} resolved=${resolved} unresolved=${unresolved}`);
    }
  } catch (error) {
    console.error(
      `[metadata-refresh] fatal error processed=${processed} resolved=${resolved} unresolved=${unresolved} error=${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }

  console.log(`[metadata-refresh] completed successfully processed=${processed} resolved=${resolved} unresolved=${unresolved}`);
  console.log(
    `[metadata-refresh] stats ${JSON.stringify({
      provider: metadataProvider.name,
      totalSymbolsProcessed: processed,
      totalExistingFound,
      totalCreated,
      totalUpdated,
      totalSkipped,
      skippedBecauseUnchanged,
      skippedBecauseInvalid,
      skippedBecauseMissingData,
      skippedBecauseAlreadyFresh,
      writeErrors,
    })}`,
  );

  return {
    recordsRead: rowsToProcess.length,
    recordsWritten: totalCreated + totalUpdated,
    metadata: {
      provider: metadataProvider.name,
      processed,
      resolved,
      unresolved,
      timedOutMs: METADATA_PROVIDER_TIMEOUT_MS,
      totalSymbolsProcessed: processed,
      totalExistingFound,
      totalCreated,
      totalUpdated,
      totalSkipped,
      skippedBecauseUnchanged,
      skippedBecauseInvalid,
      skippedBecauseMissingData,
      skippedBecauseAlreadyFresh,
      writeErrors,
    },
  };
}
