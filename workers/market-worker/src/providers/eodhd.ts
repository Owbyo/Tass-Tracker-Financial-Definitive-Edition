import type { MetadataProvider, NormalizedDailyBar, NormalizedQuote, NormalizedSymbolMetadata, QuotesProvider } from "./contracts";

const METADATA_PROVIDER_TIMEOUT_MS = Number(process.env.METADATA_PROVIDER_TIMEOUT_MS ?? 30_000);

function requireEodhdApiKey() {
  const key = process.env.EODHD_API_KEY;
  if (!key) {
    throw new Error("Missing EODHD_API_KEY for EODHD provider");
  }
  return key;
}

export class EodhdQuotesProvider implements QuotesProvider {
  readonly name = "eodhd";

  async fetchQuote(ticker: string): Promise<NormalizedQuote | null> {
    const bars = await this.fetchDailyBars(ticker, 2);
    const last = bars[bars.length - 1];
    if (!last) return null;

    return {
      ticker,
      sessionDate: last.sessionDate,
      asOf: new Date(),
      price: last.close,
      open: last.open,
      volume: last.volume,
      source: this.name,
    };
  }

  async fetchDailyBars(ticker: string, lookbackSessions: number): Promise<NormalizedDailyBar[]> {
    const apiKey = requireEodhdApiKey();
    const symbol = `${ticker}.US`;
    const url = `https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&fmt=json&period=d&order=a`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`EODHD daily history failed for ${ticker}: ${res.status}`);
    }

    const data = (await res.json()) as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;

    return data
      .map((row) => ({
        sessionDate: new Date(`${row.date}T00:00:00Z`),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }))
      .filter((x) => Number.isFinite(x.open) && Number.isFinite(x.close) && Number.isFinite(x.high) && Number.isFinite(x.low))
      .slice(-lookbackSessions);
  }
}

export class EodhdMetadataProvider implements MetadataProvider {
  readonly name = "eodhd";

  async fetchMetadata(tickers: string[]): Promise<NormalizedSymbolMetadata[]> {
    if (tickers.length === 0) return [];

    const apiKey = requireEodhdApiKey();
    const canonicalTickers = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase().replace(/\.US$/, "")).filter(Boolean))];
    const output: NormalizedSymbolMetadata[] = [];

    for (const ticker of canonicalTickers) {
      const symbol = `${ticker}.US`;
      const url = `https://eodhd.com/api/fundamentals/${symbol}?api_token=${apiKey}&fmt=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), METADATA_PROVIDER_TIMEOUT_MS);

      const res = await (async () => {
        try {
          return await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }
      })();

      if (!res.ok) {
        throw new Error(`EODHD fundamentals failed for ${ticker}: ${res.status}`);
      }

      const payload = (await res.json()) as {
        General?: {
          Code?: string;
          Name?: string;
          Exchange?: string;
          Sector?: string;
          Industry?: string;
        };
      };

      const general = payload.General;
      if (!general?.Code) continue;

      output.push({
        ticker: general.Code.toUpperCase().replace(/\.US$/, ""),
        name: general.Name?.trim() || ticker,
        exchange: "US",
        sector: general.Sector ?? null,
        industry: general.Industry ?? null,
      });
    }

    return output;
  }
}
