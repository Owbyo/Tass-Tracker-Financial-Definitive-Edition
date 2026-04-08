import test from "node:test";
import assert from "node:assert/strict";
import { computeTassV1, mappingFns, type DailyBar } from "../tass-v1-engine";

function makeBars(days: number, start = 100, step = 0.5, vol = 1_000_000): DailyBar[] {
  const arr: DailyBar[] = [];
  for (let i = 0; i < days; i += 1) {
    const close = start + step * i;
    arr.push({
      sessionDate: new Date(Date.UTC(2025, 0, 1 + i)),
      open: close - 0.6,
      high: close + 1,
      low: close - 1,
      close,
      volume: vol + i * 100,
    });
  }
  return arr;
}

function withBreakdown(bars: DailyBar[]): DailyBar[] {
  const copy = [...bars];
  const i = copy.length - 1;
  copy[i] = { ...copy[i]!, close: copy[i]!.close - 30, open: copy[i]!.close + 5, low: copy[i]!.close - 35, high: copy[i]!.close + 6 };
  copy[i - 1] = { ...copy[i - 1]!, close: copy[i - 1]!.close - 25, open: copy[i - 1]!.close + 2, low: copy[i - 1]!.close - 30, high: copy[i - 1]!.close + 3 };
  return copy;
}

test("1) Tass category mapping", () => {
  assert.equal(mappingFns.mapTassCategory(10), "WEAK");
  assert.equal(mappingFns.mapTassCategory(40), "FAIR");
  assert.equal(mappingFns.mapTassCategory(60), "GOOD");
  assert.equal(mappingFns.mapTassCategory(70), "STRONG");
  assert.equal(mappingFns.mapTassCategory(90), "ELITE");
});

test("2) Entry window mapping", () => {
  assert.equal(mappingFns.mapEntryWindow(30, [], 80), "NO_ENTRY");
  assert.equal(mappingFns.mapEntryWindow(50, [], 80), "WATCH");
  assert.equal(mappingFns.mapEntryWindow(70, [], 80), "VALID_ENTRY");
  assert.equal(mappingFns.mapEntryWindow(85, [], 80), "STRONG_ENTRY");
  assert.equal(mappingFns.mapEntryWindow(85, ["risk too wide"], 80), "NO_ENTRY");
});

test("3) Exit window mapping", () => {
  assert.equal(mappingFns.mapExitWindow(20, []), "HOLD");
  assert.equal(mappingFns.mapExitWindow(40, []), "PROFIT_WATCH");
  assert.equal(mappingFns.mapExitWindow(60, []), "RISK_ZONE");
  assert.equal(mappingFns.mapExitWindow(90, []), "EXIT_SIGNAL");
});

test("4) Hard invalidations appear on weak/invalid setup", () => {
  const bars = makeBars(260, 100, -0.2, 500_000);
  const spy = makeBars(260, 100, 0.1, 500_000);
  const out = computeTassV1({
    ticker: "AAA",
    symbolBars: bars,
    spyBars: spy,
    sectorBars: null,
    marketRegime: "RISK_OFF",
    sectorScore: 40,
  });

  assert.ok(out.hardInvalidations.includes("tassScore < 35") || out.hardInvalidations.includes("market regime RISK_OFF + sector score < 50"));
});

test("5) Hard exit override triggers EXIT_SIGNAL", () => {
  const base = makeBars(260, 100, 0.3, 1_500_000);
  const broken = withBreakdown(base);
  const spy = makeBars(260, 100, 0.2, 1_000_000);
  const out = computeTassV1({
    ticker: "BBB",
    symbolBars: broken,
    spyBars: spy,
    sectorBars: makeBars(260, 90, 0.15, 900_000),
    marketRegime: "NEUTRAL",
    sectorScore: 55,
  });

  assert.equal(out.exitWindow, "EXIT_SIGNAL");
});

test("6) Insufficient data status when bars < 250", () => {
  const out = computeTassV1({
    ticker: "CCC",
    symbolBars: makeBars(120),
    spyBars: makeBars(260),
    sectorBars: null,
    marketRegime: "RISK_ON",
    sectorScore: null,
  });
  assert.equal(out.dataStatus, "INSUFFICIENT_DATA");
  assert.equal(out.tassScore, null);
});

test("7) Missing sector ETF does not force insufficient", () => {
  const out = computeTassV1({
    ticker: "DDD",
    symbolBars: makeBars(260, 100, 0.4, 1_200_000),
    spyBars: makeBars(260, 100, 0.2, 900_000),
    sectorBars: null,
    marketRegime: "RISK_ON",
    sectorScore: null,
  });

  assert.equal(out.dataStatus, "OK");
  assert.ok(out.explanation.missingData.includes("Sector ETF mapping unavailable."));
});

test("8) Strong stock + valid pullback yields at least WATCH/VALID", () => {
  const bars = makeBars(260, 100, 0.7, 2_000_000);
  const spy = makeBars(260, 100, 0.2, 1_000_000);
  const out = computeTassV1({
    ticker: "EEE",
    symbolBars: bars,
    spyBars: spy,
    sectorBars: makeBars(260, 90, 0.1, 800_000),
    marketRegime: "RISK_ON",
    sectorScore: 65,
  });

  assert.ok(out.tassScore !== null && out.tassScore >= 50);
  assert.ok(out.entryWindow === "WATCH" || out.entryWindow === "VALID_ENTRY" || out.entryWindow === "STRONG_ENTRY");
});

test("9) Strong stock but low trigger volume adds low-volume trigger", () => {
  const bars = makeBars(260, 100, 0.6, 2_000_000);
  bars[bars.length - 1] = { ...bars[bars.length - 1]!, volume: 1000, open: bars[bars.length - 1]!.close - 0.2 };
  const spy = makeBars(260, 100, 0.2, 1_000_000);

  const out = computeTassV1({
    ticker: "FFF",
    symbolBars: bars,
    spyBars: spy,
    sectorBars: makeBars(260, 90, 0.1, 800_000),
    marketRegime: "RISK_ON",
    sectorScore: 70,
  });

  assert.ok(out.hardInvalidations.includes("low-volume trigger"));
  assert.equal(out.entryWindow, "NO_ENTRY");
});

test("10) Clear breakdown returns exit signal", () => {
  const bars = withBreakdown(makeBars(260, 100, 0.3, 1_800_000));
  const out = computeTassV1({
    ticker: "GGG",
    symbolBars: bars,
    spyBars: makeBars(260, 100, 0.2, 1_000_000),
    sectorBars: makeBars(260, 90, 0.1, 800_000),
    marketRegime: "RISK_OFF",
    sectorScore: 40,
  });

  assert.equal(out.exitWindow, "EXIT_SIGNAL");
});
