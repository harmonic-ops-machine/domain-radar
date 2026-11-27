import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { createDb } from "@/db";
import { domains, patterns, workerRuns } from "@/db/schema";
import { encodeCursor } from "@/app/api/domains/query";
import { CommandCenterClient } from "@/components/CommandCenterClient";
import type { ExplorerDomainRow } from "@/components/DomainExplorer";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import type { PatternMetrics } from "@/lib/patterns/tracker";
import type { TldCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEMO_DOMAINS: ExplorerDomainRow[] = [
  {
    id: 1,
    fqdn: "truthledger.ai",
    tld: ".ai",
    status: "available",
    tier: "hot",
    lastCheckedAt: new Date().toISOString(),
    fiveYrTcoUsd: 424.73,
    estimatedValueUsd: 2680,
    predicted12mGrowthPct: 46.2,
    net5yrRoiMultiple: 9.1,
    confidence: 0.84,
    topDrivers: [
      { feature: "pattern_absorption_30d", impactPct: 29.5, explanation: "Empirical-Bayes 30d pattern absorption (31.0%)" },
      { feature: "cross_tld_spillover", impactPct: 16.0, explanation: ".com counterpart already registered (spillover demand)" },
      { feature: "renewal_drag", impactPct: -5.4, explanation: "5-year TCO drag ($424.73 holding cost)" },
    ],
  },
];

const DEMO_PATTERNS: PatternMetrics[] = [
  {
    patternKey: "prefix:truth:.ai",
    totalDomains: 150,
    availableCount: 25,
    registeredCount: 125,
    absorption7d: 0.08,
    absorption30d: 0.35,
    shrunkAbsorption30d: 0.31,
    dropRate30d: 0.01,
    scarcityRatio: 0.83,
    compPriceSlope: 0.22,
    trendZScore: 2.1,
    momentumScore: 84,
  },
];

async function loadDashboardData() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    return {
      connected: false,
      totalTracked: 100_000,
      verifiedAvailableCount: 1,
      expensiveCount: 0,
      lastRunStatus: "Demo Mode (connect Neon DATABASE_URL)",
      initialTab: "available" as const,
      initialDomains: DEMO_DOMAINS,
      initialNextCursor: null as string | null,
      initialPatterns: DEMO_PATTERNS,
    };
  }

  try {
    const db = createDb();
    const [verifiedAvailRows, topPatterns, latestRuns, statsRes] =
      await Promise.all([
        db
          .select()
          .from(domains)
          .where(and(eq(domains.status, "available"), isNotNull(domains.lastCheckedAt)))
          .orderBy(
            sql`COALESCE(${domains.predicted12mGrowthPct}, -999999) DESC`,
            desc(domains.id)
          )
          .limit(51),
        db
          .select()
          .from(patterns)
          .orderBy(desc(patterns.momentumScore))
          .limit(15),
        db
          .select()
          .from(workerRuns)
          .orderBy(desc(workerRuns.startedAt))
          .limit(1),
        db.execute(sql`
          SELECT
            (SELECT reltuples::bigint FROM pg_class WHERE relname = 'domains') AS approx_total,
            COUNT(*) FILTER (WHERE status = 'available' AND last_checked_at IS NOT NULL)::int AS verified_avail,
            COUNT(*) FILTER (WHERE status IN ('registered','grace','redemption') OR estimated_value_usd >= 2000)::int AS expensive_count
          FROM domains
        `),
      ]);

    const statRow = (
      statsRes as unknown as {
        rows?: Array<{
          approx_total?: string | number;
          verified_avail?: string | number;
          expensive_count?: string | number;
        }>;
      }
    ).rows?.[0];

    const hasVerifiedAvail = verifiedAvailRows.length > 0;
    const rowsToShow = hasVerifiedAvail
      ? verifiedAvailRows
      : await db
          .select()
          .from(domains)
          .orderBy(sql`COALESCE(${domains.estimatedValueUsd}, -1) DESC`, desc(domains.id))
          .limit(51);

    const initialTab: "available" | "expensive" = hasVerifiedAvail
      ? "available"
      : "expensive";
    const hasMore = rowsToShow.length > 50;
    const sliced = hasMore ? rowsToShow.slice(0, 50) : rowsToShow;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            sortValue:
              initialTab === "expensive"
                ? (last.estimatedValueUsd ?? -1)
                : (last.predicted12mGrowthPct ?? -999999),
            id: last.id,
          })
        : null;

    const approxNum = Number(statRow?.approx_total ?? -1);

    return {
      connected: true,
      totalTracked: approxNum >= 0 ? approxNum : sliced.length,
      verifiedAvailableCount: Number(statRow?.verified_avail ?? 0),
      expensiveCount: Number(statRow?.expensive_count ?? 0),
      lastRunStatus: latestRuns[0]
        ? `${latestRuns[0].status} (${latestRuns[0].claimedCount} probed)`
        : "Ready for live probe",
      initialTab,
      initialDomains: sliced.map((d) => ({
        id: d.id,
        fqdn: d.fqdn,
        tld: d.tld as TldCode,
        status: d.status,
        tier: d.tier,
        registrar: d.registrar,
        expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
        lastCheckedAt: d.lastCheckedAt ? d.lastCheckedAt.toISOString() : null,
        fiveYrTcoUsd: d.fiveYrTcoUsd,
        estimatedValueUsd: d.estimatedValueUsd,
        predicted12mGrowthPct: d.predicted12mGrowthPct,
        net5yrRoiMultiple: d.net5yrRoiMultiple,
        confidence: d.confidence,
        topDrivers: d.topDrivers ?? [],
      })),
      initialNextCursor: nextCursor,
      initialPatterns: topPatterns,
    };
  } catch {
    return {
      connected: false,
      totalTracked: 100_000,
      verifiedAvailableCount: 1,
      expensiveCount: 0,
      lastRunStatus: "DB unreachable — showing preview dataset",
      initialTab: "available" as const,
      initialDomains: DEMO_DOMAINS,
      initialNextCursor: null as string | null,
      initialPatterns: DEMO_PATTERNS,
    };
  }
}

