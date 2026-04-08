import type { MetadataProvider, QuotesProvider } from "./contracts";
import { EodhdMetadataProvider, EodhdQuotesProvider } from "./eodhd";
import { SecMetadataProvider } from "./sec-metadata";
import { StooqQuotesProvider } from "./stooq";
import type { MetadataProviderName, QuotesProviderName } from "@tass/config";

export type ProviderSelection = {
  quotesProvider: QuotesProvider;
  metadataProvider: MetadataProvider;
};

export function createProviderSelection(config: {
  quotesProvider: QuotesProviderName;
  metadataProvider: MetadataProviderName;
}): ProviderSelection {
  const quotesProvider = config.quotesProvider === "stooq" ? new StooqQuotesProvider() : new EodhdQuotesProvider();

  const metadataProvider = config.metadataProvider === "sec" ? new SecMetadataProvider() : new EodhdMetadataProvider();

  return {
    quotesProvider,
    metadataProvider,
  };
}
