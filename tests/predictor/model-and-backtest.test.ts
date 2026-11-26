import { describe, expect, it } from "vitest";
import { scoreDomain, MODEL_VERSION } from "@/lib/predictor/model";
import { evaluateBacktest } from "@/lib/predictor/backtest";

describe("explainable value-increase predictor & backtester", () => {
  it("boosts .ai domain when .com counterpart is taken and pattern momentum is high, with explainable drivers", () => {
    const high = scoreDomain({
      domainId: 10,
      fqdn: "truthledger.ai",
      sld: "truthledger",
      tld: ".ai",
      tokens: ["truth", "ledger"],
      archetype: "COMPOUND_2WORD",
      hasHyphen: false,
      hasDigit: false,
      fiveYrTcoUsd: 424.73,
      comCounterpartRegistered: true,
      snapshotAgeDays: 1,
      matchedPatterns: [
        {
          patternKey: "prefix:truth:.ai",
          totalDomains: 150,
          availableCount: 25,
          registeredCount: 125,
          absorption7d: 0.08,
          absorption30d: 0.35,
          shrunkAbsorption30d: 0.31,
          dropRate30d: 0.01,
          scarcityRatio: 0.83,
          compPriceSlope: 0.22,
          trendZScore: 2.1,
          momentumScore: 84,
        },
      ],
    });
    expect(high.modelVersion).toBe(MODEL_VERSION);
    expect(high.predicted12mGrowthPct).toBeGreaterThan(25);
    expect(high.predicted12mGrowthPct).toBeLessThanOrEqual(300);
    expect(high.confidence).toBeGreaterThan(0.7);
    expect(high.topDrivers.length).toBeGreaterThanOrEqual(3);
    expect(high.topDrivers[0].explanation).toBeTruthy();
  });

  it("clamps extreme growth to [-50, +300] and lowers confidence for tiny/stale samples", () => {
    const extreme = scoreDomain({
      domainId: 11,
      fqdn: "x-99-weird.io",
      sld: "x-99-weird",
      tld: ".io",
      tokens: ["x", "99", "weird"],
      archetype: "HYPHENATED",
      hasHyphen: true,
      hasDigit: true,
      fiveYrTcoUsd: 265.46,
      comCounterpartRegistered: false,
      snapshotAgeDays: 30,
      matchedPatterns: [
        {
          patternKey: "prefix:x:.io",
          totalDomains: 2,
          availableCount: 1,
          registeredCount: 1,
          absorption7d: 0.5,
          absorption30d: 0.5,
          shrunkAbsorption30d: 0.99,
          dropRate30d: 0,
          scarcityRatio: 0.99,
          compPriceSlope: 5.0,
          trendZScore: 10.0,
          momentumScore: 100,
        },
      ],
    });
    expect(extreme.predicted12mGrowthPct).toBeLessThanOrEqual(300);
    expect(extreme.predicted12mGrowthPct).toBeGreaterThanOrEqual(-50);
    expect(extreme.confidence).toBeLessThan(0.35);
  });

  it("computes MAPE and Precision@K against a naive 0%-growth baseline", () => {
    const report = evaluateBacktest([
      {
        domainId: 1,
        predicted12mGrowthPct: 45,
        actualGrowthPct: 40,
        actuallyAbsorbed: true,
      },
      {
        domainId: 2,
        predicted12mGrowthPct: 30,
        actualGrowthPct: 28,
        actuallyAbsorbed: true,
      },
      {
        domainId: 3,
        predicted12mGrowthPct: -5,
        actualGrowthPct: -8,
        actuallyAbsorbed: false,
      },
    ]);
    expect(report.sampleSize).toBe(3);
    expect(report.beatsBaseline).toBe(true);
    expect(report.mapePct).toBeLessThan(report.baselineMapePct);
  });

  it("does not let a broad tld:* pattern inflate confidence for a tiny n=2 specific prefix pattern", () => {
    const res = scoreDomain({
      domainId: 12,
      fqdn: "rareflint.ai",
      sld: "rareflint",
      tld: ".ai",
      tokens: ["rare", "flint"],
      archetype: "COMPOUND_2WORD",
      hasHyphen: false,
      hasDigit: false,
      fiveYrTcoUsd: 424.73,
      comCounterpartRegistered: false,
      snapshotAgeDays: 1,
      matchedPatterns: [
        { patternKey: "tld:.ai", totalDomains: 12500, availableCount: 4000, registeredCount: 8500, absorption7d: 0.01, absorption30d: 0.04, shrunkAbsorption30d: 0.04, dropRate30d: 0.01, scarcityRatio: 0.68, compPriceSlope: 0.05, trendZScore: 0.2, momentumScore: 45 },
        { patternKey: "prefix:rare:.ai", totalDomains: 2, availableCount: 1, registeredCount: 1, absorption7d: 0.5, absorption30d: 0.5, shrunkAbsorption30d: 0.08, dropRate30d: 0, scarcityRatio: 0.5, compPriceSlope: 0, trendZScore: 0, momentumScore: 30 },
      ],
    });
    expect(res.confidence).toBeLessThan(0.25);
  });
});