export default async function HomePage() {
  const data = await loadDashboardData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header
        className="dr-card mb-6 flex flex-wrap items-center justify-between gap-4 p-5"
        style={{
          backgroundColor: "var(--dr-header-bg)",
          color: "var(--dr-header-text)",
        }}
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight uppercase">
            Domain Radar
          </h1>
          <p className="mt-1 text-xs opacity-80">
            Verified Available Domains + Expensive Aftermarket • Live RDAP/WHOIS Timestamps &amp; Multi-Source Offers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ThemeSwitcher />
          <div
            className="px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: data.connected
                ? "var(--dr-avail-bg)"
                : "var(--dr-unk-bg)",
              color: data.connected
                ? "var(--dr-avail-text)"
                : "var(--dr-unk-text)",
              border: "1px solid var(--dr-border)",
              borderRadius: "var(--dr-radius)",
            }}
          >
            {data.connected ? "Neon Live" : "Preview Mode"}
          </div>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="dr-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--dr-muted)" }}>
            Catalog Capacity
          </div>
          <div className="mt-1 font-mono text-2xl font-black tabular-nums">
            {data.totalTracked.toLocaleString()}
          </div>
        </div>
        <div className="dr-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--dr-muted)" }}>
            Verified Available
          </div>
          <div
            className="mt-1 font-mono text-2xl font-black tabular-nums"
            style={{ color: "var(--dr-pos)" }}
          >
            {data.verifiedAvailableCount.toLocaleString()}
          </div>
        </div>
        <div className="dr-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--dr-muted)" }}>
            Expensive / Taken ($2k+)
          </div>
          <div
            className="mt-1 font-mono text-2xl font-black tabular-nums"
            style={{ color: "var(--dr-accent)" }}
          >
            {data.expensiveCount.toLocaleString()}
          </div>
        </div>
        <div className="dr-card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--dr-muted)" }}>
            Live Prober Status
          </div>
          <div className="mt-1 truncate font-mono text-sm font-bold">
            {data.lastRunStatus}
          </div>
        </div>
      </section>

      <CommandCenterClient
        initialDomains={data.initialDomains}
        initialNextCursor={data.initialNextCursor}
        initialTab={data.initialTab}
        initialPatterns={data.initialPatterns}
      />
    </main>
  );
}
