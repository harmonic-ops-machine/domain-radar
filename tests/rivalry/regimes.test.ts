import { describe, expect, it } from "vitest";
import {
  applyRivalryValuation,
  classifyLexicalCluster,
} from "@/lib/rivalry/regimes";

describe("AI rivalry regime-switching engine & lexical clusters", () => {
  it("classifies REALITY, JUSTICE, and COMPOSABILITY domains accurately", () => {
    expect(classifyLexicalCluster("realityprovenance.com")).toBe("REALITY");
    expect(classifyLexicalCluster("justicetribunal.com")).toBe("JUSTICE");
    expect(classifyLexicalCluster("composablefabric.dev")).toBe("COMPOSABILITY");
    expect(classifyLexicalCluster("highos.com")).toBe("CORE");
  });

  it("reprices lexical clusters dynamically across AI rivalry regimes", () => {
    const worldModel = applyRivalryValuation({
      fqdn: "realityattest.com",
      baseValueUsd: 1000,
      fiveYrTcoUsd: 59.3,
      regimeSlug: "world_model_pivot",
    });
    expect(worldModel.cluster).toBe("REALITY");
    expect(worldModel.multiplier).toBeCloseTo(2.3, 2);
    expect(worldModel.adjustedValueUsd).toBeCloseTo(2300, 2);

    const auditShock = applyRivalryValuation({
      fqdn: "justicetribunal.com",
      baseValueUsd: 1000,
      fiveYrTcoUsd: 59.3,
      regimeSlug: "regulatory_audit",
    });
    expect(auditShock.cluster).toBe("JUSTICE");
    expect(auditShock.multiplier).toBeCloseTo(2.45, 2);
    expect(auditShock.adjustedValueUsd).toBeCloseTo(2450, 2);

    const openWeight = applyRivalryValuation({
      fqdn: "composablefabric.dev",
      baseValueUsd: 1000,
      fiveYrTcoUsd: 63.71,
      regimeSlug: "open_weight_shock",
    });
    expect(openWeight.cluster).toBe("COMPOSABILITY");
    expect(openWeight.multiplier).toBeCloseTo(2.2, 2);
    expect(openWeight.adjustedValueUsd).toBeCloseTo(2200, 2);
  });
});
