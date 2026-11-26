import { describe, expect, it } from "vitest";
import { extractDomainPatterns } from "@/lib/patterns/extract";
import { computePatternMetrics } from "@/lib/patterns/tracker";

describe("pattern extraction & Empirical Bayes velocity tracking", () => {
  it("tokenizes compound SLDs into morphemes, archetype, and multi-label pattern keys", () => {
    const res = extractDomainPatterns("truthledger", ".ai");
    expect(res.tokens).toEqual(["truth", "ledger"]);
    expect(res.archetype).toBe("COMPOUND_2WORD");
    expect(res.keys).toEqual(
      expect.arrayContaining([
        "tld:.ai",
        "prefix:truth",
        "prefix:truth:.ai",
        "suffix:ledger",
        "archetype:COMPOUND_2WORD:.ai",
        "len_bucket:11-15:.ai",
      ])
    );
  });

  it("shrinks noisy n=2 absorption toward TLD prior while letting n=200 absorption dominate", () => {
    const noisySmall = computePatternMetrics({
      patternKey: "prefix:flint:.ai",
      totalDomains: 2,
      availableCount: 1,
      registeredCount: 1,
      newlyRegistered7d: 1,
      newlyRegistered30d: 1,
      dropped30d: 0,
      availableStart30d: 2,
      tldPriorAbsorption30d: 0.04,
      compPriceSlope: 0,
      trendZScore: 0,
    });
    const robustLarge = computePatternMetrics({
      patternKey: "prefix:truth:.ai",
      totalDomains: 200,
      availableCount: 40,
      registeredCount: 160,
      newlyRegistered7d: 12,
      newlyRegistered30d: 40,
      dropped30d: 1,
      availableStart30d: 80,
      tldPriorAbsorption30d: 0.04,
      compPriceSlope: 0.18,
      trendZScore: 1.8,
    });
    expect(noisySmall.absorption30d).toBeCloseTo(0.5, 2);
    expect(noisySmall.shrunkAbsorption30d).toBeLessThan(0.1);
    expect(robustLarge.shrunkAbsorption30d).toBeGreaterThan(0.4);
    expect(robustLarge.momentumScore).toBeGreaterThan(
      noisySmall.momentumScore + 30
    );
  });
});
