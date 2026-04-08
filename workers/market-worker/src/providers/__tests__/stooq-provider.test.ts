import test from "node:test";
import assert from "node:assert/strict";
import { StooqQuotesProvider } from "../stooq";

test("stooq provider normalizes quote payload", async () => {
  const provider = new StooqQuotesProvider();
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response("Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-04-08,22:00:00,180.00,181.00,179.00,180.50,100")
  ) as typeof fetch;

  const quote = await provider.fetchQuote("AAPL");

  assert.ok(quote);
  assert.equal(quote?.ticker, "AAPL");
  assert.equal(quote?.price, 180.5);
  assert.equal(quote?.open, 180);
  assert.equal(quote?.source, "stooq");

  global.fetch = originalFetch;
});
