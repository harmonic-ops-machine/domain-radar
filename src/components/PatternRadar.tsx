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
    <section className="dr-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Pattern Velocity Radar
          </h2>
          <p className="text-xs" style={{ color: "var(--dr-muted)" }}>
            Empirical-Bayes 30d absorption &amp; scarcity momentum
          </p>
        </div>
        {activePattern && onSelectPattern && (
          <button
            type="button"
            onClick={() => onSelectPattern(null)}
            className="dr-subtle px-2 py-1 text-xs font-semibold cursor-pointer"
          >
            Clear filter
          </button>
        )}
      </div>

      {patterns.length === 0 ? (
        <p className="py-6 text-center text-xs" style={{ color: "var(--dr-muted)" }}>
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
                className="w-full p-3 text-left transition cursor-pointer"
                style={{
                  backgroundColor: isSelected
                    ? "var(--dr-avail-bg)"
                    : "var(--dr-subtle-bg)",
                  color: "var(--dr-text)",
                  border: isSelected
                    ? "2px solid var(--dr-btn-bg)"
                    : "1px solid var(--dr-border)",
                  borderRadius: "var(--dr-radius)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold">
                    {p.patternKey}
                  </span>
                  <span
                    className="px-1.5 py-0.5 font-mono text-xs font-bold"
                    style={{
                      backgroundColor: "var(--dr-btn-bg)",
                      color: "var(--dr-btn-text)",
                      borderRadius: "var(--dr-radius)",
                    }}
                  >
                    {p.momentumScore.toFixed(0)}
                  </span>
                </div>
                <div
                  className="mt-2 flex items-center justify-between text-[11px] tabular-nums"
                  style={{ color: "var(--dr-muted)" }}
                >
                  <span>30d abs: {absPct}%</span>
                  <span>
                    {p.availableCount} avail / {p.totalDomains}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden"
                  style={{
                    backgroundColor: "var(--dr-border)",
                    borderRadius: "var(--dr-radius)",
                  }}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, scarcityPct)}%`,
                      backgroundColor: "var(--dr-pos)",
                    }}
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
