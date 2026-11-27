"use client";

import React, { useEffect, useRef, useState } from "react";
import { buildDomainOffers } from "@/lib/offers/sources";
import {
  SUPPORTED_TLDS,
  type FeatureContribution,
  type TldCode,
} from "@/lib/types";

export interface ExplorerDomainRow {
  id: number;
  fqdn: string;
  tld: TldCode;
  status: string;
  tier: string;
  lastCheckedAt?: string | null;
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

function formatConfirmedTime(iso: string | null | undefined): string {
  if (!iso) return "Unverified";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unverified";
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  return d.toISOString().slice(0, 10);
}

function formatUsd(value: number | null): string {
  const v = value ?? 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `$${Math.round(v).toLocaleString()}`;
  return `$${v.toFixed(0)}`;
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
  const [preset, setPreset] = useState<"available" | "expensive" | "all">("available");
  const [status, setStatus] = useState<string>("available");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(true);
  const [sort, setSort] = useState<"value" | "growth" | "roi">("value");
  const [tld, setTld] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const isFirstRender = useRef(true);

  async function fetchPage(
    cursor: string | null,
    append: boolean,
    overrides?: {
      status?: string;
      verifiedOnly?: boolean;
      sort?: "value" | "growth" | "roi";
      pattern?: string | null;
    }
  ) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const effStatus = overrides?.status ?? status;
      const effVerified = overrides?.verifiedOnly ?? verifiedOnly;
      const effSort = overrides?.sort ?? sort;
      const effPattern =
        overrides?.pattern !== undefined ? overrides.pattern : activePattern;

      if (effStatus !== "all") params.set("status", effStatus);
      if (effVerified) params.set("verifiedOnly", "true");
      if (tld !== "all") params.set("tld", tld);
      if (effPattern) params.set("pattern", effPattern);
      if (q.trim()) params.set("q", q.trim());
      params.set("sort", effSort);
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
    void fetchPage(null, false, { pattern: activePattern });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePattern]);

  const applyPreset = (next: "available" | "expensive" | "all") => {
    setPreset(next);
    if (next === "available") {
      setStatus("available");
      setVerifiedOnly(true);
      setSort("value");
      void fetchPage(null, false, {
        status: "available",
        verifiedOnly: true,
        sort: "value",
      });
    } else if (next === "expensive") {
      setStatus("all");
      setVerifiedOnly(false);
      setSort("value");
      void fetchPage(null, false, {
        status: "all",
        verifiedOnly: false,
        sort: "value",
      });
    } else {
      setStatus("all");
      setVerifiedOnly(false);
      void fetchPage(null, false, { status: "all", verifiedOnly: false });
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
            100k Domain Explorer &amp; Multi-Source Offers
          </h2>
          <p className="text-xs text-slate-400">
            RDAP-verified availability, live confirmation timestamps &amp; multi-registrar / aftermarket links
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset("available")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              preset === "available"
                ? "bg-emerald-600 text-white"
                : "border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Verified Available
          </button>
          <button
            type="button"
            onClick={() => applyPreset("expensive")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              preset === "expensive"
                ? "bg-amber-600 text-white"
                : "border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Expensive / Premium ($)
          </button>
          <button
            type="button"
            onClick={() => applyPreset("all")}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              preset === "all"
                ? "bg-sky-600 text-white"
                : "border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            }`}
          >
            All Domains
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <option value="available">Available Only</option>
          <option value="registered">Registered / Taken</option>
          <option value="all">All Statuses</option>
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
        <select
          aria-label="Sort Order"
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as "value" | "growth" | "roi")
          }
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
        >
          <option value="value">Highest Value ($)</option>
          <option value="growth">Highest 12m Growth (%)</option>
          <option value="roi">Highest 5-Yr ROI (x)</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-emerald-500"
          />
          <span>Verified Only</span>
        </label>
        <button
          type="button"
          onClick={() => fetchPage(null, false)}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Apply"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
            <tr>
              <th className="py-2 pr-2">Sim</th>
              <th className="py-2 pr-3">Domain</th>
              <th className="py-2 pr-3">Status &amp; Confirmed</th>
              <th className="py-2 pr-3 text-right">Est. Value</th>
              <th className="py-2 pr-3 text-right">5-Yr TCO</th>
              <th className="py-2 pr-3 text-right">12m Growth</th>
              <th className="py-2 text-right">Buy / Offers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
            {items.map((row) => {
              const isExpanded = expandedId === row.id;
              const growth = row.predicted12mGrowthPct ?? 0;
              const offers = buildDomainOffers(row.fqdn, row.tld, row.status);
              const quickOffers = offers.slice(0, 3);
              const confirmedLabel = formatConfirmedTime(row.lastCheckedAt);

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
                    <td className="py-2 pr-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            row.status === "available"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : row.status === "registered"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-slate-700/60 text-slate-300"
                          }`}
                        >
                          {row.status === "available" && row.lastCheckedAt
                            ? "verified avail"
                            : row.status}
                        </span>
                        <span
                          title={row.lastCheckedAt ?? "Not yet probed"}
                          className="text-[10px] text-slate-400"
                        >
                          {confirmedLabel}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-white">
                      {formatUsd(row.estimatedValueUsd)}
                    </td>
                    <td className="py-2 pr-3 text-right text-amber-300">
                      ${(row.fiveYrTcoUsd ?? 0).toFixed(2)}
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
                    <td
                      className="py-2 text-right font-sans"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        {quickOffers.map((o) => (
                          <a
                            key={o.source}
                            href={o.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${o.source} — ${o.actionLabel}${
                              o.year1Usd !== null ? ` ($${o.year1Usd.toFixed(2)} Y1)` : ""
                            }`}
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold transition ${
                              o.cheapest
                                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                : o.kind === "aftermarket"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                                : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                            }`}
                          >
                            {o.shortLabel}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-950/90">
                      <td colSpan={7} className="p-3 font-sans">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Multi-Source Offers ({row.fqdn})
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Last confirmed:{" "}
                                {row.lastCheckedAt
                                  ? new Date(row.lastCheckedAt).toUTCString()
                                  : "Pending probe"}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              {offers.map((o) => (
                                <a
                                  key={o.source}
                                  href={o.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs hover:border-emerald-500/50"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-100">
                                      {o.source}
                                      {o.cheapest && (
                                        <span className="ml-1.5 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] text-emerald-300">
                                          Best 5-Yr
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {o.actionLabel}
                                    </div>
                                  </div>
                                  <div className="text-right font-mono text-[11px]">
                                    {o.year1Usd !== null ? (
                                      <>
                                        <div className="font-semibold text-emerald-300">
                                          ${o.year1Usd.toFixed(2)}/y1
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          ${o.fiveYrTcoUsd?.toFixed(2)} 5y
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-amber-300">
                                        Offer ↗
                                      </span>
                                    )}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Explainable Growth Drivers
                            </div>
                            {row.topDrivers && row.topDrivers.length > 0 ? (
                              <div className="space-y-1.5">
                                {row.topDrivers.map((d) => (
                                  <div
                                    key={d.feature}
                                    className="flex items-center justify-between rounded border border-slate-800/80 bg-slate-900/60 px-2.5 py-1.5 text-xs"
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
                            ) : (
                              <p className="text-xs text-slate-500">
                                Run /api/cron/patterns to refresh driver attribution.
                              </p>
                            )}
                          </div>
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
