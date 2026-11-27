import type { PatternMetrics } from "@/lib/patterns/tracker";
import type { DomainStatus, PatternArchetype, TldCode } from "@/lib/types";

export interface FeatureInput {
  sld: string;
  tld: TldCode;
  tokens: string[];
  archetype: PatternArchetype;
  hasHyphen: boolean;
  hasDigit: boolean;
  fiveYrTcoUsd: number;
  comCounterpartRegistered: boolean;
  status?: DomainStatus | string;
  matchedPatterns: PatternMetrics[];
}

export interface DomainFeatureVector {
  tldBaseValueUsd: number;
  lengthScore: number;
  lengthPowerMultiplier: number;
  commercialKeywordMultiplier: number;
  brandAuthorityMultiplier: number;
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
  ".com": 650,
  ".ai": 1250,
  ".io": 620,
  ".org": 260,
  ".co": 290,
  ".app": 240,
  ".dev": 220,
  ".net": 180,
};

const TIER1_KEYWORDS = new Set([
  "ai", "open", "meta", "pay", "bank", "cloud", "agent", "data", "code",
  "trust", "fund", "coin", "truth", "real", "neural", "quantum", "cyber",
  "os", "hq", "pro", "one", "go", "app", "web", "net", "law", "fin", "bio",
]);

const TIER2_KEYWORDS = new Set([
  "ledger", "proof", "audit", "vault", "signal", "notary", "canon", "vector",
  "pulse", "nexus", "forge", "shield", "guard", "trace", "chain", "index",
  "stack", "layer", "mesh", "node", "core", "prime", "alpha", "delta",
  "atlas", "bridge", "scale", "scope", "metric", "mint", "bond", "hedge",
  "free", "pure", "omni", "hyper", "smart", "swift", "direct", "clear",
]);

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

function computeLengthPowerMultiplier(len: number, tld: TldCode): number {
  const isCom = tld === ".com";
  if (len <= 4) return isCom ? 45 : 12;
  if (len <= 6) return isCom ? 18 : 6;
  if (len <= 8) return isCom ? 5.5 : 2.8;
  if (len <= 10) return isCom ? 2.4 : 1.6;
  if (len <= 13) return 1.3;
  return 1.0;
}

function computeCommercialKeywordMultiplier(tokens: string[]): number {
  let mult = 1.0;
  let tier1Hits = 0;
  let tier2Hits = 0;
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    if (TIER1_KEYWORDS.has(t)) tier1Hits += 1;
    else if (TIER2_KEYWORDS.has(t)) tier2Hits += 1;
  }
  if (tier1Hits >= 2) mult *= 6.5;
  else if (tier1Hits === 1) mult *= 2.4;

  if (tier2Hits >= 2) mult *= 1.9;
  else if (tier2Hits === 1) mult *= 1.35;

  return mult;
}

export function buildFeatureVector(input: FeatureInput): DomainFeatureVector {
  const tldBaseValueUsd = TLD_BASE_VALUE[input.tld] ?? 180;
  const lengthScore = computeLengthScore(input.sld.length);
  const lengthPowerMultiplier = computeLengthPowerMultiplier(
    input.sld.length,
    input.tld
  );
  const commercialKeywordMultiplier = computeCommercialKeywordMultiplier(
    input.tokens
  );
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

  // Registered ultra-short clean .com/.ai brands command established aftermarket multiples
  const brandAuthorityMultiplier =
    input.status === "registered" &&
    !input.hasHyphen &&
    !input.hasDigit &&
    input.sld.length <= 8
      ? input.tld === ".com"
        ? 2.2
        : 1.5
      : 1.0;

  const patterns = input.matchedPatterns;
  let maxShrunkAbsorption30d = 0;
  let weightedScarcity = 0;
  let compPriceSlope = 0;
  let trendZScore = 0;
  let totalWeight = 0;
  let maxSpecificSampleSize = 0;
  let maxAnySampleSize = 0;

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
    maxAnySampleSize = Math.max(maxAnySampleSize, p.totalDomains);
    if (!p.patternKey.startsWith("tld:")) {
      maxSpecificSampleSize = Math.max(maxSpecificSampleSize, p.totalDomains);
    }
  }

  const effectiveSampleSize =
    maxSpecificSampleSize > 0 ? maxSpecificSampleSize : maxAnySampleSize;

  if (totalWeight > 0) {
    weightedScarcity /= totalWeight;
    compPriceSlope /= totalWeight;
    trendZScore /= totalWeight;
  }

  const crossTldSpillover =
    input.tld !== ".com" && input.comCounterpartRegistered ? 1.0 : 0.0;

  const estimatedBase =
    tldBaseValueUsd *
    lengthPowerMultiplier *
    commercialKeywordMultiplier *
    brandAuthorityMultiplier *
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
    lengthPowerMultiplier,
    commercialKeywordMultiplier,
    brandAuthorityMultiplier,
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
