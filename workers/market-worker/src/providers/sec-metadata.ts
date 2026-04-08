import type { MetadataProvider, NormalizedSymbolMetadata } from "./contracts";

const METADATA_PROVIDER_TIMEOUT_MS = Number(process.env.METADATA_PROVIDER_TIMEOUT_MS ?? 30_000);

export class SecMetadataProvider implements MetadataProvider {
  readonly name = "sec";

  async fetchMetadata(): Promise<NormalizedSymbolMetadata[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), METADATA_PROVIDER_TIMEOUT_MS);
    const res = await (async () => {
      try {
        return await fetch("https://www.sec.gov/files/company_tickers.json", {
          headers: { "User-Agent": "TassTracker/0.1 personal-use" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    if (!res.ok) {
      throw new Error(`SEC metadata failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, { ticker: string; title: string }>;
    return Object.values(data).map((item) => ({
      ticker: item.ticker.toUpperCase(),
      name: item.title,
    }));
  }
}
