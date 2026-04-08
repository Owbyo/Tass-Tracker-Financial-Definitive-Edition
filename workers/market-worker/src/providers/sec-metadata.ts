import type { MetadataProvider, NormalizedSymbolMetadata } from "./contracts";

export class SecMetadataProvider implements MetadataProvider {
  readonly name = "sec";

  async fetchMetadata(): Promise<NormalizedSymbolMetadata[]> {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": "TassTracker/0.1 personal-use" },
    });

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
