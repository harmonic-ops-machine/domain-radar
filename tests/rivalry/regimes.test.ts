import { describe, expect, it } from "vitest";
import {
  AI_RIVALRY_REGIMES,
  LEXICAL_CLUSTER_SEEDS,
  classifyLexicalCluster,
  computeRivalryMultiplier,
} from "@/lib/rivalry/regimes";

describe("AI rivalry regime shock matrix & lexical cluster vectors", () => {
  it("contains all 4 regimes summing to probability 1.0 and 12 lexical seeds", () => {
    expect(AI_RIVALRY_REGIMES).toHaveLength(4);
    const totalProb = AI_RIVALRY_REGIMES.reduce(
      (s, r) => s + r.activeProbability,
      0
    );
    expect(totalProb).toBeCloseTo(1.0, 3);
    expect(LEXICAL_CLUSTER_SEEDS).toHaveLength(12);
  });

  it("classifies REALITY, JUSTICE, and COMPOSABILITY tokens and computes regime multipliers", () => {
    expect(classifyLexicalCluster(["groundtruth", "ledger"])).toBe("REALITY");
    expect(classifyLexicalCluster(["fiduciary", "audit"])).toBe("JUSTICE");
    expect(classifyLexicalCluster(["composable", "mesh"])).toBe("COMPOSABILITY");

    const regAuditJustice = computeRivalryMultiplier(
      ["fiduciary", "tribunal"],
      "regulatory_audit"
    );
    const openWeightComp = computeRivalryMultiplier(
      ["composable", "interop"],
      "open_weight_shock"
    );
    expect(regAuditJustice.multiplier).toBeGreaterThan(2.4);
    expect(openWeightComp.multiplier).toBeGreaterThan(2.1);
  });
});
