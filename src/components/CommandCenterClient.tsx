"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PatternMetrics } from "@/lib/patterns/tracker";
import {
  DEFAULT_RIVALRY_REGIMES,
  DEFAULT_TLD_BENCHMARKS,
  type LexicalCluster,
  type RivalryRegime,
  type RivalryRegimeSlug,
  type TldRateBenchmark,
} from "@/lib/rivalry/regimes";
import { DomainExplorer, type ExplorerDomainRow } from "./DomainExplorer";
import { PatternRadar } from "./PatternRadar";
import { PortfolioSimulator } from "./PortfolioSimulator";
import { RivalryBenchmarkPanel } from "./RivalryBenchmarkPanel";

interface CommandCenterClientProps {
  initialDomains: ExplorerDomainRow[];
  initialNextCursor: string | null;
  initialTab?: "available" | "expensive" | "all";
  initialPatterns: PatternMetrics[];
}

export function CommandCenterClient({
  initialDomains,
  initialNextCursor,
  initialTab = "available",
  initialPatterns,
}: CommandCenterClientProps) {
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [activeRegime, setActiveRegime] =
    useState<RivalryRegimeSlug>("expected_blended");
  const [activeCluster, setActiveCluster] = useState<
    Exclude<LexicalCluster, "CORE"> | null
  >(null);
  const [regimes, setRegimes] = useState<RivalryRegime[]>(
    DEFAULT_RIVALRY_REGIMES
  );
  const [benchmarks, setBenchmarks] = useState<TldRateBenchmark[]>(
    DEFAULT_TLD_BENCHMARKS
  );
  const [selectedMap, setSelectedMap] = useState<Map<number, ExplorerDomainRow>>(
    () => new Map(initialDomains.slice(0, 5).map((d) => [d.id, d]))
  );

  useEffect(() => {
    let active = true;
    fetch("/api/rivalry")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.regimes) && data.regimes.length > 0) {
          setRegimes(data.regimes);
        }
        if (Array.isArray(data.benchmarks) && data.benchmarks.length > 0) {
          setBenchmarks(data.benchmarks);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selectedIds = useMemo(() => new Set(selectedMap.keys()), [selectedMap]);
  const selectedForSim = useMemo(
    () =>
      Array.from(selectedMap.values()).map((d) => ({
        fqdn: d.fqdn,
        tld: d.tld,
        estimatedValueUsd: d.estimatedValueUsd ?? 250,
        predicted12mGrowthPct: d.predicted12mGrowthPct ?? 0,
      })),
    [selectedMap]
  );

  const handleToggleSelect = (row: ExplorerDomainRow) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <RivalryBenchmarkPanel
        regimes={regimes}
        benchmarks={benchmarks}
        activeRegime={activeRegime}
        onSelectRegime={setActiveRegime}
        activeCluster={activeCluster}
        onSelectCluster={setActiveCluster}
      />
      <PortfolioSimulator
        selectedDomains={selectedForSim}
        activeRegime={activeRegime}
        regimes={regimes}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <PatternRadar
            patterns={initialPatterns}
            activePattern={activePattern}
            onSelectPattern={setActivePattern}
          />
        </div>
        <div className="lg:col-span-9">
          <DomainExplorer
            initialItems={initialDomains}
            initialNextCursor={initialNextCursor}
            initialTab={initialTab}
            activePattern={activePattern}
            activeCluster={activeCluster}
            activeRegime={activeRegime}
            regimes={regimes}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>
    </div>
  );
}
