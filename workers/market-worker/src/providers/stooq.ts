import type { NormalizedDailyBar, NormalizedQuote, QuotesProvider } from "./contracts";

type StooqQuote = {
  symbol: string;
  date: Date;
  close: number;
  open: number;
};

function parseSingleCsv(csv: string): StooqQuote | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const [symbol, date, time, open, _high, _low, close] = lines[1].split(",");
  if (!symbol || close === "N/D") return null;
  const parsedClose = Number(close);
  const parsedOpen = Number(open);
  if (!Number.isFinite(parsedClose)) return null;

  return {
    symbol,
    date: new Date(`${date}T${time === "N/D" ? "00:00:00" : time}Z`),
    close: parsedClose,
    open: Number.isFinite(parsedOpen) ? parsedOpen : parsedClose,
  };
}

export class StooqQuotesProvider implements QuotesProvider {
  readonly name = "stooq";

  async fetchQuote(ticker: string): Promise<NormalizedQuote | null> {
    const url = `https://stooq.com/q/l/?s=${ticker.toLowerCase()}.us&i=d`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Stooq fetch failed for ${ticker}: ${response.status}`);
    }

    const csv = await response.text();
    const quote = parseSingleCsv(csv);
    if (!quote) return null;

    return {
      ticker,
      sessionDate: quote.date,
      asOf: new Date(),
      price: quote.close,
      open: quote.open,
      volume: null,
      source: this.name,
    };
  }

  async fetchDailyBars(ticker: string, lookbackSessions: number): Promise<NormalizedDailyBar[]> {
    const url = `https://stooq.com/q/d/l/?s=${ticker.toLowerCase()}.us&i=d`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Stooq daily history failed for ${ticker}: ${response.status}`);
    }

    const csv = await response.text();
    const lines = csv.trim().split(/\r?\n/);
    const rows = lines.slice(1).map((line) => line.split(","));

    const bars = rows
      .map((parts) => {
        const [date, open, high, low, close, volume] = parts;
        const parsed = {
          sessionDate: new Date(`${date}T00:00:00Z`),
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
        };

        if (!Number.isFinite(parsed.open) || !Number.isFinite(parsed.high) || !Number.isFinite(parsed.low) || !Number.isFinite(parsed.close)) {
          return null;
        }

        return parsed;
      })
      .filter((row): row is NormalizedDailyBar => row !== null)
      .slice(-lookbackSessions);

    return bars;
  }
}
