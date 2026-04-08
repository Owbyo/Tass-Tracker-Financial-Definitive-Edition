import test from "node:test";
import assert from "node:assert/strict";
import { computeTassV1, FORMULA_VERSION, type DailyBar } from "../tass-v1-engine";

function fixtureBars(days: number, start: number, slope: number, volume: number): DailyBar[] {
  return Array.from({ length: days }, (_, i) => {
    const close = start + slope * i;
    return {
      sessionDate: new Date(Date.UTC(2025, 0, i + 1)),
      open: close - 0.4,
      high: close + 0.8,
      low: close - 0.8,
      close,
      volume: volume + i * 50,
    };
  });
}

test("integration fixture: complete output contract", () => {
  const out = computeTassV1({
    ticker: "AAPL",
    symbolBars: fixtureBars(260, 100, 0.45, 1_500_000),
    spyBars: fixtureBars(260, 100, 0.25, 1_000_000),
    sectorBars: fixtureBars(260, 95, 0.2, 900_000),
    marketRegime: "RISK_ON",
    sectorScore: 62,
  });

  assert.equal(out.formulaVersion, FORMULA_VERSION);
  assert.equal(out.dataStatus, "OK");
  assert.ok(out.tassScore !== null);
  assert.ok(out.entryScore !== null);
  assert.ok(out.exitScore !== null);
  assert.equal(typeof out.factorScores.trendStructure, "number");
  assert.ok(Array.isArray(out.explanation.summary));
  assert.ok(Array.isArray(out.hardInvalidations));
});
