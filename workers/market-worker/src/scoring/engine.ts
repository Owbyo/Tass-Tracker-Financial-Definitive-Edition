import type { TassAnalysisOutput } from "@tass/domain";
import { computeTassV1, type AnalysisInput } from "./tass-v1-engine";

export interface ScoringEngine {
  compute(input: AnalysisInput): Promise<TassAnalysisOutput>;
}

export class TassV1ScoringEngine implements ScoringEngine {
  async compute(input: AnalysisInput): Promise<TassAnalysisOutput> {
    return computeTassV1(input);
  }
}
