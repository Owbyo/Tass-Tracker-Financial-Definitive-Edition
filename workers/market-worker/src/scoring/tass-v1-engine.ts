import type { EntryWindow, ExitWindow, TassAnalysisOutput, TassCategory } from "@tass/domain";

export const FORMULA_VERSION = "tass-v1.0.0" as const;

export type DailyBar = {
  sessionDate: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AnalysisInput = {
  ticker: string;
  sector?: string | null;
  industry?: string | null;
  symbolBars: DailyBar[];
  spyBars: DailyBar[] | null;
  sectorBars: DailyBar[] | null;
  marketRegime: "RISK_ON" | "NEUTRAL" | "RISK_OFF" | null;
  sectorScore: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (const value of values) {
    const next = value * k + prev * (1 - k);
    out.push(next);
    prev = next;
  }
  return out;
}

function sma(values: number[], period: number): number[] {
  return values.map((_, idx) => {
    if (idx + 1 < period) return NaN;
    const window = values.slice(idx - period + 1, idx + 1);
    return window.reduce((a, b) => a + b, 0) / period;
  });
}

function atr14(bars: DailyBar[]): number[] {
  const trs = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prevClose = bars[i - 1]!.close;
    return Math.max(b.high - b.low, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
  });
  return sma(trs, 14);
}

function avgVolume20(bars: DailyBar[]): number[] {
  return sma(bars.map((b) => b.volume), 20);
}

function highest(values: number[]): number {
  return values.reduce((m, x) => (x > m ? x : m), Number.NEGATIVE_INFINITY);
}

function lowest(values: number[]): number {
  return values.reduce((m, x) => (x < m ? x : m), Number.POSITIVE_INFINITY);
}

function calcReturn(closeNow: number, closePrev: number): number {
  return ((closeNow - closePrev) / closePrev) * 100;
}

function mapTassCategory(score: number): TassCategory {
  if (score <= 34) return "WEAK";
  if (score <= 49) return "FAIR";
  if (score <= 64) return "GOOD";
  if (score <= 79) return "STRONG";
  return "ELITE";
}

function mapEntryWindow(score: number, hardInvalidations: string[], tassScore: number): EntryWindow {
  if (hardInvalidations.length > 0) return "NO_ENTRY";

  let window: EntryWindow = score <= 44 ? "NO_ENTRY" : score <= 64 ? "WATCH" : score <= 79 ? "VALID_ENTRY" : "STRONG_ENTRY";

  if (tassScore < 50) {
    if (window === "VALID_ENTRY" || window === "STRONG_ENTRY") window = "WATCH";
  } else if (tassScore <= 64) {
    if (window === "STRONG_ENTRY") window = "VALID_ENTRY";
  }

  return window;
}

function mapExitWindow(score: number, hardExitCandidates: string[]): ExitWindow {
  if (hardExitCandidates.length >= 2) return "EXIT_SIGNAL";
  if (score <= 29) return "HOLD";
  if (score <= 54) return "PROFIT_WATCH";
  if (score <= 74) return "RISK_ZONE";
  return "EXIT_SIGNAL";
}

function insufficient(reason: string): TassAnalysisOutput {
  return {
    formulaVersion: FORMULA_VERSION,
    dataStatus: "INSUFFICIENT_DATA",
    tassScore: null,
    tassCategory: null,
    entryScore: null,
    entryWindow: null,
    exitScore: null,
    exitWindow: null,
    hardInvalidations: [],
    hardExitCandidates: [],
    factorScores: {
      trendStructure: null,
      emaAlignment: null,
      relativeStrength: null,
      priorMomentumExpansion: null,
      volumeDemandQuality: null,
      setupQuality: null,
      volumeConfirmation: null,
      riskQuality: null,
      marketSectorAlignment: null,
      structureDamage: null,
      emaLoss: null,
      relativeWeakness: null,
      failureOrExtensionRisk: null,
    },
    explanation: {
      summary: ["Analysis skipped due to insufficient required data."],
      positives: [],
      negatives: [],
      missingData: [reason],
    },
  };
}

