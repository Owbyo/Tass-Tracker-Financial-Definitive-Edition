import test from "node:test";
import assert from "node:assert/strict";
import { createProviderSelection } from "../factory";

test("factory returns eodhd providers when configured", () => {
  const providers = createProviderSelection({
    quotesProvider: "eodhd",
    metadataProvider: "eodhd",
  });

  assert.equal(providers.quotesProvider.name, "eodhd");
  assert.equal(providers.metadataProvider.name, "eodhd");
});

test("factory returns stooq/sec adapters when configured", () => {
  const providers = createProviderSelection({
    quotesProvider: "stooq",
    metadataProvider: "sec",
  });

  assert.equal(providers.quotesProvider.name, "stooq");
  assert.equal(providers.metadataProvider.name, "sec");
});
