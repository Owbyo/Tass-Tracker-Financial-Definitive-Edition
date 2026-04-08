import type { MetadataProvider, NormalizedSymbolMetadata } from "./contracts";

const METADATA_PROVIDER_TIMEOUT_MS = Number(process.env.METADATA_PROVIDER_TIMEOUT_MS ?? 30_000);

export class SecMetadataProvider implements MetadataProvider {
  readonly name = "sec";

  async fetchMetadata(tickers: string[]): Promise<NormalizedSymbolMetadata[]> {
    if (tickers.length === 0) return [];

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

    const requested = new Set(tickers.map((ticker) => ticker.trim().toUpperCase().replace(/\.US$/, "")));
    const data = (await res.json()) as Record<string, { ticker: string; title: string }>;

    return Object.values(data)
      .map((item) => ({
        ticker: item.ticker.toUpperCase(),
        name: item.title,
      }))
      .filter((item) => requested.has(item.ticker));
  }
}
