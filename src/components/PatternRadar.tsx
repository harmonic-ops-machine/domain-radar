"use client";

import React from "react";
import type { PatternMetrics } from "@/lib/patterns/tracker";

interface PatternRadarProps {
  patterns: PatternMetrics[];
  activePattern?: string | null;
  onSelectPattern?: (patternKey: string | null) => void;
}

export function PatternRadar({
  patterns,
  activePattern = null,
  onSelectPattern,
}: PatternRadarProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            Pattern Velocity Radar
          </h2>
          <p className="text-xs text-slate-400">
            Empirical-Bayes 30d absorption &amp; scarcity momentum
          </p>
        </div>
        {activePattern && onSelectPattern && (
          <button
            type="button"
            onClick={() => onSelectPattern(null)}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Clear filter
          </button>
        )}
      </div>

      {patterns.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">
          No pattern telemetry yet. Run /api/cron/patterns after seeding.
        </p>
      ) : (
        <div className="space-y-2">
          {patterns.map((p) => {
            const isSelected = activePattern === p.patternKey;
            const scarcityPct = Math.round(p.scarcityRatio * 100);
            const absPct = (p.shrunkAbsorption30d * 100).toFixed(1);
            return (
              <button
                key={p.patternKey}
                type="button"
                onClick={() =>
                  onSelectPattern?.(isSelected ? null : p.patternKey)
                }
                className={`w-full rounded-lg border p-3 text-left transition ${
                  isSelected
                    ? "border-emerald-500/70 bg-emerald-950/30"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-100">
                    {p.patternKey}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-300">
                    {p.momentumScore.toFixed(0)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>30d abs: {absPct}%</span>
                  <span>{p.availableCount} avail / {p.totalDomains}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                    style={{ width: `${Math.min(100, scarcityPct)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
