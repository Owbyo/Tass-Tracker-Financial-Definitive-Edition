import test from "node:test";
import assert from "node:assert/strict";
import { getWorkerConfig } from "../index";

test("getWorkerConfig defaults to eodhd and requires key", () => {
  assert.throws(
    () =>
      getWorkerConfig({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/tass",
      }),
    /EODHD_API_KEY is required/,
  );
});

test("getWorkerConfig accepts stooq+sec without EODHD key", () => {
  const cfg = getWorkerConfig({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/tass",
    MARKET_DATA_PROVIDER: "stooq",
    METADATA_PROVIDER: "sec",
  });

  assert.equal(cfg.quotesProvider, "stooq");
  assert.equal(cfg.metadataProvider, "sec");
});

test("getWorkerConfig validates provider names", () => {
  assert.throws(
    () =>
      getWorkerConfig({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/tass",
        MARKET_DATA_PROVIDER: "foo",
      }),
    /Invalid MARKET_DATA_PROVIDER/,
  );
});
