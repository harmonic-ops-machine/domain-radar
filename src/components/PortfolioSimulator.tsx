"use client";

import React, { useMemo, useState } from "react";
import { calculateFiveYearTco } from "@/lib/pricing/tco";
import type { RegistrarId, TldCode } from "@/lib/types";

export interface SimulatorDomainItem {
  fqdn: string;
  tld: TldCode;
  estimatedValueUsd: number;
  predicted12mGrowthPct: number;
}

interface PortfolioSimulatorProps {
  selectedDomains: SimulatorDomainItem[];
}

export function PortfolioSimulator({
  selectedDomains,
}: PortfolioSimulatorProps) {
  const [registrar, setRegistrar] = useState<RegistrarId>("cloudflare");
  const [inflationPct, setInflationPct] = useState<number>(3);

  const summary = useMemo(() => {
    const annualInflation = inflationPct / 100;
    let year1 = 0;
    let fiveYr = 0;
    let predicted5YrValue = 0;

    const rows = selectedDomains.map((d) => {
      const tco = calculateFiveYearTco(d.tld, { registrar, annualInflation });
      const dampedValue =
        d.estimatedValueUsd *
        Math.max(0.25, 1 + d.predicted12mGrowthPct / 100) ** 2.2;
      year1 += tco.year1Usd;
      fiveYr += tco.fiveYrTotalUsd;
      predicted5YrValue += dampedValue;
      return { ...d, ...tco, dampedValue };
    });

    const netRoiMultiple = fiveYr > 0 ? predicted5YrValue / fiveYr : 0;
    return { rows, year1, fiveYr, predicted5YrValue, netRoiMultiple };
  }, [selectedDomains, registrar, inflationPct]);

  const escapeCsv = (val: string | number) => {
    const s = String(val);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const handleExportCsv = () => {
    const header = "fqdn,tld,registrar,year1_usd,five_yr_tco_usd,predicted_5yr_value_usd\n";
    const body = summary.rows
      .map((r) =>
        [
          escapeCsv(r.fqdn),
          escapeCsv(r.tld),
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
    a.download = `domain-radar-5yr-${registrar}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="dr-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">
            5-Year Portfolio TCO &amp; ROI Simulator
          </h2>
          <p className="text-xs" style={{ color: "var(--dr-muted)" }}>
            {selectedDomains.length} domain(s) staged • Nov 2026 rates incl. ICANN
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

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    </section>
  );
}
