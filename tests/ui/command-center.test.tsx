import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioSimulator } from "@/components/PortfolioSimulator";
import { PatternRadar } from "@/components/PatternRadar";
import { DomainExplorer } from "@/components/DomainExplorer";

describe("Command Center UI components", () => {
  it("recalculates 5-year TCO and net ROI when switching registrar in PortfolioSimulator", () => {
    render(
      <PortfolioSimulator
        selectedDomains={[
          {
            fqdn: "truthcipher.com",
            tld: ".com",
            estimatedValueUsd: 450,
            predicted12mGrowthPct: 32,
          },
          {
            fqdn: "truthledger.ai",
            tld: ".ai",
            estimatedValueUsd: 1800,
            predicted12mGrowthPct: 48,
          },
        ]}
      />
    );
    const cfText = screen.getByTestId("five-yr-total").textContent;
    fireEvent.change(screen.getByLabelText("Registrar"), {
      target: { value: "namecheap" },
    });
    const ncText = screen.getByTestId("five-yr-total").textContent;
    expect(cfText).not.toBe(ncText);
    expect(Number(ncText!.replace(/[^0-9.]/g, ""))).toBeGreaterThan(
      Number(cfText!.replace(/[^0-9.]/g, ""))
    );
  });

  it("renders breakout pattern absorption and remaining inventory in PatternRadar", () => {
    render(
      <PatternRadar
        patterns={[
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
        ]}
      />
    );
    expect(screen.getByText("prefix:truth:.ai")).toBeTruthy();
    expect(screen.getByText(/25 avail/i)).toBeTruthy();
  });

  it("renders verified timestamp, Available/Expensive tabs, and multi-source buy links in DomainExplorer", () => {
    render(
      <DomainExplorer
        initialItems={[
          {
            id: 1,
            fqdn: "truthcipher.com",
            tld: ".com",
            status: "available",
            tier: "hot",
            lastCheckedAt: new Date().toISOString(),
            fiveYrTcoUsd: 59.3,
            estimatedValueUsd: 1650,
            predicted12mGrowthPct: 28,
            net5yrRoiMultiple: 12.4,
            confidence: 0.82,
            topDrivers: [],
          },
        ]}
        initialNextCursor={null}
        initialTab="available"
        activePattern={null}
        selectedIds={new Set()}
        onToggleSelect={() => {}}
      />
    );
    expect(screen.getByText("Verified Available (Buy Now)")).toBeTruthy();
    expect(screen.getByText(/Expensive & Aftermarket/i)).toBeTruthy();
    expect(screen.getByText("Just now")).toBeTruthy();
    expect(screen.getByText("Porkbun ↗")).toBeTruthy();
    expect(screen.getByText("Cloudflare ↗")).toBeTruthy();
  });
});
