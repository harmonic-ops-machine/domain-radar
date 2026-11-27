"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  buildDomainOfferLinks,
  getVerificationProofUrl,
} from "@/lib/offers/sources";
import { SUPPORTED_TLDS, type FeatureContribution, type TldCode } from "@/lib/types";

export interface ExplorerDomainRow {
  id: number;
  fqdn: string;
  tld: TldCode;
  status: string;
  tier: string;
  registrar?: string | null;
  expiresAt?: string | null;
  lastCheckedAt?: string | null;
  fiveYrTcoUsd: number | null;
  estimatedValueUsd: number | null;
  predicted12mGrowthPct: number | null;
  net5yrRoiMultiple: number | null;
  confidence: number | null;
  topDrivers?: FeatureContribution[];
}

type ExplorerTab = "available" | "expensive" | "all";

interface DomainExplorerProps {
  initialItems: ExplorerDomainRow[];
  initialNextCursor: string | null;
  initialTab?: ExplorerTab;
  activePattern: string | null;
  selectedIds: Set<number>;
  onToggleSelect: (row: ExplorerDomainRow) => void;
}

function formatVerifiedAgo(iso?: string | null): { label: string; exact: string } {
  if (!iso) return { label: "Unverified", exact: "Not yet probed via live RDAP/WHOIS" };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { label: "Unverified", exact: "" };
  const diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  let label = "Just now";
  if (diffSec >= 86400) label = `${Math.floor(diffSec / 86400)}d ago`;
  else if (diffSec >= 3600) label = `${Math.floor(diffSec / 3600)}h ago`;
  else if (diffSec >= 60) label = `${Math.floor(diffSec / 60)}m ago`;
  else if (diffSec >= 10) label = `${diffSec}s ago`;

  const exact = dt.toLocaleString("en-US", {
    timeZone: "Pacific/Honolulu",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  return { label, exact };
}

function formatUsd(val?: number | null): string {
  const n = val ?? 0;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function DomainExplorer({
  initialItems,
  initialNextCursor,
  initialTab = "available",
  activePattern,
  selectedIds,
  onToggleSelect,
}: DomainExplorerProps) {
  const [tab, setTab] = useState<ExplorerTab>(initialTab);
  const [items, setItems] = useState<ExplorerDomainRow[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [tld, setTld] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [sort, setSort] = useState<"growth" | "value">(
    initialTab === "expensive" ? "value" : "growth"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [verifyingFqdn, setVerifyingFqdn] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  async function fetchPage(
    cursor: string | null,
    append: boolean,
    overrides?: {
      tab?: ExplorerTab;
      sort?: "growth" | "value";
      pattern?: string | null;
      tld?: string;
      q?: string;
    }
  ) {
    setLoading(true);
    try {
      const effTab = overrides?.tab ?? tab;
      const effSort = overrides?.sort ?? sort;
      const effTld = overrides?.tld ?? tld;
      const effQ = overrides?.q ?? q;
      const effPattern =
        overrides && "pattern" in overrides ? overrides.pattern : activePattern;

      const params = new URLSearchParams();
      if (effTab === "available") {
        params.set("status", "available");
        params.set("verifiedOnly", "true");
      } else if (effTab === "expensive") {
        params.set("status", "expensive");
      }
      params.set("sort", effSort);
      if (effTld !== "all") params.set("tld", effTld);
      if (effPattern) params.set("pattern", effPattern);
      if (effQ.trim()) params.set("q", effQ.trim());
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

  async function handleLiveVerify(row: ExplorerDomainRow) {
    setVerifyingFqdn(row.fqdn);
    try {
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fqdn: row.fqdn }),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as {
        status: string;
        registrar: string | null;
        expiresAt: string | null;
        lastCheckedAt: string;
      };
      setItems((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: updated.status,
                registrar: updated.registrar,
                expiresAt: updated.expiresAt,
                lastCheckedAt: updated.lastCheckedAt,
              }
            : item
        )
      );
    } finally {
      setVerifyingFqdn(null);
    }
  }

  function switchTab(nextTab: ExplorerTab) {
    const nextSort = nextTab === "expensive" ? "value" : "growth";
    setTab(nextTab);
    setSort(nextSort);
    setExpandedId(null);
    void fetchPage(null, false, { tab: nextTab, sort: nextSort });
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
    <section className="dr-card p-4">
      {/* Mode Switcher Tabs: Verified Available vs Expensive/Aftermarket vs Full 100k */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3"
        style={{ borderBottom: "var(--dr-border-w) solid var(--dr-border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => switchTab("available")}
            className="px-3 py-1.5 text-xs font-bold cursor-pointer transition-opacity"
            style={
              tab === "available"
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
            Verified Available (Buy Now)
          </button>
          <button
            type="button"
            onClick={() => switchTab("expensive")}
            className="px-3 py-1.5 text-xs font-bold cursor-pointer transition-opacity"
            style={
              tab === "expensive"
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
            Expensive &amp; Aftermarket ($2k+)
          </button>
          <button
            type="button"
            onClick={() => switchTab("all")}
            className="px-3 py-1.5 text-xs font-bold cursor-pointer transition-opacity"
            style={
              tab === "all"
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
            All 100k Catalog
          </button>
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
            className="dr-input px-2.5 py-1 text-xs w-36"
          />
          <select
            aria-label="TLD Filter"
            value={tld}
            onChange={(e) => setTld(e.target.value)}
            className="dr-input px-2 py-1 text-xs"
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
            onChange={(e) => {
              const next = e.target.value === "value" ? "value" : "growth";
              setSort(next);
              void fetchPage(null, false, { sort: next });
            }}
            className="dr-input px-2 py-1 text-xs"
          >
            <option value="growth">Sort: 12m Growth</option>
            <option value="value">Sort: Highest Value</option>
          </select>
          <button
            type="button"
            onClick={() => fetchPage(null, false)}
            disabled={loading}
            className="dr-btn-primary px-3 py-1 text-xs font-bold cursor-pointer disabled:opacity-50"
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

      <p className="mb-3 text-xs" style={{ color: "var(--dr-muted)" }}>
        {tab === "available"
          ? "Showing live RDAP/WHOIS-verified unregistered domains with exact confirmation time and direct multi-registrar purchase links. Click any row for all 5 registrars + live registry proof."
          : tab === "expensive"
          ? "Showing high-value registered & premium aftermarket domains ($2,000–$100,000+) with multi-source broker/marketplace links (Afternic, Sedo, GoDaddy, Atom, DropCatch)."
          : "Full 100,000-domain catalog with O(log N) keyset cursor pagination. Click Verify on any row for instant live RDAP/WHOIS confirmation."}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead
            className="text-[11px] uppercase tracking-wider"
            style={{
              borderBottom: "var(--dr-border-w) solid var(--dr-border)",
              color: "var(--dr-muted)",
            }}
          >
            <tr>
              <th className="py-2 pr-2">Sim</th>
              <th className="py-2 pr-3">Domain</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Last Verified</th>
              <th className="py-2 pr-3 text-right">Est. Value</th>
              <th className="py-2 pr-3 text-right">
                {tab === "expensive" ? "5-Yr TCO / Type" : "5-Yr TCO"}
              </th>
              <th className="py-2 pr-3 text-right">5-Yr ROI</th>
              <th className="py-2 text-right">Multi-Source Buy / Offers</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center font-sans text-xs"
                  style={{ color: "var(--dr-muted)" }}
                >
                  No domains matched this filter. Try switching tabs or clearing your search.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const isExpanded = expandedId === row.id;
                const offers = buildDomainOfferLinks({
                  fqdn: row.fqdn,
                  tld: row.tld,
                  status: row.status,
                  estimatedValueUsd: row.estimatedValueUsd,
                });
                const verified = formatVerifiedAgo(row.lastCheckedAt);
                const proof = getVerificationProofUrl(row.fqdn, row.tld);
                const badgeStyle =
                  row.status === "available"
                    ? {
                        backgroundColor: "var(--dr-avail-bg)",
                        color: "var(--dr-avail-text)",
                      }
                    : row.status === "registered" ||
                      row.status === "grace" ||
                      row.status === "redemption"
                    ? {
                        backgroundColor: "var(--dr-reg-bg)",
                        color: "var(--dr-reg-text)",
                      }
                    : {
                        backgroundColor: "var(--dr-unk-bg)",
                        color: "var(--dr-unk-text)",
                      };

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: "1px solid var(--dr-border)",
                      }}
                    >
                      <td
                        className="py-2.5 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.fqdn}`}
                          checked={selectedIds.has(row.id)}
                          onChange={() => onToggleSelect(row)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 pr-3 font-bold">
                        <div>{row.fqdn}</div>
                        {row.registrar && (
                          <div
                            className="font-sans text-[10px] font-normal truncate max-w-[160px]"
                            style={{ color: "var(--dr-muted)" }}
                          >
                            {row.registrar}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className="px-2 py-0.5 text-[10px] font-sans font-bold uppercase"
                          style={{
                            ...badgeStyle,
                            borderRadius: "var(--dr-radius)",
                            border: "1px solid var(--dr-border)",
                          }}
                        >
                          {row.status === "available" ? "FREE / AVAIL" : row.status}
                        </span>
                      </td>
                      <td
                        className="py-2.5 pr-3 font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            title={verified.exact}
                            className="text-[11px] font-medium whitespace-nowrap"
                            style={{
                              color: row.lastCheckedAt
                                ? "var(--dr-pos)"
                                : "var(--dr-muted)",
                            }}
                          >
                            {verified.label}
                          </span>
                          <button
                            type="button"
                            disabled={verifyingFqdn === row.fqdn}
                            onClick={() => void handleLiveVerify(row)}
                            title="Run live DNS + RDAP/WHOIS check right now"
                            className="px-1.5 py-0.5 text-[10px] font-bold cursor-pointer disabled:opacity-40"
                            style={{
                              backgroundColor: "var(--dr-subtle-bg)",
                              color: "var(--dr-text)",
                              border: "1px solid var(--dr-border)",
                              borderRadius: "var(--dr-radius)",
                            }}
                          >
                            {verifyingFqdn === row.fqdn ? "..." : "Verify"}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold">
                        {formatUsd(row.estimatedValueUsd)}
                      </td>
                      <td
                        className="py-2.5 pr-3 text-right"
                        style={{ color: "var(--dr-tco)" }}
                      >
                        {row.status === "registered"
                          ? "Aftermarket"
                          : `$${(row.fiveYrTcoUsd ?? 0).toFixed(2)}`}
                      </td>
                      <td
                        className="py-2.5 pr-3 text-right font-bold"
                        style={{ color: "var(--dr-accent)" }}
                      >
                        {row.status === "registered"
                          ? "Make Offer"
                          : `${(row.net5yrRoiMultiple ?? 0).toFixed(1)}x`}
                      </td>
                      <td
                        className="py-2.5 text-right font-sans"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap justify-end gap-1">
                          {offers.slice(0, 3).map((o) => (
                            <a
                              key={o.source}
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-0.5 text-[10px] font-bold no-underline hover:opacity-80"
                              style={{
                                backgroundColor: "var(--dr-subtle-bg)",
                                color: "var(--dr-text)",
                                border: "1px solid var(--dr-border)",
                                borderRadius: "var(--dr-radius)",
                              }}
                              title={`${o.actionLabel} (${o.priceLabel})`}
                            >
                              {o.source} ↗
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ backgroundColor: "var(--dr-subtle-bg)" }}>
                        <td colSpan={8} className="p-4 font-sans">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {/* Multi-Source Offers Panel */}
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <span
                                  className="text-[11px] font-bold uppercase tracking-wider"
                                  style={{ color: "var(--dr-muted)" }}
                                >
                                  {row.status === "available"
                                    ? "Buy Now — 5 Multi-Registrar Sources"
                                    : "Make Offer / Buy — 5 Aftermarket Sources"}
                                </span>
                                <a
                                  href={proof.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold underline"
                                  style={{ color: "var(--dr-accent)" }}
                                >
                                  {proof.label} Proof ↗
                                </a>
                              </div>
                              <div className="space-y-1.5">
                                {offers.map((o) => (
                                  <a
                                    key={o.source}
                                    href={o.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between px-3 py-2 text-xs no-underline hover:opacity-85"
                                    style={{
                                      backgroundColor: "var(--dr-card-bg)",
                                      color: "var(--dr-text)",
                                      border: "1px solid var(--dr-border)",
                                      borderRadius: "var(--dr-radius)",
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">{o.source}</span>
                                      {o.badge && (
                                        <span
                                          className="px-1.5 py-0.5 text-[10px] font-semibold"
                                          style={{
                                            backgroundColor: "var(--dr-subtle-bg)",
                                            border: "1px solid var(--dr-border)",
                                            borderRadius: "var(--dr-radius)",
                                          }}
                                        >
                                          {o.badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                      <span className="font-bold">{o.priceLabel}</span>
                                      {o.fiveYrLabel && (
                                        <span style={{ color: "var(--dr-muted)" }}>
                                          ({o.fiveYrLabel})
                                        </span>
                                      )}
                                      <span style={{ color: "var(--dr-accent)" }}>↗</span>
                                    </div>
                                  </a>
                                ))}
                              </div>
                            </div>

                            {/* Verification Telemetry + Explainable Value Drivers */}
                            <div className="space-y-3">
                              <div
                                className="p-3 text-xs"
                                style={{
                                  backgroundColor: "var(--dr-card-bg)",
                                  border: "1px solid var(--dr-border)",
                                  borderRadius: "var(--dr-radius)",
                                }}
                              >
                                <div
                                  className="text-[11px] font-bold uppercase tracking-wider mb-1"
                                  style={{ color: "var(--dr-muted)" }}
                                >
                                  Live Verification Record
                                </div>
                                <div>
                                  <strong>Last Confirmed:</strong>{" "}
                                  {verified.exact || "Not verified yet"}
                                </div>
                                {row.registrar && (
                                  <div>
                                    <strong>Registrar:</strong> {row.registrar}
                                  </div>
                                )}
                                {row.expiresAt && (
                                  <div>
                                    <strong>Expires:</strong>{" "}
                                    {new Date(row.expiresAt).toLocaleDateString()}
                                  </div>
                                )}
                              </div>

                              {row.topDrivers && row.topDrivers.length > 0 && (
                                <div
                                  className="p-3"
                                  style={{
                                    backgroundColor: "var(--dr-card-bg)",
                                    border: "1px solid var(--dr-border)",
                                    borderRadius: "var(--dr-radius)",
                                  }}
                                >
                                  <div
                                    className="mb-1.5 text-[11px] font-bold uppercase tracking-wider"
                                    style={{ color: "var(--dr-muted)" }}
                                  >
                                    Explainable Growth Drivers
                                  </div>
                                  <div className="space-y-1">
                                    {row.topDrivers.map((d) => (
                                      <div
                                        key={d.feature}
                                        className="flex items-center justify-between text-xs"
                                      >
                                        <span>{d.explanation}</span>
                                        <span
                                          className="font-mono font-bold"
                                          style={{
                                            color:
                                              d.impactPct >= 0
                                                ? "var(--dr-pos)"
                                                : "var(--dr-neg)",
                                          }}
                                        >
                                          {d.impactPct >= 0 ? "+" : ""}
                                          {d.impactPct.toFixed(1)}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => fetchPage(nextCursor, true)}
            className="dr-btn-primary px-4 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load Next 50"}
          </button>
        </div>
      )}
    </section>
  );
}
