const required = ["DATABASE_URL"] as const;

export type AppEnv = "development" | "test" | "production";
export type QuotesProviderName = "eodhd" | "stooq";
export type MetadataProviderName = "eodhd" | "sec";

export type WorkerConfig = {
  appEnv: AppEnv;
  databaseUrl: string;
  quotesProvider: QuotesProviderName;
  metadataProvider: MetadataProviderName;
  eodhdApiKey?: string;
};

function toAppEnv(value: string | undefined): AppEnv {
  if (value === "production" || value === "test") return value;
  return "development";
}

function toQuotesProvider(value: string | undefined): QuotesProviderName {
  const normalized = (value ?? "eodhd").toLowerCase();
  if (normalized === "eodhd" || normalized === "stooq") return normalized;
  throw new Error(`Invalid MARKET_DATA_PROVIDER: ${value}. Allowed: eodhd, stooq`);
}

function toMetadataProvider(value: string | undefined, fallback: QuotesProviderName): MetadataProviderName {
  const normalized = (value ?? fallback).toLowerCase();
  if (normalized === "eodhd" || normalized === "sec") return normalized;
  throw new Error(`Invalid METADATA_PROVIDER: ${value}. Allowed: eodhd, sec`);
}

export function assertEnv() {
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

export function getWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing required env var: DATABASE_URL");
  }

  const quotesProvider = toQuotesProvider(env.MARKET_DATA_PROVIDER);
  const metadataProvider = toMetadataProvider(env.METADATA_PROVIDER, quotesProvider);
  const appEnv = toAppEnv(env.NODE_ENV);

  const eodhdNeeded = quotesProvider === "eodhd" || metadataProvider === "eodhd";
  const eodhdApiKey = env.EODHD_API_KEY;

  if (eodhdNeeded && !eodhdApiKey) {
    throw new Error("EODHD_API_KEY is required when MARKET_DATA_PROVIDER or METADATA_PROVIDER uses eodhd");
  }

  return {
    appEnv,
    databaseUrl,
    quotesProvider,
    metadataProvider,
    eodhdApiKey,
  };
}

export const APP_ENV = toAppEnv(process.env.NODE_ENV);
