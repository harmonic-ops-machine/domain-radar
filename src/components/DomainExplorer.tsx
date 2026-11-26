"use client";

import React, { useEffect, useRef, useState } from "react";
import { SUPPORTED_TLDS, type FeatureContribution, type TldCode } from "@/lib/types";

export interface ExplorerDomainRow {
  id: number;
  fqdn: string;
  tld: TldCode;
  status: string;
  tier: string;
  fiveYrTcoUsd: number | null;
  estimatedValueUsd: number | null;
  predicted12mGrowthPct: number | null;
  net5yrRoiMultiple: number | null;
  confidence: number | null;
  topDrivers?: FeatureContribution[];
}

interface DomainExplorerProps {
  initialItems: ExplorerDomainRow[];
  initialNextCursor: string | null;
  activePattern: string | null;
  selectedIds: Set<number>;
  onToggleSelect: (row: ExplorerDomainRow) => void;
}

export function DomainExplorer({
  initialItems,
  initialNextCursor,
  activePattern,
  selectedIds,
  onToggleSelect,
}: DomainExplorerProps) {
  const [items, setItems] = useState<ExplorerDomainRow[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [status, setStatus] = useState<string>("all");
  const [tld, setTld] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const isFirstRender = useRef(true);

  async function fetchPage(cursor: string | null, append: boolean, patternOverride?: string | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (tld !== "all") params.set("tld", tld);
      const effectivePattern =
        patternOverride !== undefined ? patternOverride : activePattern;
      if (effectivePattern) params.set("pattern", effectivePattern);
      if (q.trim()) params.set("q", q.trim());
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "50");

      const res = await fetch(`/api/domains?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: ExplorerDomainRow[];
        nextCursor: string | null;
      };
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void fetchPage(null, false, activePattern);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePattern]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            100k Domain Explorer
          </h2>
          <p className="text-xs text-slate-400">
            O(log N) keyset cursor pagination • click any row for value-driver attribution
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Filter domain..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchPage(null, false);
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-100 placeholder:text-slate-500"
          />
          <select
            aria-label="Status Filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="registered">Registered</option>
            <option value="grace">Grace</option>
            <option value="redemption">Redemption</option>
          </select>
          <select
            aria-label="TLD Filter"
            value={tld}
            onChange={(e) => setTld(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          >
            <option value="all">All TLDs</option>
            {SUPPORTED_TLDS.map((ext) => (
              <option key={ext} value={ext}>
                {ext}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchPage(null, false)}
            disabled={loading}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
            <tr>
              <th className="py-2 pr-2">Sim</th>
              <th className="py-2 pr-3">Domain</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right">12m Growth</th>
              <th className="py-2 pr-3 text-right">Est. Value</th>
              <th className="py-2 pr-3 text-right">5-Yr TCO</th>
              <th className="py-2 pr-3 text-right">5-Yr ROI</th>
              <th className="py-2 text-right">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {items.map((row) => {
              const isExpanded = expandedId === row.id;
              const growth = row.predicted12mGrowthPct ?? 0;
              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    className="cursor-pointer hover:bg-slate-800/40"
                  >
                    <td
                      className="py-2 pr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => onToggleSelect(row)}
                        className="accent-emerald-500"
                      />
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-100">
                      {row.fqdn}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-sans font-medium ${
                          row.status === "available"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-700/60 text-slate-300"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td
                      className={`py-2 pr-3 text-right font-semibold ${
                        growth >= 20
                          ? "text-emerald-300"
                          : growth >= 0
                          ? "text-sky-300"
                          : "text-rose-400"
                      }`}
                    >
                      {growth >= 0 ? "+" : ""}
                      {growth.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-200">
                      ${(row.estimatedValueUsd ?? 0).toFixed(0)}
                    </td>
                    <td className="py-2 pr-3 text-right text-amber-300">
                      ${(row.fiveYrTcoUsd ?? 0).toFixed(2)}
                    </td>
                    <td className="py-2 pr-3 text-right text-sky-300">
                      {(row.net5yrRoiMultiple ?? 0).toFixed(2)}x
                    </td>
                    <td className="py-2 text-right text-slate-400">
                      {Math.round((row.confidence ?? 0) * 100)}%
                    </td>
                  </tr>
                  {isExpanded && row.topDrivers && row.topDrivers.length > 0 && (
                    <tr className="bg-slate-950/80">
                      <td colSpan={8} className="p-3 font-sans">
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Explainable Growth Drivers
                        </div>
                        <div className="space-y-1">
                          {row.topDrivers.map((d) => (
                            <div
                              key={d.feature}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-300">
                                {d.explanation}
                              </span>
                              <span
                                className={`font-mono font-semibold ${
                                  d.impactPct >= 0
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {d.impactPct >= 0 ? "+" : ""}
                                {d.impactPct.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchPage(nextCursor, true)}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load Next 50"}
          </button>
        </div>
      )}
    </section>
  );
}
