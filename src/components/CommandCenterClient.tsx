"use client";

import React, { useMemo, useState } from "react";
import type { PatternMetrics } from "@/lib/patterns/tracker";
import { DomainExplorer, type ExplorerDomainRow } from "./DomainExplorer";
import { PatternRadar } from "./PatternRadar";
import { PortfolioSimulator } from "./PortfolioSimulator";

interface CommandCenterClientProps {
  initialDomains: ExplorerDomainRow[];
  initialNextCursor: string | null;
  initialPatterns: PatternMetrics[];
}

export function CommandCenterClient({
  initialDomains,
  initialNextCursor,
  initialPatterns,
}: CommandCenterClientProps) {
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Map<number, ExplorerDomainRow>>(
    () => new Map(initialDomains.slice(0, 5).map((d) => [d.id, d]))
  );

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
      <PortfolioSimulator selectedDomains={selectedForSim} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <PatternRadar
            patterns={initialPatterns}
            activePattern={activePattern}
            onSelectPattern={setActivePattern}
          />
        </div>
        <div className="lg:col-span-8">
          <DomainExplorer
            initialItems={initialDomains}
            initialNextCursor={initialNextCursor}
            activePattern={activePattern}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </div>
      </div>
    </div>
  );
}
