export type LexicalCluster = "REALITY" | "JUSTICE" | "COMPOSABILITY" | "CORE";

export type RivalryRegimeSlug =
  | "expected_blended"
  | "protocol_war"
  | "open_weight_shock"
  | "world_model_pivot"
  | "regulatory_audit";

export interface RivalryRegime {
  slug: RivalryRegimeSlug;
  label: string;
  shortLabel: string;
  summary: string;
  realityMult: number;
  justiceMult: number;
  composabilityMult: number;
  activeProbability: number;
}

export interface TldRateBenchmark {
  tld: string;
  registrar: string;
  regYear1Usd: number;
  renewAnnualUsd: number;
  minTermYears: number;
  restoreFeeUsd: number;
  verifiedAt: string;
}

export interface InferenceRateBenchmark {
  model: string;
  provider: string;
  inputPer1mUsd: number;
  outputPer1mUsd: number;
  sweBenchPct: number;
  role: string;
}

export const DEFAULT_RIVALRY_REGIMES: RivalryRegime[] = [
  {
    slug: "expected_blended",
    label: "Probability-Weighted Expected Regime",
    shortLabel: "Blended EV",
    summary: "40% Protocol War + 25% Open-Weight Shock + 20% World-Model + 15% Audit",
    realityMult: 1.6,
    justiceMult: 1.56,
    composabilityMult: 1.79,
    activeProbability: 1.0,
  },
  {
    slug: "protocol_war",
    label: "Anthropic vs OpenAI Agentic Protocol War",
    shortLabel: "Protocol War",
    summary: "MCP, ReBAC, non-human identities & enterprise steerability surge",
    realityMult: 1.35,
    justiceMult: 1.55,
    composabilityMult: 1.85,
    activeProbability: 0.4,
  },
  {
    slug: "open_weight_shock",
    label: "DeepSeek V4 / GLM Cost-Deflation Surge",
    shortLabel: "Open-Weight Shock",
    summary: "75-90% API cost deflation kills wrappers; routing fabrics & .dev/.app win",
    realityMult: 1.25,
    justiceMult: 1.3,
    composabilityMult: 2.2,
    activeProbability: 0.25,
  },
  {
    slug: "world_model_pivot",
    label: "Google / xAI Embodied & Spatial Pivot",
    shortLabel: "World Models",
    summary: "Compute moat + zero-shot physics/spatial ground-truth reprices REALITY",
    realityMult: 2.3,
    justiceMult: 1.25,
    composabilityMult: 1.45,
    activeProbability: 0.2,
  },
  {
    slug: "regulatory_audit",
    label: "Global Provenance & Liability Clampdown",
    shortLabel: "Audit Clampdown",
    summary: "Cryptographic provenance, adjudication & algorithmic liability dominate",
    realityMult: 1.9,
    justiceMult: 2.45,
    composabilityMult: 1.4,
    activeProbability: 0.15,
  },
];

export const DEFAULT_TLD_BENCHMARKS: TldRateBenchmark[] = [
  { tld: ".com", registrar: "cloudflare", regYear1Usd: 11.17, renewAnnualUsd: 11.17, minTermYears: 1, restoreFeeUsd: 40, verifiedAt: "2026-11-26" },
  { tld: ".com", registrar: "porkbun", regYear1Usd: 11.81, renewAnnualUsd: 11.81, minTermYears: 1, restoreFeeUsd: 40, verifiedAt: "2026-11-26" },
  { tld: ".com", registrar: "namecheap", regYear1Usd: 12.08, renewAnnualUsd: 18.48, minTermYears: 1, restoreFeeUsd: 40, verifiedAt: "2026-11-26" },
  { tld: ".ai", registrar: "cloudflare", regYear1Usd: 80.0, renewAnnualUsd: 80.0, minTermYears: 2, restoreFeeUsd: 160, verifiedAt: "2026-11-26" },
  { tld: ".ai", registrar: "porkbun", regYear1Usd: 82.7, renewAnnualUsd: 82.7, minTermYears: 2, restoreFeeUsd: 460, verifiedAt: "2026-11-26" },
  { tld: ".ai", registrar: "namecheap", regYear1Usd: 89.98, renewAnnualUsd: 114.98, minTermYears: 2, restoreFeeUsd: 460, verifiedAt: "2026-11-26" },
  { tld: ".app", registrar: "cloudflare", regYear1Usd: 8.2, renewAnnualUsd: 14.2, minTermYears: 1, restoreFeeUsd: 50, verifiedAt: "2026-11-26" },
  { tld: ".app", registrar: "porkbun", regYear1Usd: 8.75, renewAnnualUsd: 14.93, minTermYears: 1, restoreFeeUsd: 50, verifiedAt: "2026-11-26" },
  { tld: ".dev", registrar: "cloudflare", regYear1Usd: 8.2, renewAnnualUsd: 12.2, minTermYears: 1, restoreFeeUsd: 50, verifiedAt: "2026-11-26" },
  { tld: ".dev", registrar: "porkbun", regYear1Usd: 8.75, renewAnnualUsd: 12.87, minTermYears: 1, restoreFeeUsd: 50, verifiedAt: "2026-11-26" },
  { tld: ".io", registrar: "porkbun", regYear1Usd: 28.12, renewAnnualUsd: 51.8, minTermYears: 1, restoreFeeUsd: 60, verifiedAt: "2026-11-26" },
  { tld: ".io", registrar: "cloudflare", regYear1Usd: 50.0, renewAnnualUsd: 50.0, minTermYears: 1, restoreFeeUsd: 60, verifiedAt: "2026-11-26" },
];

