"use client";

import React, { useState } from "react";
import {
  DEFAULT_RIVALRY_REGIMES,
  DEFAULT_TLD_BENCHMARKS,
  INFERENCE_RATE_BENCHMARKS,
  type LexicalCluster,
  type RivalryRegime,
  type RivalryRegimeSlug,
  type TldRateBenchmark,
} from "@/lib/rivalry/regimes";

interface RivalryBenchmarkPanelProps {
  regimes?: RivalryRegime[];
  benchmarks?: TldRateBenchmark[];
  activeRegime: RivalryRegimeSlug;
  onSelectRegime: (slug: RivalryRegimeSlug) => void;
  activeCluster: Exclude<LexicalCluster, "CORE"> | null;
  onSelectCluster: (cluster: Exclude<LexicalCluster, "CORE"> | null) => void;
}

export function RivalryBenchmarkPanel({
  regimes = DEFAULT_RIVALRY_REGIMES,
  benchmarks = DEFAULT_TLD_BENCHMARKS,
  activeRegime,
  onSelectRegime,
  activeCluster,
  onSelectCluster,
}: RivalryBenchmarkPanelProps) {
  const [showRates, setShowRates] = useState(false);
  const current = regimes.find((r) => r.slug === activeRegime) ?? regimes[0];

  return (
    <section className="dr-card p-4 space-y-4">
      {/* Animated Telemetry Pipeline Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider">
            AI Rivalry Regime Engine &amp; Lexical Clusters
          </h2>
          <p className="text-xs" style={{ color: "var(--dr-muted)" }}>
            Switch frontier rivalry regimes to reprice REALITY, JUSTICE &amp; COMPOSABILITY domains in real time
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Animated SVG Flow Pill */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold"
            style={{
              backgroundColor: "var(--dr-subtle-bg)",
              border: "1px solid var(--dr-border)",
              borderRadius: "var(--dr-radius)",
            }}
          >
            <span>Fluid</span>
            <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
              <line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
              <circle r="2.5" cy="5" fill="var(--dr-pos)">
                <animate attributeName="cx" values="2;26;2" dur="2.2s" repeatCount="indefinite" />
              </circle>
            </svg>
            <span>Neon</span>
            <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
              <line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" />
              <circle r="2.5" cy="5" fill="var(--dr-accent)">
                <animate attributeName="cx" values="2;26;2" dur="1.8s" repeatCount="indefinite" />
              </circle>
            </svg>
            <span>Rivalry EV</span>
          </div>

          <button
            type="button"
            onClick={() => setShowRates((v) => !v)}
            className="dr-subtle px-2.5 py-1 text-xs font-bold cursor-pointer hover:opacity-85"
          >
            {showRates ? "Hide Nov 2026 Rate Benchmarks ▲" : "Nov 2026 TLD & Inference Benchmarks ▼"}
          </button>
        </div>
      </div>

      {/* 5-Regime Selector Strip */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {regimes.map((r) => {
          const isSelected = r.slug === activeRegime;
          return (
            <button
              key={r.slug}
              type="button"
              onClick={() => onSelectRegime(r.slug)}
              className="p-2.5 text-left transition cursor-pointer"
              style={
                isSelected
                  ? {
                      backgroundColor: "var(--dr-btn-bg)",
                      color: "var(--dr-btn-text)",
                      border: "var(--dr-border-w) solid var(--dr-border)",
                      borderRadius: "var(--dr-radius)",
                    }
                  : {
                      backgroundColor: "var(--dr-subtle-bg)",
                      color: "var(--dr-text)",
                      border: "1px solid var(--dr-border)",
                      borderRadius: "var(--dr-radius)",
                    }
              }
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-black truncate">{r.shortLabel}</span>
                <span className="font-mono text-[10px] font-bold opacity-85">
                  {Math.round(r.activeProbability * 100)}%
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px]">
                <span>R:{r.realityMult.toFixed(2)}x</span>
                <span>J:{r.justiceMult.toFixed(2)}x</span>
                <span>C:{r.composabilityMult.toFixed(2)}x</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Regime Summary + Clickable Lexical Cluster Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="text-xs">
          <span className="font-bold">{current.label}:</span>{" "}
          <span style={{ color: "var(--dr-muted)" }}>{current.summary}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--dr-muted)" }}>
            Cluster Filter:
          </span>
          {(
            [
              { key: null, label: "All Clusters", mult: null },
              { key: "REALITY", label: "REALITY", mult: current.realityMult },
              { key: "JUSTICE", label: "JUSTICE", mult: current.justiceMult },
              { key: "COMPOSABILITY", label: "COMPOSABILITY", mult: current.composabilityMult },
            ] as const
          ).map((c) => {
            const selected = activeCluster === c.key;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => onSelectCluster(c.key)}
                className="px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                style={
                  selected
                    ? {
                        backgroundColor: "var(--dr-btn-bg)",
                        color: "var(--dr-btn-text)",
                        border: "var(--dr-border-w) solid var(--dr-border)",
                        borderRadius: "var(--dr-radius)",
                      }
                    : {
                        backgroundColor: "var(--dr-subtle-bg)",
                        color: "var(--dr-text)",
                        border: "1px solid var(--dr-border)",
                        borderRadius: "var(--dr-radius)",
                      }
                }
              >
                {c.label}
                {c.mult ? ` (${c.mult.toFixed(2)}x)` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Nov 2026 Registrar & Inference Rate Benchmarks */}
      {showRates && (
        <div
          className="grid grid-cols-1 gap-4 pt-3 lg:grid-cols-2"
          style={{ borderTop: "1px solid var(--dr-border)" }}
        >
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider">
                Nov 2026 Registrar Rate Matrix (Live Neon Benchmarks)
              </h3>
              <span className="font-mono text-[10px]" style={{ color: "var(--dr-pos)" }}>
                .io Arbitrage: Porkbun Y1 $28.12 → CF = $228.12 / 5yr
              </span>
            </div>
            <div className="overflow-x-auto dr-subtle">
              <table className="w-full text-left text-[11px] font-mono tabular-nums border-collapse">
                <thead style={{ borderBottom: "1px solid var(--dr-border)", color: "var(--dr-muted)" }}>
                  <tr>
                    <th className="p-2">TLD</th>
                    <th className="p-2">Registrar</th>
                    <th className="p-2 text-right">Year 1</th>
                    <th className="p-2 text-right">Renew/yr</th>
                    <th className="p-2 text-right">Min Term</th>
                    <th className="p-2 text-right">Restore</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarks.map((b) => (
                    <tr key={`${b.tld}-${b.registrar}`} style={{ borderBottom: "1px solid var(--dr-border)" }}>
                      <td className="p-2 font-bold">{b.tld}</td>
                      <td className="p-2 capitalize font-sans">{b.registrar}</td>
                      <td className="p-2 text-right">${b.regYear1Usd.toFixed(2)}</td>
                      <td className="p-2 text-right">${b.renewAnnualUsd.toFixed(2)}</td>
                      <td className="p-2 text-right">{b.minTermYears}yr</td>
                      <td className="p-2 text-right" style={{ color: "var(--dr-muted)" }}>
                        ${b.restoreFeeUsd.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider">
                100k Worker Scoring Inference Benchmarks (Per 1M Tokens)
              </h3>
              <span className="font-mono text-[10px]" style={{ color: "var(--dr-accent)" }}>
                22x cost spread @ 95%+ SWE-Bench
              </span>
            </div>
            <div className="overflow-x-auto dr-subtle">
              <table className="w-full text-left text-[11px] font-mono tabular-nums border-collapse">
                <thead style={{ borderBottom: "1px solid var(--dr-border)", color: "var(--dr-muted)" }}>
                  <tr>
                    <th className="p-2">Model</th>
                    <th className="p-2 text-right">In / Out</th>
                    <th className="p-2 text-right">SWE-Bench</th>
                    <th className="p-2 font-sans">Optimal Pipeline Role</th>
                  </tr>
                </thead>
                <tbody>
                  {INFERENCE_RATE_BENCHMARKS.map((m) => (
                    <tr key={m.model} style={{ borderBottom: "1px solid var(--dr-border)" }}>
                      <td className="p-2 font-sans font-bold">{m.model}</td>
                      <td className="p-2 text-right">
                        ${m.inputPer1mUsd.toFixed(2)} / ${m.outputPer1mUsd.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-bold" style={{ color: "var(--dr-pos)" }}>
                        {m.sweBenchPct.toFixed(1)}%
                      </td>
                      <td className="p-2 font-sans" style={{ color: "var(--dr-muted)" }}>
                        {m.role}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
