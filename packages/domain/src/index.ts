export type TassCategory = "WEAK" | "FAIR" | "GOOD" | "STRONG" | "ELITE";
export type EntryWindow = "NO_ENTRY" | "WATCH" | "VALID_ENTRY" | "STRONG_ENTRY";
export type ExitWindow = "HOLD" | "PROFIT_WATCH" | "RISK_ZONE" | "EXIT_SIGNAL";
export type DataStatus = "OK" | "INSUFFICIENT_DATA";

export type FactorScores = {
  trendStructure: number | null;
  emaAlignment: number | null;
  relativeStrength: number | null;
  priorMomentumExpansion: number | null;
  volumeDemandQuality: number | null;
  setupQuality: number | null;
  volumeConfirmation: number | null;
  riskQuality: number | null;
  marketSectorAlignment: number | null;
  structureDamage: number | null;
  emaLoss: number | null;
  relativeWeakness: number | null;
  failureOrExtensionRisk: number | null;
};

export type AnalysisExplanation = {
  summary: string[];
  positives: string[];
  negatives: string[];
  missingData: string[];
};

export type TassAnalysisOutput = {
  formulaVersion: "tass-v1.0.0";
  dataStatus: DataStatus;
  tassScore: number | null;
  tassCategory: TassCategory | null;
  entryScore: number | null;
  entryWindow: EntryWindow | null;
  exitScore: number | null;
  exitWindow: ExitWindow | null;
  hardInvalidations: string[];
  hardExitCandidates: string[];
  factorScores: FactorScores;
  explanation: AnalysisExplanation;
};
