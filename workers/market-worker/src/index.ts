import { getWorkerConfig } from "@tass/config";
import { runWithJobRecord } from "./orchestration/job-runner";
import { quotesRefreshJob } from "./jobs/quotes-refresh";
import { metadataRefreshJob } from "./jobs/metadata-refresh";
import { analysisRefreshJob } from "./jobs/analysis-refresh";
import { createProviderSelection } from "./providers/factory";

async function main() {
  const config = getWorkerConfig();
  const jobName = process.argv[2] ?? "quotes-refresh";
  const providers = createProviderSelection({
    quotesProvider: config.quotesProvider,
    metadataProvider: config.metadataProvider,
  });

  const jobs: Record<string, () => Promise<{ recordsRead: number; recordsWritten: number; metadata?: unknown }>> = {
    "quotes-refresh": () => quotesRefreshJob(providers.quotesProvider),
    "metadata-refresh": () => metadataRefreshJob(providers.metadataProvider),
    "analysis-refresh": analysisRefreshJob,
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
