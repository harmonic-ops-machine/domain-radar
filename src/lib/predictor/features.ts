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
  status?: string;
  matchedPatterns: PatternMetrics[];
}

export interface DomainFeatureVector {
  tldBaseValueUsd: number;
  lengthScore: number;
  powerLawMultiplier: number;
  keywordPremiumMultiplier: number;
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
  ".com": 480,
  ".ai": 980,
  ".io": 520,
  ".org": 240,
  ".co": 260,
  ".app": 210,
  ".dev": 200,
  ".net": 180,
};

const TIER1_COMMERCIAL_TOKENS = new Set([
  "ai", "pay", "bank", "cloud", "open", "meta", "trust", "coin", "fund",
  "bond", "agent", "truth", "real", "vault", "cyber", "quantum", "alpha",
  "core", "prime", "labs", "hq", "os", "neural", "vector", "chain", "mint",
  "trade", "cash", "credit", "health", "bio", "auto", "home", "insure",
]);

const TIER2_BRAND_TOKENS = new Set([
  "proof", "ledger", "signal", "audit", "notary", "canon", "pulse", "spark",
  "nexus", "prism", "forge", "beacon", "cipher", "anchor", "atlas", "shield",
  "guard", "watch", "trace", "index", "stack", "layer", "mesh", "node",
  "clear", "plain", "direct", "exact", "smart", "swift", "rapid", "deep",
  "high", "free", "omni", "hyper", "nova", "orbit", "solar", "terra",
]);

function computePronounceability(sld: string): number {
  const letters = sld.replace(/[^a-z]/g, "");
  if (letters.length === 0) return 0;
  const vowels = (letters.match(/[aeiouy]/g) ?? []).length;
  const ratio = vowels / letters.length;
  // Natural English short compounds like openai/metaai/aeroai reach ~0.67 vowels
  if (ratio >= 0.2 && ratio <= 0.68) return 1.0;
  if (ratio >= 0.12 && ratio <= 0.78) return 0.7;
  return 0.3;
}

function computeLengthScore(len: number): number {
  if (len <= 4) return 1.0;
  if (len <= 6) return 0.96;
  if (len <= 10) return 0.85;
  if (len <= 15) return 0.65;
  return Math.max(0.15, 0.65 - (len - 15) * 0.05);
}

function computePowerLawMultiplier(len: number, tld: TldCode, hasHyphen: boolean, hasDigit: boolean): number {
  if (hasHyphen || hasDigit) return 0.85;
  const isKing = tld === ".com";
  const isHotTech = tld === ".ai" || tld === ".io";
  if (len <= 4) return isKing ? 24 : isHotTech ? 8 : 3.5;
  if (len === 5) return isKing ? 10 : isHotTech ? 4.2 : 2.2;
  if (len === 6) return isKing ? 5.2 : isHotTech ? 2.6 : 1.6;
  if (len === 7) return isKing ? 2.6 : isHotTech ? 1.7 : 1.25;
  if (len === 8) return isKing ? 1.65 : isHotTech ? 1.3 : 1.1;
  return 1.0;
}

function computeKeywordPremiumMultiplier(tokens: string[], status?: string): number {
  let t1 = 0;
  let t2 = 0;
  for (const raw of tokens) {
    const tok = raw.toLowerCase();
    if (TIER1_COMMERCIAL_TOKENS.has(tok)) t1 += 1;
    else if (TIER2_BRAND_TOKENS.has(tok)) t2 += 1;
  }
  let mult = 1.0;
  if (t1 >= 2) mult = 4.5;
  else if (t1 === 1 && t2 >= 1) mult = 2.4;
  else if (t1 === 1) mult = 1.75;
  else if (t2 >= 2) mult = 1.45;
  else if (t2 === 1) mult = 1.15;

  // Already-registered short Tier-1 domains trade at established aftermarket multiples
  if (status === "registered" && t1 >= 2) {
    mult *= 6.5;
  } else if (status === "registered" && t1 >= 1) {
    mult *= 2.4;
  } else if (status === "registered") {
    mult *= 1.35;
  }
  return mult;
}

export function buildFeatureVector(input: FeatureInput): DomainFeatureVector {
  const tldBaseValueUsd = TLD_BASE_VALUE[input.tld] ?? 180;
  const lengthScore = computeLengthScore(input.sld.length);
  const powerLawMultiplier = computePowerLawMultiplier(
    input.sld.length,
    input.tld,
    input.hasHyphen,
    input.hasDigit
  );
  const keywordPremiumMultiplier = computeKeywordPremiumMultiplier(
    input.tokens,
    input.status
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
    powerLawMultiplier,
    keywordPremiumMultiplier,
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
