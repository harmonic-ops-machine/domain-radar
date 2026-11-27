import { desc, sql } from "drizzle-orm";
import { createDb } from "@/db";
import { domains, patterns, workerRuns } from "@/db/schema";
import { encodeCursor } from "@/app/api/domains/query";
import { CommandCenterClient } from "@/components/CommandCenterClient";
import type { ExplorerDomainRow } from "@/components/DomainExplorer";
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
    fiveYrTcoUsd: 424.73,
    estimatedValueUsd: 1680,
    predicted12mGrowthPct: 46.2,
    net5yrRoiMultiple: 9.1,
    confidence: 0.84,
    topDrivers: [
      { feature: "pattern_absorption_30d", impactPct: 29.5, explanation: "Empirical-Bayes 30d pattern absorption (31.0%)" },
      { feature: "cross_tld_spillover", impactPct: 16.0, explanation: ".com counterpart already registered (spillover demand)" },
      { feature: "renewal_drag", impactPct: -5.4, explanation: "5-year TCO drag ($424.73 holding cost)" },
    ],
  },
  {
    id: 2,
    fqdn: "truthcipher.com",
    tld: ".com",
    status: "available",
    tier: "hot",
    fiveYrTcoUsd: 59.3,
    estimatedValueUsd: 540,
    predicted12mGrowthPct: 31.4,
    net5yrRoiMultiple: 16.6,
    confidence: 0.79,
    topDrivers: [
      { feature: "pattern_absorption_30d", impactPct: 22.8, explanation: "Empirical-Bayes 30d pattern absorption (24.0%)" },
      { feature: "pattern_scarcity", impactPct: 11.2, explanation: "Pattern scarcity pressure (80% registered)" },
    ],
  },
  {
    id: 3,
    fqdn: "realcanon.com",
    tld: ".com",
    status: "available",
    tier: "hot",
    fiveYrTcoUsd: 59.3,
    estimatedValueUsd: 495,
    predicted12mGrowthPct: 27.8,
    net5yrRoiMultiple: 14.3,
    confidence: 0.77,
    topDrivers: [
      { feature: "pattern_absorption_30d", impactPct: 19.0, explanation: "Empirical-Bayes 30d pattern absorption (20.0%)" },
      { feature: "pattern_scarcity", impactPct: 9.8, explanation: "Pattern scarcity pressure (75% registered)" },
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
  {
    patternKey: "prefix:real:.com",
    totalDomains: 420,
    availableCount: 84,
    registeredCount: 336,
    absorption7d: 0.05,
    absorption30d: 0.24,
    shrunkAbsorption30d: 0.22,
    dropRate30d: 0.01,
    scarcityRatio: 0.8,
    compPriceSlope: 0.14,
    trendZScore: 1.4,
    momentumScore: 73,
  },
];

async function loadDashboardData() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) {
    return {
      connected: false,
      totalTracked: 100_000,
      availableCount: 100,
      lastRunStatus: "Demo Mode (connect Neon DATABASE_URL)",
      initialDomains: DEMO_DOMAINS,
      initialNextCursor: null as string | null,
      initialPatterns: DEMO_PATTERNS,
    };
  }

  try {
    const db = createDb();
    const [topDomains, topPatterns, latestRuns, approxRes] = await Promise.all([
      db
        .select()
        .from(domains)
        .where(
          sql`${domains.status} = 'available' AND ${domains.lastCheckedAt} IS NOT NULL`
        )
        .orderBy(
          sql`COALESCE(${domains.estimatedValueUsd}, -999999) DESC`,
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
      db.execute(
        sql`SELECT reltuples::bigint AS approx FROM pg_class WHERE relname = 'domains'`
      ),
    ]);

    const hasMore = topDomains.length > 50;
    const sliced = hasMore ? topDomains.slice(0, 50) : topDomains;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            sortValue: last.estimatedValueUsd ?? -999999,
            id: last.id,
          })
        : null;

    const approxRow = (
      approxRes as unknown as { rows?: Array<{ approx?: string | number }> }
    ).rows?.[0];
    const approxNum = Number(approxRow?.approx ?? -1);

    return {
      connected: true,
      totalTracked: approxNum >= 0 ? approxNum : sliced.length,
      availableCount: sliced.length,
      lastRunStatus: latestRuns[0]
        ? `${latestRuns[0].status} (${latestRuns[0].claimedCount} claimed)`
        : "Ready for first cron tick",
      initialDomains: sliced.map((d) => ({
        id: d.id,
        fqdn: d.fqdn,
        tld: d.tld as TldCode,
        status: d.status,
        tier: d.tier,
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
      availableCount: 100,
      lastRunStatus: "DB unreachable — showing preview dataset",
      initialDomains: DEMO_DOMAINS,
      initialNextCursor: null as string | null,
      initialPatterns: DEMO_PATTERNS,
    };
  }
}

export default async function HomePage() {
  const data = await loadDashboardData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Domain Radar
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            100k Self-Updating Pattern Tracker &amp; Value Increase Predictor • Vercel Fluid Compute + Neon Postgres
          </p>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            data.connected
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          }`}
        >
          {data.connected ? "Neon Live" : "Preview Mode — Set DATABASE_URL"}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Catalog Capacity</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
            {data.totalTracked.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Top-Ranked Available</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            {data.availableCount.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-xs text-slate-400">Worker Telemetry</div>
          <div className="mt-1 truncate font-mono text-sm font-semibold text-sky-300">
            {data.lastRunStatus}
          </div>
        </div>
      </section>

      <CommandCenterClient
        initialDomains={data.initialDomains}
        initialNextCursor={data.initialNextCursor}
        initialPatterns={data.initialPatterns}
      />
    </main>
  );
}
