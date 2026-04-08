export type NormalizedQuote = {
  ticker: string;
  sessionDate: Date;
  asOf: Date;
  price: number;
  open: number | null;
  volume: number | null;
  source: string;
};

export type NormalizedDailyBar = {
  sessionDate: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type NormalizedSymbolMetadata = {
  ticker: string;
  name: string;
  exchange?: string | null;
  sector?: string | null;
  industry?: string | null;
};

export interface QuotesProvider {
  readonly name: string;
  fetchQuote(ticker: string): Promise<NormalizedQuote | null>;
  fetchDailyBars(ticker: string, lookbackSessions: number): Promise<NormalizedDailyBar[]>;
}

export interface MetadataProvider {
  readonly name: string;
  fetchMetadata(tickers: string[]): Promise<NormalizedSymbolMetadata[]>;
}
