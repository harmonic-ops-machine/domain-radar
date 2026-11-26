import type { PatternMetrics } from "@/lib/patterns/tracker";
import type { PatternArchetype, TldCode } from "@/lib/types";

export interface FeatureInput {
  sld: string;
  tld: TldCode;
  tokens: string[];
  archetype: PatternArchetype;
  hasHyphen: boolean;
  hasDigit: boolean;
  fiveYrTcoUsd: number;
  comCounterpartRegistered: boolean;
  matchedPatterns: PatternMetrics[];
}

export interface DomainFeatureVector {
  tldBaseValueUsd: number;
  lengthScore: number;
  pronounceabilityScore: number;
  cleanCharPenalty: number;
  wordQualityScore: number;
  maxShrunkAbsorption30d: number;
  weightedScarcity: number;
  crossTldSpillover: number;
  compPriceSlope: number;
  trendZScore: number;
  renewalDragPct: number;
  effectiveSampleSize: number;
}

const TLD_BASE_VALUE: Record<TldCode, number> = {
  ".com": 420,
  ".ai": 950,
  ".io": 520,
  ".org": 210,
  ".co": 240,
  ".app": 190,
  ".dev": 180,
  ".net": 150,
};

function computePronounceability(sld: string): number {
  const letters = sld.replace(/[^a-z]/g, "");
  if (letters.length === 0) return 0;
  const vowels = (letters.match(/[aeiouy]/g) ?? []).length;
  const ratio = vowels / letters.length;
  if (ratio >= 0.25 && ratio <= 0.55) return 1.0;
  if (ratio >= 0.15 && ratio <= 0.7) return 0.6;
  return 0.2;
}

function computeLengthScore(len: number): number {
  if (len <= 6) return 1.0;
  if (len <= 10) return 0.85;
  if (len <= 15) return 0.65;
  return Math.max(0.15, 0.65 - (len - 15) * 0.05);
}

export function buildFeatureVector(input: FeatureInput): DomainFeatureVector {
  const tldBaseValueUsd = TLD_BASE_VALUE[input.tld] ?? 150;
  const lengthScore = computeLengthScore(input.sld.length);
  const pronounceabilityScore = computePronounceability(input.sld);

  let cleanCharPenalty = 0;
  if (input.hasHyphen) cleanCharPenalty += 0.35;
  if (input.hasDigit) cleanCharPenalty += 0.25;

  const wordQualityScore =
    input.archetype === "SINGLE_WORD" || input.archetype === "SHORT_BRAND_LE6"
      ? 1.0
      : input.archetype === "COMPOUND_2WORD"
      ? 0.85
      : input.archetype === "COMPOUND_3PLUS"
      ? 0.55
      : 0.3;

  const patterns = input.matchedPatterns;
  let maxShrunkAbsorption30d = 0;
  let weightedScarcity = 0;
  let compPriceSlope = 0;
  let trendZScore = 0;
  let totalWeight = 0;
  let effectiveSampleSize = 0;

  for (const p of patterns) {
    const w = Math.max(1, Math.log10(p.totalDomains + 1));
    maxShrunkAbsorption30d = Math.max(
      maxShrunkAbsorption30d,
      p.shrunkAbsorption30d
    );
    weightedScarcity += p.scarcityRatio * w;
    compPriceSlope += p.compPriceSlope * w;
    trendZScore += p.trendZScore * w;
    totalWeight += w;
    effectiveSampleSize = Math.max(effectiveSampleSize, p.totalDomains);
  }

  if (totalWeight > 0) {
    weightedScarcity /= totalWeight;
    compPriceSlope /= totalWeight;
    trendZScore /= totalWeight;
  }

  const crossTldSpillover =
    input.tld !== ".com" && input.comCounterpartRegistered ? 1.0 : 0.0;

  const estimatedBase =
    tldBaseValueUsd *
    (0.5 + 0.5 * lengthScore) *
    (0.6 + 0.4 * wordQualityScore) *
    (1 - cleanCharPenalty * 0.6);

  const renewalDragPct = Math.min(
    45,
    (input.fiveYrTcoUsd / Math.max(100, estimatedBase)) * 18
  );

  return {
    tldBaseValueUsd,
    lengthScore,
    pronounceabilityScore,
    cleanCharPenalty,
    wordQualityScore,
    maxShrunkAbsorption30d,
    weightedScarcity,
    crossTldSpillover,
    compPriceSlope,
    trendZScore,
    renewalDragPct,
    effectiveSampleSize,
  };
}
