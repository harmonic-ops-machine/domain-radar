"use client";

import React, { useMemo, useState } from "react";
import { calculateFiveYearTco } from "@/lib/pricing/tco";
import {
  applyRivalryValuation,
  type RivalryRegime,
  type RivalryRegimeSlug,
} from "@/lib/rivalry/regimes";
import type { RegistrarId, TldCode } from "@/lib/types";

export interface SimulatorDomainItem {
  fqdn: string;
  tld: TldCode;
  estimatedValueUsd: number;
  predicted12mGrowthPct: number;
}

interface PortfolioSimulatorProps {
  selectedDomains: SimulatorDomainItem[];
  activeRegime?: RivalryRegimeSlug;
  regimes?: RivalryRegime[];
}

export function PortfolioSimulator({
  selectedDomains,
  activeRegime = "expected_blended",
  regimes,
}: PortfolioSimulatorProps) {
  const [registrar, setRegistrar] = useState<RegistrarId>("cloudflare");
  const [inflationPct, setInflationPct] = useState<number>(3);

  const summary = useMemo(() => {
    const annualInflation = inflationPct / 100;
    let year1 = 0;
    let fiveYr = 0;
    let predicted5YrValue = 0;

    const yearlyCost = [0, 0, 0, 0, 0];
    const yearlyValue = [0, 0, 0, 0, 0];

    const rows = selectedDomains.map((d) => {
      const tco = calculateFiveYearTco(d.tld, { registrar, annualInflation });
      const rival = applyRivalryValuation({
        fqdn: d.fqdn,
        baseValueUsd: d.estimatedValueUsd,
        fiveYrTcoUsd: tco.fiveYrTotalUsd,
        regimeSlug: activeRegime,
        regimes,
      });
      const dampedValue =
        rival.adjustedValueUsd *
        Math.max(0.25, 1 + d.predicted12mGrowthPct / 100) ** 2.2;
      year1 += tco.year1Usd;
      fiveYr += tco.fiveYrTotalUsd;
      predicted5YrValue += dampedValue;

      const avgRenew = tco.renewals4YrUsd / 4;
      let cumCost = 0;
      for (let yr = 0; yr < 5; yr++) {
        cumCost += yr === 0 ? tco.year1Usd : avgRenew * (1 + annualInflation * (yr - 1) * 0.25);
        yearlyCost[yr] += cumCost;
        const frac = (yr + 1) / 5;
        yearlyValue[yr] += rival.adjustedValueUsd + (dampedValue - rival.adjustedValueUsd) * frac;
      }

      return { ...d, ...tco, dampedValue, cluster: rival.cluster, regimeMult: rival.multiplier };
    });

    const netRoiMultiple = fiveYr > 0 ? predicted5YrValue / fiveYr : 0;
    return { rows, year1, fiveYr, predicted5YrValue, netRoiMultiple, yearlyCost, yearlyValue };
  }, [selectedDomains, registrar, inflationPct, activeRegime, regimes]);

  const escapeCsv = (val: string | number) => {
    const s = String(val);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const handleExportCsv = () => {
    const header = "fqdn,tld,cluster,regime_mult,registrar,year1_usd,five_yr_tco_usd,predicted_5yr_value_usd\n";
    const body = summary.rows
      .map((r) =>
        [
          escapeCsv(r.fqdn),
          escapeCsv(r.tld),
          escapeCsv(r.cluster),
          r.regimeMult.toFixed(2),
          escapeCsv(r.registrar),
          r.year1Usd.toFixed(2),
          r.fiveYrTotalUsd.toFixed(2),
          r.dampedValue.toFixed(2),
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domain-radar-5yr-${registrar}-${activeRegime}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Morphing 5-year SVG Area Chart geometry
  const maxVal = Math.max(100, ...summary.yearlyValue, ...summary.yearlyCost);
  const w = 320;
  const h = 76;
  const xStep = w / 4;
  const valPoints = summary.yearlyValue
    .map((v, i) => `${(i * xStep).toFixed(1)},${(h - (v / maxVal) * (h - 10) - 4).toFixed(1)}`)
    .join(" ");
  const costPoints = summary.yearlyCost
    .map((v, i) => `${(i * xStep).toFixed(1)},${(h - (v / maxVal) * (h - 10) - 4).toFixed(1)}`)
    .join(" ");
  const valArea = `0,${h} ${valPoints} ${w},${h}`;
  const costArea = `0,${h} ${costPoints} ${w},${h}`;

  return (
    <section className="dr-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">
            5-Year Portfolio TCO &amp; Rivalry ROI Simulator
          </h2>
          <p className="text-xs" style={{ color: "var(--dr-muted)" }}>
            {selectedDomains.length} domain(s) staged • Nov 2026 Verisign/Anguilla rates incl. ICANN
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={selectedDomains.length === 0}
          className="dr-btn-primary px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--dr-muted)" }}>
              <span>Registrar</span>
              <select
                aria-label="Registrar"
                value={registrar}
                onChange={(e) => setRegistrar(e.target.value as RegistrarId)}
                className="dr-input px-2.5 py-1.5 text-sm font-medium"
              >
                <option value="cloudflare">Cloudflare Registrar (At-Cost)</option>
                <option value="porkbun">Porkbun</option>
                <option value="namecheap">Namecheap</option>
                <option value="optimal">Optimal Mix (Cheapest/TLD)</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--dr-muted)" }}>
              <span>Annual Renewal Inflation ({inflationPct.toFixed(1)}%)</span>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={inflationPct}
                onChange={(e) => setInflationPct(Number(e.target.value))}
                className="mt-2 cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="dr-subtle p-3">
              <div className="text-[11px] font-semibold" style={{ color: "var(--dr-muted)" }}>
                Year 1 Outlay
              </div>
              <div className="mt-1 font-mono text-base font-bold tabular-nums">
                ${summary.year1.toFixed(2)}
              </div>
            </div>
            <div className="dr-subtle p-3">
              <div className="text-[11px] font-semibold" style={{ color: "var(--dr-muted)" }}>
                5-Year Total Cost
              </div>
              <div
                data-testid="five-yr-total"
                className="mt-1 font-mono text-base font-bold tabular-nums"
                style={{ color: "var(--dr-tco)" }}
              >
                ${summary.fiveYr.toFixed(2)}
              </div>
            </div>
            <div className="dr-subtle p-3">
              <div className="text-[11px] font-semibold" style={{ color: "var(--dr-muted)" }}>
                Predicted 5-Yr Value
              </div>
              <div
                className="mt-1 font-mono text-base font-bold tabular-nums"
                style={{ color: "var(--dr-pos)" }}
              >
                ${summary.predicted5YrValue.toFixed(2)}
              </div>
            </div>
            <div className="dr-subtle p-3">
              <div className="text-[11px] font-semibold" style={{ color: "var(--dr-muted)" }}>
                Net 5-Yr ROI Multiple
              </div>
              <div
                className="mt-1 font-mono text-base font-bold tabular-nums"
                style={{ color: "var(--dr-accent)" }}
              >
                {summary.netRoiMultiple.toFixed(2)}x
              </div>
            </div>
          </div>
        </div>

        {/* Morphing 5-Year TCO vs Value Area Fan Chart */}
        <div className="lg:col-span-4 dr-subtle p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span>5-Yr Appreciation vs TCO</span>
            <span className="font-mono text-[10px]" style={{ color: "var(--dr-pos)" }}>
              Yr1 → Yr5 Live
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20 mt-1" aria-label="5-Year TCO vs Value Curve">
            <polygon points={valArea} fill="var(--dr-pos)" fillOpacity="0.18" />
            <polyline points={valPoints} fill="none" stroke="var(--dr-pos)" strokeWidth="2.5" />
            <polygon points={costArea} fill="var(--dr-tco)" fillOpacity="0.22" />
            <polyline points={costPoints} fill="none" stroke="var(--dr-tco)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <div className="flex justify-between font-mono text-[10px]" style={{ color: "var(--dr-muted)" }}>
            <span>Y1</span>
            <span>Y2</span>
            <span>Y3</span>
            <span>Y4</span>
            <span>Y5</span>
          </div>
        </div>
      </div>
    </section>
  );
}
