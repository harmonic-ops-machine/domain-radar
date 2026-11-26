import { inArray, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { domainPatterns, domains, patterns, valuePredictions } from "@/db/schema";
import type { PatternMetrics } from "@/lib/patterns/tracker";
import { calculateFiveYearTco } from "@/lib/pricing/tco";
import type {
  FeatureContribution,
  PatternArchetype,
  TldCode,
} from "@/lib/types";
import { buildFeatureVector } from "./features";

export const MODEL_VERSION = "v1-ridge-explainable";

export interface ScoreDomainInput {
  domainId: number;
  fqdn: string;
  sld: string;
  tld: TldCode;
  tokens: string[];
  archetype: PatternArchetype;
  hasHyphen: boolean;
  hasDigit: boolean;
  fiveYrTcoUsd: number;
  comCounterpartRegistered: boolean;
  snapshotAgeDays: number;
  matchedPatterns: PatternMetrics[];
}

export interface PredictionOutput {
  domainId: number;
  modelVersion: string;
  estimatedFairValueUsd: number;
  predicted12mValueUsd: number;
  predicted12mGrowthPct: number;
  fiveYrTcoUsd: number;
  net5yrRoiMultiple: number;
  confidence: number;
  topDrivers: FeatureContribution[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function scoreDomain(input: ScoreDomainInput): PredictionOutput {
  const f = buildFeatureVector(input);

  const intrinsicMultiplier =
    (0.45 + 0.55 * f.lengthScore) *
    (0.55 + 0.45 * f.wordQualityScore) *
    (0.7 + 0.3 * f.pronounceabilityScore) *
    (1 - f.cleanCharPenalty * 0.65);

  const scarcityMultiplier = 1 + f.weightedScarcity * 0.55;
  const estimatedFairValueUsd = Number(
    Math.max(25, f.tldBaseValueUsd * intrinsicMultiplier * scarcityMultiplier).toFixed(2)
  );

  // Regularized dynamic 12-month growth drivers (%)
  const drivers: FeatureContribution[] = [
    {
      feature: "pattern_absorption_30d",
      impactPct: Number((f.maxShrunkAbsorption30d * 95).toFixed(2)),
      explanation: `Empirical-Bayes 30d pattern absorption (${(f.maxShrunkAbsorption30d * 100).toFixed(1)}%)`,
    },
    {
      feature: "pattern_scarcity",
      impactPct: Number(((f.weightedScarcity - 0.4) * 28).toFixed(2)),
      explanation: `Pattern scarcity pressure (${(f.weightedScarcity * 100).toFixed(0)}% registered)`,
    },
    {
      feature: "cross_tld_spillover",
      impactPct: Number((f.crossTldSpillover * 16).toFixed(2)),
      explanation:
        f.crossTldSpillover > 0
          ? ".com counterpart already registered (spillover demand)"
          : "No cross-TLD spillover premium",
    },
    {
      feature: "comp_price_slope",
      impactPct: Number((clamp(f.compPriceSlope, -0.5, 1.5) * 45).toFixed(2)),
      explanation: `Comparable aftermarket price trend (${(f.compPriceSlope * 100).toFixed(1)}%)`,
    },
    {
      feature: "keyword_trend_z",
      impactPct: Number((clamp(f.trendZScore, -2, 4) * 6.5).toFixed(2)),
      explanation: `Keyword trend momentum (z=${f.trendZScore.toFixed(2)})`,
    },
    {
      feature: "renewal_drag",
      impactPct: Number((-f.renewalDragPct * 0.45).toFixed(2)),
      explanation: `5-year TCO drag ($${input.fiveYrTcoUsd.toFixed(2)} holding cost)`,
    },
  ];

  const rawGrowthPct = drivers.reduce((acc, d) => acc + d.impactPct, 0);
  const predicted12mGrowthPct = Number(clamp(rawGrowthPct, -50, 300).toFixed(2));
  const predicted12mValueUsd = Number(
    Math.max(10, estimatedFairValueUsd * (1 + predicted12mGrowthPct / 100)).toFixed(2)
  );

  // Damped 5-year compounding vs 5-year TCO
  const damped5YrValue =
    estimatedFairValueUsd *
    Math.max(0.25, 1 + predicted12mGrowthPct / 100) ** 2.2;
  const net5yrRoiMultiple = Number(
    (damped5YrValue / Math.max(1, input.fiveYrTcoUsd)).toFixed(2)
  );

  const sampleFactor = f.effectiveSampleSize / (f.effectiveSampleSize + 20);
  const freshnessDecay =
    input.snapshotAgeDays <= 7
      ? 1
      : Math.max(0.25, 1 - (input.snapshotAgeDays - 7) * 0.03);
  const confidence = Number(clamp(sampleFactor * freshnessDecay, 0, 1).toFixed(3));

  const topDrivers = [...drivers]
    .sort((a, b) => Math.abs(b.impactPct) - Math.abs(a.impactPct))
    .slice(0, 5);

  return {
    domainId: input.domainId,
    modelVersion: MODEL_VERSION,
    estimatedFairValueUsd,
    predicted12mValueUsd,
    predicted12mGrowthPct,
    fiveYrTcoUsd: Number(input.fiveYrTcoUsd.toFixed(2)),
    net5yrRoiMultiple,
    confidence,
    topDrivers,
  };
}

export async function recomputePredictionsBatch(
  db: Database,
  opts?: { chunkSize?: number; budgetMs?: number; now?: Date }
): Promise<{ scored: number; stoppedForBudget: boolean }> {
  const chunkSize = Math.max(1, Math.min(opts?.chunkSize ?? 500, 500));
  const budgetMs = opts?.budgetMs ?? 240_000;
  const startedAt = Date.now();
  const now = opts?.now ?? new Date();

  const allPatterns = await db.select().from(patterns);
  const patternMap = new Map<string, PatternMetrics>();
  for (const p of allPatterns) {
    patternMap.set(p.patternKey, {
      patternKey: p.patternKey,
      totalDomains: p.totalDomains,
      availableCount: p.availableCount,
      registeredCount: p.registeredCount,
      absorption7d: p.absorption7d,
      absorption30d: p.absorption30d,
      shrunkAbsorption30d: p.shrunkAbsorption30d,
      dropRate30d: p.dropRate30d,
      scarcityRatio: p.scarcityRatio,
      compPriceSlope: p.compPriceSlope,
      trendZScore: p.trendZScore,
      momentumScore: p.momentumScore,
    });
  }

  let scored = 0;
  let lastId = 0;
  let stoppedForBudget = false;

  while (true) {
    if (Date.now() - startedAt >= budgetMs) {
      stoppedForBudget = true;
      break;
    }

    const slice = await db
      .select()
      .from(domains)
      .where(sql`${domains.id} > ${lastId}`)
      .orderBy(domains.id)
      .limit(chunkSize);

    if (slice.length === 0) break;
    lastId = slice[slice.length - 1].id;

    const ids = slice.map((d) => d.id);
    const nonComSlds = Array.from(
      new Set(slice.filter((d) => d.tld !== ".com").map((d) => d.sld))
    );

    const [links, comMatches] = await Promise.all([
      db
        .select()
        .from(domainPatterns)
        .where(inArray(domainPatterns.domainId, ids)),
      nonComSlds.length > 0
        ? db
            .select({ sld: domains.sld })
            .from(domains)
            .where(
              sql`${domains.tld} = '.com' AND ${domains.status} = 'registered' AND ${inArray(domains.sld, nonComSlds)}`
            )
        : Promise.resolve([]),
    ]);

    const registeredComSlds = new Set(comMatches.map((m) => m.sld));
    const byDomain = new Map<number, PatternMetrics[]>();
    for (const link of links) {
      const m = patternMap.get(link.patternKey);
      if (!m) continue;
      const list = byDomain.get(link.domainId) ?? [];
      list.push(m);
      byDomain.set(link.domainId, list);
    }

    const updateTuples = [];
    const predRows = [];

    for (const d of slice) {
      const tld = d.tld as TldCode;
      const fiveYrTcoUsd =
        d.fiveYrTcoUsd ??
        calculateFiveYearTco(tld, { registrar: "cloudflare" }).fiveYrTotalUsd;
      const ageDays = d.lastCheckedAt
        ? Math.max(0, (now.getTime() - d.lastCheckedAt.getTime()) / 86_400_000)
        : 14;

      const pred = scoreDomain({
        domainId: d.id,
        fqdn: d.fqdn,
        sld: d.sld,
        tld,
        tokens: d.tokens ?? [],
        archetype: (d.archetype as PatternArchetype) || "COMPOUND_2WORD",
        hasHyphen: d.hasHyphen,
        hasDigit: d.hasDigit,
        fiveYrTcoUsd,
        comCounterpartRegistered: registeredComSlds.has(d.sld),
        snapshotAgeDays: ageDays,
        matchedPatterns: byDomain.get(d.id) ?? [],
      });

      updateTuples.push(sql`(
        ${d.id}::bigint,
        ${pred.estimatedFairValueUsd}::double precision,
        ${pred.predicted12mGrowthPct}::double precision,
        ${pred.net5yrRoiMultiple}::double precision,
        ${pred.confidence}::double precision,
        ${JSON.stringify(pred.topDrivers)}::jsonb
      )`);

      predRows.push({
        domainId: pred.domainId,
        modelVersion: pred.modelVersion,
        computedAt: now,
        estimatedFairValueUsd: pred.estimatedFairValueUsd,
        predicted12mValueUsd: pred.predicted12mValueUsd,
        predicted12mGrowthPct: pred.predicted12mGrowthPct,
        fiveYrTcoUsd: pred.fiveYrTcoUsd,
        net5yrRoiMultiple: pred.net5yrRoiMultiple,
        confidence: pred.confidence,
        topDrivers: pred.topDrivers,
      });
      scored += 1;
    }

    if (updateTuples.length > 0) {
      await db.execute(sql`
        UPDATE domains AS d
        SET
          estimated_value_usd = v.estimated_value_usd,
          predicted_12m_growth_pct = v.predicted_12m_growth_pct,
          net_5yr_roi_multiple = v.net_5yr_roi_multiple,
          confidence = v.confidence,
          top_drivers = v.top_drivers,
          updated_at = ${now.toISOString()}::timestamptz
        FROM (VALUES ${sql.join(updateTuples, sql`, `)}) AS v(
          id, estimated_value_usd, predicted_12m_growth_pct, net_5yr_roi_multiple, confidence, top_drivers
        )
        WHERE d.id = v.id
      `);
      await db.insert(valuePredictions).values(predRows);
    }
  }

  return { scored, stoppedForBudget };
}
