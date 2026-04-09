import { getWorkerConfig } from "@tass/config";
import { runWithJobRecord } from "./orchestration/job-runner";
import { quotesRefreshJob } from "./jobs/quotes-refresh";
import { metadataRefreshJob } from "./jobs/metadata-refresh";
import { analysisRefreshJobForSymbols } from "./jobs/analysis-refresh";
import { createProviderSelection } from "./providers/factory";

function parseTickerArgs(argv: string[]): string[] {
  return argv
    .filter((arg) => arg.startsWith("--ticker="))
    .map((arg) => arg.replace("--ticker=", "").trim().toUpperCase())
    .filter(Boolean);
}

async function main() {
  const config = getWorkerConfig();
  const jobName = process.argv[2] ?? "quotes-refresh";
  const scopedTickers = parseTickerArgs(process.argv.slice(3));
  const providers = createProviderSelection({
    quotesProvider: config.quotesProvider,
    metadataProvider: config.metadataProvider,
  });

  const jobs: Record<string, () => Promise<{ recordsRead: number; recordsWritten: number; metadata?: unknown }>> = {
    "quotes-refresh": () => quotesRefreshJob(providers.quotesProvider, { tickers: scopedTickers }),
    "metadata-refresh": () => metadataRefreshJob(providers.metadataProvider),
    "analysis-refresh": () => analysisRefreshJobForSymbols({ tickers: scopedTickers }),
  };

  const job = jobs[jobName];
  if (!job) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  await runWithJobRecord(jobName, job);
  console.log(`Job completed: ${jobName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