export function computeTassV1(input: AnalysisInput): TassAnalysisOutput {
  const negatives: string[] = [];
  const positives: string[] = [];
  const missingData: string[] = [];
  const hardInvalidations: string[] = [];
  const hardExitCandidates: string[] = [];

  if (input.symbolBars.length < 250) {
    return insufficient("Insufficient daily history for 60-session calculations.");
  }

  if (!input.spyBars || input.spyBars.length < 250) {
    return insufficient("Insufficient benchmark history: SPY daily data unavailable.");
  }

  const bars = input.symbolBars;
  const spy = input.spyBars;
  const c = bars.map((b) => b.close);
  const h = bars.map((b) => b.high);
  const l = bars.map((b) => b.low);
  const o = bars.map((b) => b.open);
  const v = bars.map((b) => b.volume);

  const ema10 = ema(c, 10);
  const ema20 = ema(c, 20);
  const ema50 = ema(c, 50);
  const sma200 = sma(c, 200);
  const atr = atr14(bars);
  const av20 = avgVolume20(bars);

  const idx = bars.length - 1;
  const closeNow = c[idx]!;
  const openNow = o[idx]!;
  const closePrev = c[idx - 1]!;

  const recentHigh20 = highest(h.slice(idx - 19, idx + 1));
  const recentLow20 = lowest(l.slice(idx - 19, idx + 1));
  const priorHigh20 = highest(h.slice(idx - 39, idx - 19));
  const priorLow20 = lowest(l.slice(idx - 39, idx - 19));
  const highestHigh60 = highest(h.slice(idx - 59, idx + 1));
  const lowestLow60 = lowest(l.slice(idx - 59, idx + 1));
  void highestHigh60;
  void lowestLow60;

  const ret20 = calcReturn(closeNow, c[idx - 20]!);
  const ret60 = calcReturn(closeNow, c[idx - 60]!);
  const spyClose = spy.map((b) => b.close);
  const spyRet20 = calcReturn(spyClose[spyClose.length - 1]!, spyClose[spyClose.length - 21]!);
  const spyRet60 = calcReturn(spyClose[spyClose.length - 1]!, spyClose[spyClose.length - 61]!);
  const rsSpy20 = ret20 - spyRet20;
  const rsSpy60 = ret60 - spyRet60;

  let rsSector20: number | null = null;
  let rsSector60: number | null = null;
  if (input.sectorBars && input.sectorBars.length >= 250) {
    const sectorClose = input.sectorBars.map((b) => b.close);
    const sectorRet20 = calcReturn(sectorClose[sectorClose.length - 1]!, sectorClose[sectorClose.length - 21]!);
    const sectorRet60 = calcReturn(sectorClose[sectorClose.length - 1]!, sectorClose[sectorClose.length - 61]!);
    rsSector20 = ret20 - sectorRet20;
    rsSector60 = ret60 - sectorRet60;
  } else {
    missingData.push("Sector ETF mapping unavailable.");
  }

  // 5.1 Trend Structure
  let trendStructure = 0;
  const trendConds = [
    recentHigh20 > priorHigh20,
    recentLow20 > priorLow20,
    closeNow > c[idx - 20]!,
    closeNow > ema20[idx]!,
  ];
  const trendTrue = trendConds.filter(Boolean).length;
  trendStructure = trendTrue === 4 ? 25 : trendTrue === 3 ? 12 : 0;
  if (recentLow20 < priorLow20) {
    negatives.push("Recent lower low weakens structure.");
    hardExitCandidates.push("major structure break");
    hardInvalidations.push("lower-low recent structure");
  } else {
    positives.push("Trend structure remains intact on daily timeframe.");
  }

  // 5.2 EMA Alignment
  let emaAlignment = 0;
  if (closeNow > ema20[idx]! && ema20[idx]! > ema50[idx]!) {
    const longConds = [ema50[idx]! > sma200[idx]!, ema20[idx]! > ema20[idx - 1]!, ema50[idx]! >= ema50[idx - 1]!];
    const longTrue = longConds.filter(Boolean).length;
    emaAlignment = longTrue === 3 ? 20 : longTrue === 2 ? 10 : 0;
  }
  if (emaAlignment > 0) positives.push("Price and moving averages remain aligned bullish.");

  // 5.3 Relative Strength
  let relativeStrength = 0;
  if (rsSpy20 > 0 && rsSpy60 > 0) {
    if (rsSector20 === null || rsSector60 === null) {
      relativeStrength = 10;
    } else if (rsSector20 > 0 && rsSector60 > 0) {
      relativeStrength = 20;
    } else {
      relativeStrength = 10;
    }
  } else {
    relativeStrength = 0;
    negatives.push("Relative strength vs benchmark deteriorated.");
  }
  if (rsSpy20 > 0 && rsSpy60 > 0) positives.push("Relative strength vs SPY remains positive.");

  // 5.4 Prior Momentum Expansion
  let priorMomentumExpansion = 0;
  let foundExpansion = false;
  for (let i = idx - 59; i <= idx; i += 1) {
    const tr = Math.max(h[i]! - l[i]!, Math.abs(h[i]! - c[i - 1]!), Math.abs(l[i]! - c[i - 1]!));
    const atrAt = atr[i]!;
    const avgVolAt = av20[i]!;
    const dailyRet = calcReturn(c[i]!, c[i - 1]!);
    if (Number.isFinite(atrAt) && Number.isFinite(avgVolAt) && tr > 2 * atrAt && v[i]! > 1.5 * avgVolAt && dailyRet > 0) {
      foundExpansion = true;
      break;
    }
  }
  if (foundExpansion) {
    const expansionPrev = calcReturn(c[idx - 20]!, c[idx - 40]!);
    priorMomentumExpansion = expansionPrev >= 15 ? 15 : 7;
  }

  // 5.5 Volume Demand Quality
  const last5 = bars.slice(idx - 4, idx + 1);
  const upVolumes = last5.filter((b) => b.close > b.open).map((b) => b.volume);
  const upAvg = upVolumes.length > 0 ? upVolumes.reduce((a, b) => a + b, 0) / upVolumes.length : 0;
  const volRatio = av20[idx]! > 0 ? upAvg / av20[idx]! : 0;
  const volumeDemandQuality = volRatio >= 1.3 ? 10 : volRatio >= 1.1 ? 5 : 0;

  // 5.6 Stability
  const atrRatio = atr[idx]! / atr[idx - 20]!;
  const stability = atrRatio <= 0.7 ? 10 : atrRatio <= 0.85 ? 5 : 0;

  const tassScore = round2(trendStructure + emaAlignment + relativeStrength + priorMomentumExpansion + volumeDemandQuality + stability);
  const tassCategory = mapTassCategory(tassScore);

  // Entry 7.1 setup quality
  const pullbackDepth = ((recentHigh20 - closeNow) / recentHigh20) * 100;
  const nearEma = Math.abs(l[idx]! - ema10[idx]!) / ema10[idx]! <= 0.02 || Math.abs(l[idx]! - ema20[idx]!) / ema20[idx]! <= 0.02;
  const pullbackConds = [recentHigh20 > 0, pullbackDepth >= 5 && pullbackDepth <= 18, nearEma, closeNow > openNow, closeNow > closePrev];
  const pullTrue = pullbackConds.filter(Boolean).length;

  const range10 = highest(h.slice(idx - 9, idx + 1)) - lowest(l.slice(idx - 9, idx + 1));
  const rangePrev20 = highest(h.slice(idx - 29, idx - 9)) - lowest(l.slice(idx - 29, idx - 9));
  const contractionConds = [
    atr[idx]! <= 0.7 * atr[idx - 20]!,
    range10 <= 0.85 * rangePrev20,
    ((recentHigh20 - closeNow) / recentHigh20) * 100 <= 5,
    recentLow20 >= priorLow20,
  ];
  const contractionTrue = contractionConds.filter(Boolean).length;

  let setupQuality = 0;
  let setupType: "pullback" | "contraction" | null = null;
  if (pullTrue === 5) {
    setupQuality = 35;
    setupType = "pullback";
  } else if (pullTrue >= 3) {
    setupQuality = 18;
    setupType = "pullback";
  } else if (contractionTrue === 4) {
    setupQuality = 35;
    setupType = "contraction";
    positives.push("Recent setup shows volatility contraction.");
  } else if (contractionTrue === 3) {
    setupQuality = 18;
    setupType = "contraction";
  }

  if (pullbackDepth > 25) hardInvalidations.push("deep pullback breakdown risk");
  if (closeNow < ema20[idx]! && closePrev < ema20[idx - 1]!) hardInvalidations.push("below key EMA during setup");

  // 7.2 Volume confirmation
  const todayTr = Math.max(h[idx]! - l[idx]!, Math.abs(h[idx]! - c[idx - 1]!), Math.abs(l[idx]! - c[idx - 1]!));
  const volMultiple = av20[idx]! > 0 ? v[idx]! / av20[idx]! : 0;
  let volumeConfirmation = 0;
  if (volMultiple >= 1.8 && closeNow > openNow && todayTr >= 1.5 * atr[idx]!) {
    volumeConfirmation = 25;
    positives.push("Entry trigger is confirmed by above-average volume.");
  } else if (volMultiple >= 1.3 && volMultiple < 1.8 && closeNow > openNow) {
    volumeConfirmation = 12;
  }
  if (volMultiple < 1.0) {
    hardInvalidations.push("low-volume trigger");
    negatives.push("Trigger volume is insufficient.");
  }

  // 7.3 Risk quality
  const pullbackLow = lowest(l.slice(idx - 9, idx + 1));
  const baseLow = lowest(l.slice(idx - 9, idx + 1));
  const invalidationPrice = Math.min(setupType === "pullback" ? pullbackLow : baseLow, ema20[idx]! * 0.99);
  const riskDistancePct = ((closeNow - invalidationPrice) / closeNow) * 100;
  let riskQuality = 0;
  if (riskDistancePct >= 2 && riskDistancePct <= 6) riskQuality = 20;
  else if (riskDistancePct > 6 && riskDistancePct <= 8) riskQuality = 10;

  if (riskDistancePct > 8) {
    hardInvalidations.push("risk too wide");
    negatives.push("Risk distance is too wide for a clean entry.");
  }
  if (invalidationPrice >= closeNow) hardInvalidations.push("invalid stop geometry");

  // 7.4 Market+Sector
  let marketSectorAlignment: number | null = null;
  if (input.marketRegime) {
    const sectorScore = input.sectorScore;
    if (input.marketRegime === "RISK_ON" && sectorScore !== null && sectorScore >= 60) {
      marketSectorAlignment = 20;
    } else if (input.marketRegime === "NEUTRAL" || (sectorScore !== null && sectorScore >= 50 && sectorScore <= 59)) {
      marketSectorAlignment = 10;
    } else if (input.marketRegime === "RISK_OFF" || (sectorScore !== null && sectorScore < 50)) {
      marketSectorAlignment = 0;
    } else {
      marketSectorAlignment = input.marketRegime === "RISK_ON" ? 20 : input.marketRegime === "NEUTRAL" ? 10 : 0;
    }

    if (input.marketRegime === "RISK_OFF" && sectorScore !== null && sectorScore < 50) {
      hardInvalidations.push("market regime RISK_OFF + sector score < 50");
    }

    if (input.sectorScore === null) {
      missingData.push("Sector ETF mapping unavailable.");
    }
  } else {
    missingData.push("Market regime snapshot unavailable.");
    marketSectorAlignment = null;
  }

  if (tassScore < 35) hardInvalidations.push("tassScore < 35");

  const entryScoreRaw = setupQuality + volumeConfirmation + riskQuality + (marketSectorAlignment ?? 0);
  const entryScore = round2(Math.max(0, Math.min(100, entryScoreRaw)));
  const entryWindow = mapEntryWindow(entryScore, [...new Set(hardInvalidations)], tassScore);

  // Exit
  const structureDamage = recentLow20 < priorLow20 && closeNow < ema20[idx]! ? 35 : recentLow20 < priorLow20 || closeNow < ema20[idx]! ? 18 : 0;
  if (recentLow20 < priorLow20 && closeNow < ema50[idx]!) {
    hardExitCandidates.push("major structure break");
  }

  const closeBelowEma20Now = closeNow < ema20[idx]!;
  const closeBelowEma20Prev = c[idx - 1]! < ema20[idx - 1]!;
  let emaLoss = 0;
  if (closeBelowEma20Now && closeBelowEma20Prev) emaLoss = 25;
  else if (closeBelowEma20Now && closeNow > ema50[idx]!) emaLoss = 12;

  if (closeNow < ema50[idx]! && c[idx - 1]! < ema50[idx - 1]!) {
    hardExitCandidates.push("lost medium trend support");
    negatives.push("Price lost EMA20 support.");
  }

  let relativeWeakness = 0;
  const broadWeak = rsSpy20 < 0 && rsSpy60 < 0;
  if (broadWeak) {
    if (rsSector20 !== null || rsSector60 !== null) {
      if ((rsSector20 ?? 0) < 0 || (rsSector60 ?? 0) < 0) {
        relativeWeakness = 20;
      } else {
        relativeWeakness = 10;
      }
    } else {
      relativeWeakness = 10;
    }
  } else if (rsSpy20 < 0) {
    relativeWeakness = 10;
  }

  if (broadWeak && (rsSector20 ?? 1) < 0 && closeNow < ema20[idx]!) {
    hardExitCandidates.push("relative weakness broad + sector weakness + close < EMA20");
  }

  const breakoutPivot = priorHigh20;
  let failureOrExtensionRisk = 0;
  const failedBreakout = breakoutPivot > 0 && closeNow < breakoutPivot;
  const extensionAtr = (closeNow - ema20[idx]!) / atr[idx]!;
  const redRange = closeNow < openNow && (h[idx]! - l[idx]!) > atr[idx]!;

  if (failedBreakout) {
    failureOrExtensionRisk = 20;
    hardExitCandidates.push("failed breakout return below pivot");
  } else if (extensionAtr > 2.5 && redRange) {
    failureOrExtensionRisk = 20;
  } else if (extensionAtr > 2.0) {
    failureOrExtensionRisk = 10;
  } else if (!breakoutPivot) {
    missingData.push("No valid breakout pivot identified for failure check.");
  }

  const exitScore = round2(structureDamage + emaLoss + relativeWeakness + failureOrExtensionRisk);
  const exitWindow = mapExitWindow(exitScore, [...new Set(hardExitCandidates)]);

  return {
    formulaVersion: FORMULA_VERSION,
    dataStatus: "OK",
    tassScore,
    tassCategory,
    entryScore,
    entryWindow,
    exitScore,
    exitWindow,
    hardInvalidations: [...new Set(hardInvalidations)],
    hardExitCandidates: [...new Set(hardExitCandidates)],
    factorScores: {
      trendStructure,
      emaAlignment,
      relativeStrength,
      priorMomentumExpansion,
      volumeDemandQuality,
      setupQuality,
      volumeConfirmation,
      riskQuality,
      marketSectorAlignment,
      structureDamage,
      emaLoss,
      relativeWeakness,
      failureOrExtensionRisk,
    },
    explanation: {
      summary: [
        "Tass v1 analysis completed on daily timeframe.",
        `Entry window resolved as ${entryWindow}.`,
        `Exit window resolved as ${exitWindow}.`,
      ],
      positives,
      negatives,
      missingData,
    },
  };
}

export const mappingFns = {
  mapTassCategory,
  mapEntryWindow,
  mapExitWindow,
};