export const INFERENCE_RATE_BENCHMARKS: InferenceRateBenchmark[] = [
  { model: "Claude Fable 5.2", provider: "Anthropic", inputPer1mUsd: 10.0, outputPer1mUsd: 50.0, sweBenchPct: 96.8, role: "Cached deep rubric synthesis" },
  { model: "Claude Opus 5", provider: "Anthropic", inputPer1mUsd: 5.0, outputPer1mUsd: 25.0, sweBenchPct: 97.0, role: "Top SWE-Bench verification" },
  { model: "DeepSeek V4 Pro 0813", provider: "DeepSeek", inputPer1mUsd: 1.32, outputPer1mUsd: 3.96, sweBenchPct: 96.4, role: "4x cheaper frontier scoring" },
  { model: "GLM-5.3 (Open-Weight)", provider: "Zhipu", inputPer1mUsd: 1.4, outputPer1mUsd: 4.4, sweBenchPct: 95.4, role: "Zero-lock-in 1.05M ctx batch" },
  { model: "DeepSeek V4 Flash 0731", provider: "DeepSeek", inputPer1mUsd: 0.44, outputPer1mUsd: 1.32, sweBenchPct: 88.8, role: "100k ingestion pre-filter" },
];

export const CLUSTER_MORPHEMES: Record<Exclude<LexicalCluster, "CORE">, string[]> = {
  REALITY: [
    "reality", "verity", "groundtruth", "provenance", "attest", "ontological",
    "sim2real", "worldmesh", "causal", "truth", "real", "proof", "witness",
  ],
  JUSTICE: [
    "justice", "tribunal", "redress", "fiduciary", "lex", "charter",
    "audit", "sovereign", "arbitrate", "docket", "verdict", "notary", "sworn",
  ],
  COMPOSABILITY: [
    "composable", "composability", "fabric", "interop", "functor", "morphism",
    "weave", "conduit", "graft", "manifold", "federated", "mesh", "layer", "stack",
  ],
};

export function classifyLexicalCluster(fqdn: string): LexicalCluster {
  const sld = fqdn.toLowerCase().split(".")[0] ?? "";
  for (const m of CLUSTER_MORPHEMES.COMPOSABILITY) {
    if (sld.includes(m)) return "COMPOSABILITY";
  }
  for (const m of CLUSTER_MORPHEMES.JUSTICE) {
    if (sld.includes(m)) return "JUSTICE";
  }
  for (const m of CLUSTER_MORPHEMES.REALITY) {
    if (sld.includes(m)) return "REALITY";
  }
  return "CORE";
}

export function getRegimeBySlug(
  slug: RivalryRegimeSlug,
  regimes: RivalryRegime[] = DEFAULT_RIVALRY_REGIMES
): RivalryRegime {
  return regimes.find((r) => r.slug === slug) ?? DEFAULT_RIVALRY_REGIMES[0];
}

export function applyRivalryValuation(input: {
  fqdn: string;
  baseValueUsd: number | null;
  fiveYrTcoUsd: number | null;
  regimeSlug: RivalryRegimeSlug;
  regimes?: RivalryRegime[];
}): {
  cluster: LexicalCluster;
  multiplier: number;
  adjustedValueUsd: number;
  adjustedRoiMultiple: number;
} {
  const cluster = classifyLexicalCluster(input.fqdn);
  const regime = getRegimeBySlug(input.regimeSlug, input.regimes);
  let multiplier = 1.0;
  if (cluster === "REALITY") multiplier = regime.realityMult;
  else if (cluster === "JUSTICE") multiplier = regime.justiceMult;
  else if (cluster === "COMPOSABILITY") multiplier = regime.composabilityMult;

  const base = input.baseValueUsd ?? 0;
  const adjustedValueUsd = Number((base * multiplier).toFixed(2));
  const tco = Math.max(1, input.fiveYrTcoUsd ?? 59.3);
  const adjustedRoiMultiple = Number((adjustedValueUsd / tco).toFixed(2));

  return {
    cluster,
    multiplier,
    adjustedValueUsd,
    adjustedRoiMultiple,
  };
}
