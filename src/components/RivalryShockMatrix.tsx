"use client";

import React, { useState } from "react";
import {
  AI_RIVALRY_REGIMES,
  LEXICAL_CLUSTER_SEEDS,
  getClusterMultiplier,
  type LexicalCluster,
} from "@/lib/rivalry/regimes";

const CLUSTERS: Array<{ id: LexicalCluster; accent: string }> = [
  { id: "REALITY", accent: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" },
  { id: "JUSTICE", accent: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  { id: "COMPOSABILITY", accent: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
];

export function RivalryShockMatrix() {
  const [activeRegime, setActiveRegime] = useState<string>("expected_value");

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            AI Rivalry Shock Matrix &amp; Lexical Vectors
          </h2>
          <p className="text-xs text-slate-400">
            Regime-weighted valuation multipliers across REALITY, JUSTICE &amp; COMPOSABILITY
          </p>
        </div>
        <select
          aria-label="Active AI Rivalry Regime"
          value={activeRegime}
          onChange={(e) => setActiveRegime(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100"
        >
          <option value="expected_value">
            Expected Value (Probability-Weighted)
          </option>
          {AI_RIVALRY_REGIMES.map((r) => (
            <option key={r.regimeSlug} value={r.regimeSlug}>
              {r.label} ({Math.round(r.activeProbability * 100)}%)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {CLUSTERS.map((c) => {
          const mult = getClusterMultiplier(c.id, activeRegime);
          const seeds = LEXICAL_CLUSTER_SEEDS.filter((s) => s.cluster === c.id);
          return (
            <div
              key={c.id}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider ${c.accent}`}
                >
                  {c.id}
                </span>
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                  {mult.toFixed(2)}x
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {seeds.map((s) => (
                  <span
                    key={s.morpheme}
                    title={`${s.patternRule} (prior ${s.priorWeight}x)`}
                    className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                  >
                    {s.morpheme}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
