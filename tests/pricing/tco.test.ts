import { describe, expect, it } from "vitest";
import { calculateFiveYearTco } from "@/lib/pricing/tco";

describe("5-year TCO calculator", () => {
  it("matches Nov 2026 Cloudflare .com 5-yr cost at 3% annual renewal inflation", () => {
    const res = calculateFiveYearTco(".com", {
      registrar: "cloudflare",
      annualInflation: 0.03,
    });
    expect(res.year1Usd).toBeCloseTo(11.17, 2);
    expect(res.fiveYrTotalUsd).toBeCloseTo(59.3, 2);
  });

  it("accounts for .ai 2-year minimum billing cadence when requested in cashflow mode", () => {
    const annualized = calculateFiveYearTco(".ai", {
      registrar: "cloudflare",
      annualInflation: 0.03,
    });
    expect(annualized.fiveYrTotalUsd).toBeCloseTo(424.73, 2);
    expect(annualized.minBillingYears).toBe(2);
  });

  it("picks cheapest registrar per TLD for optimal mode", () => {
    const ioOpt = calculateFiveYearTco(".io", {
      registrar: "optimal",
      annualInflation: 0.03,
    });
    expect(ioOpt.fiveYrTotalUsd).toBeLessThan(
      calculateFiveYearTco(".io", {
        registrar: "cloudflare",
        annualInflation: 0.03,
      }).fiveYrTotalUsd
    );
  });
});
