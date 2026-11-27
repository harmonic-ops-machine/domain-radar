export type LexicalCluster = "REALITY" | "JUSTICE" | "COMPOSABILITY";

export interface AiRivalryRegime {
  regimeSlug: string;
  label: string;
  realityMult: number;
  justiceMult: number;
  composabilityMult: number;
  activeProbability: number;
}

export interface LexicalClusterSeed {
  morpheme: string;
  cluster: LexicalCluster;
  patternRule: string;
  priorWeight: number;
}

export const AI_RIVALRY_REGIMES: AiRivalryRegime[] = [
  {
    regimeSlug: "protocol_war",
    label: "Anthropic vs OpenAI Agentic Protocol War",
    realityMult: 1.35,
    justiceMult: 1.55,
    composabilityMult: 1.85,
    activeProbability: 0.4,
  },
  {
    regimeSlug: "open_weight_shock",
    label: "DeepSeek V4 / GLM Cost-Deflation Surge",
    realityMult: 1.25,
    justiceMult: 1.3,
    composabilityMult: 2.2,
    activeProbability: 0.25,
  },
  {
    regimeSlug: "world_model_pivot",
    label: "Google / xAI Embodied & Spatial Pivot",
    realityMult: 2.3,
    justiceMult: 1.25,
    composabilityMult: 1.45,
    activeProbability: 0.2,
  },
  {
    regimeSlug: "regulatory_audit",
    label: "Global Provenance & Liability Clampdown",
    realityMult: 1.9,
    justiceMult: 2.45,
    composabilityMult: 1.4,
    activeProbability: 0.15,
  },
];

export const LEXICAL_CLUSTER_SEEDS: LexicalClusterSeed[] = [
  { morpheme: "reality", cluster: "REALITY", patternRule: "prefix:reality", priorWeight: 1.42 },
  { morpheme: "verity", cluster: "REALITY", patternRule: "prefix:verity", priorWeight: 1.38 },
  { morpheme: "provenance", cluster: "REALITY", patternRule: "suffix:provenance", priorWeight: 1.34 },
  { morpheme: "groundtruth", cluster: "REALITY", patternRule: "prefix:groundtruth", priorWeight: 1.45 },
  { morpheme: "justice", cluster: "JUSTICE", patternRule: "prefix:justice", priorWeight: 1.4 },
  { morpheme: "tribunal", cluster: "JUSTICE", patternRule: "suffix:tribunal", priorWeight: 1.36 },
  { morpheme: "fiduciary", cluster: "JUSTICE", patternRule: "prefix:fiduciary", priorWeight: 1.44 },
  { morpheme: "redress", cluster: "JUSTICE", patternRule: "suffix:redress", priorWeight: 1.29 },
  { morpheme: "composable", cluster: "COMPOSABILITY", patternRule: "prefix:composable", priorWeight: 1.52 },
  { morpheme: "functor", cluster: "COMPOSABILITY", patternRule: "suffix:functor", priorWeight: 1.46 },
  { morpheme: "manifold", cluster: "COMPOSABILITY", patternRule: "suffix:manifold", priorWeight: 1.39 },
  { morpheme: "interop", cluster: "COMPOSABILITY", patternRule: "prefix:interop", priorWeight: 1.48 },
];

const SEED_MAP = new Map<string, LexicalClusterSeed>(
  LEXICAL_CLUSTER_SEEDS.map((s) => [s.morpheme, s])
);

const EXTENDED_CLUSTER_HINTS: Record<string, LexicalCluster> = {
  truth: "REALITY",
  real: "REALITY",
  fact: "REALITY",
  proof: "REALITY",
  witness: "REALITY",
  verdict: "JUSTICE",
  docket: "JUSTICE",
  notary: "JUSTICE",
  audit: "JUSTICE",
  law: "JUSTICE",
  mesh: "COMPOSABILITY",
  layer: "COMPOSABILITY",
  protocol: "COMPOSABILITY",
  stack: "COMPOSABILITY",
  graph: "COMPOSABILITY",
  node: "COMPOSABILITY",
};

export function classifyLexicalCluster(tokens: string[]): LexicalCluster | null {
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    const seed = SEED_MAP.get(t);
    if (seed) return seed.cluster;
  }
  for (const tok of tokens) {
    const hint = EXTENDED_CLUSTER_HINTS[tok.toLowerCase()];
    if (hint) return hint;
  }
  return null;
}

export function getClusterMultiplier(
  cluster: LexicalCluster,
  regimeSlug: string = "expected_value"
): number {
  if (regimeSlug === "expected_value") {
    return Number(
      AI_RIVALRY_REGIMES.reduce((acc, r) => {
        const m =
          cluster === "REALITY"
            ? r.realityMult
            : cluster === "JUSTICE"
            ? r.justiceMult
            : r.composabilityMult;
        return acc + m * r.activeProbability;
      }, 0).toFixed(3)
    );
  }
  const regime = AI_RIVALRY_REGIMES.find((r) => r.regimeSlug === regimeSlug);
  if (!regime) return 1.0;
  return cluster === "REALITY"
    ? regime.realityMult
    : cluster === "JUSTICE"
    ? regime.justiceMult
    : regime.composabilityMult;
}

export function computeRivalryMultiplier(
  tokens: string[],
  regimeSlug: string = "expected_value"
): { cluster: LexicalCluster | null; multiplier: number } {
  const cluster = classifyLexicalCluster(tokens);
  if (!cluster) return { cluster: null, multiplier: 1.0 };
  return {
    cluster,
    multiplier: getClusterMultiplier(cluster, regimeSlug),
  };
}
