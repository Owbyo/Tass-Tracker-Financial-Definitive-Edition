import { prisma } from "@tass/db";
import type { MetadataProvider } from "../providers/contracts";

const MAX_METADATA_ROWS = 5000;
const METADATA_PROVIDER_TIMEOUT_MS = Number(process.env.METADATA_PROVIDER_TIMEOUT_MS ?? 30_000);

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
  console.log(`[metadata-refresh] calling provider.fetchMetadata provider=${metadataProvider.name}`);

  let rows: Awaited<ReturnType<MetadataProvider["fetchMetadata"]>>;
  try {
    rows = await withTimeout(
      metadataProvider.fetchMetadata(),
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

  const rowsToProcess = rows.slice(0, MAX_METADATA_ROWS);
  console.log(`[metadata-refresh] symbols to process count=${rowsToProcess.length} (raw=${rows.length})`);

  let processed = 0;
  let resolved = 0;
  let unresolved = 0;

  try {
    for (const row of rowsToProcess) {
      processed += 1;
      try {
        const symbol = await prisma.symbol.findUnique({ where: { ticker: row.ticker } });
        if (!symbol) {
          unresolved += 1;
          console.warn(`[metadata-refresh] symbol missing ticker=${row.ticker} processed=${processed} resolved=${resolved} unresolved=${unresolved}`);
          continue;
        }

        await prisma.symbol.update({
          where: { id: symbol.id },
          data: {
            name: row.name,
            exchange: row.exchange ?? symbol.exchange,
            sector: row.sector ?? symbol.sector,
            industry: row.industry ?? symbol.industry,
          },
        });
        resolved += 1;
      } catch (error) {
        unresolved += 1;
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

  return {
    recordsRead: rowsToProcess.length,
    recordsWritten: resolved,
    metadata: { provider: metadataProvider.name, processed, resolved, unresolved, timedOutMs: METADATA_PROVIDER_TIMEOUT_MS },
  };
}
