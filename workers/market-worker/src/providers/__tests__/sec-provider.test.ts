import test from "node:test";
import assert from "node:assert/strict";
import { SecMetadataProvider } from "../sec-metadata";

test("sec provider normalizes metadata payload", async () => {
  const provider = new SecMetadataProvider();
  const originalFetch = global.fetch;

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        "0": { ticker: "AAPL", title: "Apple Inc." },
      }),
      { status: 200 },
    )) as typeof fetch;

  const rows = await provider.fetchMetadata();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.ticker, "AAPL");
  assert.equal(rows[0]?.name, "Apple Inc.");

  global.fetch = originalFetch;
});
