import { sql } from "drizzle-orm";
import type { Database } from "@/db";
import { patterns } from "@/db/schema";

export const PRIOR_WEIGHT = 20;

export interface PatternAggregationInput {
  patternKey: string;
  patternType?: string;
  tld?: string | null;
  totalDomains: number;
  availableCount: number;
  registeredCount: number;
  newlyRegistered7d: number;
  newlyRegistered30d: number;
  dropped30d: number;
  availableStart30d: number;
  tldPriorAbsorption30d: number;
  compPriceSlope: number;
  trendZScore: number;
}

export interface PatternMetrics {
  patternKey: string;
  totalDomains: number;
  availableCount: number;
  registeredCount: number;
  absorption7d: number;
  absorption30d: number;
  shrunkAbsorption30d: number;
  dropRate30d: number;
  scarcityRatio: number;
  compPriceSlope: number;
  trendZScore: number;
  momentumScore: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computePatternMetrics(
  input: PatternAggregationInput
): PatternMetrics {
  const denom30 = Math.max(1, input.availableStart30d);
  const absorption7d = clamp(input.newlyRegistered7d / denom30, 0, 1);
  const absorption30d = clamp(input.newlyRegistered30d / denom30, 0, 1);
  const shrunkAbsorption30d = clamp(
    (input.newlyRegistered30d + PRIOR_WEIGHT * input.tldPriorAbsorption30d) /
      (input.availableStart30d + PRIOR_WEIGHT),
    0,
    1
  );

  const scarcityRatio = clamp(
    input.registeredCount / Math.max(1, input.totalDomains),
    0,
    1
  );

  const dropRate30d = clamp(
    input.dropped30d / Math.max(1, input.registeredCount + input.dropped30d),
    0,
    1
  );

  // Composite 0..100 momentum score:
  // 40% shrunk absorption velocity, 20% scarcity pressure, 20% comp-sale slope, 20% trend z-score, minus churn penalty
  const absorptionComponent = Math.min(1, shrunkAbsorption30d / 0.35) * 40;
  const scarcityComponent = scarcityRatio * 20;
  const compComponent = clamp((input.compPriceSlope + 0.1) / 0.4, 0, 1) * 20;
  const trendComponent = clamp((input.trendZScore + 1) / 4, 0, 1) * 20;
  const dropPenalty = dropRate30d * 25;

  const momentumScore = Number(
    clamp(
      absorptionComponent +
        scarcityComponent +
        compComponent +
        trendComponent -
        dropPenalty,
      0,
      100
    ).toFixed(2)
  );

  return {
    patternKey: input.patternKey,
    totalDomains: input.totalDomains,
    availableCount: input.availableCount,
    registeredCount: input.registeredCount,
    absorption7d: Number(absorption7d.toFixed(4)),
    absorption30d: Number(absorption30d.toFixed(4)),
    shrunkAbsorption30d: Number(shrunkAbsorption30d.toFixed(4)),
    dropRate30d: Number(dropRate30d.toFixed(4)),
    scarcityRatio: Number(scarcityRatio.toFixed(4)),
    compPriceSlope: Number(input.compPriceSlope.toFixed(4)),
    trendZScore: Number(input.trendZScore.toFixed(4)),
    momentumScore,
  };
}

export async function refreshAllPatternMetrics(
  db: Database,
  now: Date = new Date()
): Promise<{ patternsUpdated: number }> {
  const res = await db.execute(sql`
    WITH pat_counts AS (
      SELECT
        dp.pattern_key,
        COUNT(*)::int AS total_domains,
        COUNT(*) FILTER (WHERE d.status = 'available')::int AS available_count,
        COUNT(*) FILTER (WHERE d.status = 'registered')::int AS registered_count
      FROM domain_patterns dp
      JOIN domains d ON d.id = dp.domain_id
      GROUP BY dp.pattern_key
    ),
    snap_changes AS (
      SELECT
        dp.pattern_key,
        COUNT(*) FILTER (
          WHERE s.change_reason = 'status_change'
            AND s.status = 'registered'
            AND s.observed_at >= ${now}::timestamptz - interval '7 days'
        )::int AS newly_reg_7d,
        COUNT(*) FILTER (
          WHERE s.change_reason = 'status_change'
            AND s.status = 'registered'
            AND s.observed_at >= ${now}::timestamptz - interval '30 days'
        )::int AS newly_reg_30d,
        COUNT(*) FILTER (
          WHERE s.change_reason = 'status_change'
            AND s.status = 'available'
            AND s.observed_at >= ${now}::timestamptz - interval '30 days'
        )::int AS dropped_30d
      FROM domain_patterns dp
      JOIN domain_snapshots s ON s.domain_id = dp.domain_id
      WHERE s.observed_at >= ${now}::timestamptz - interval '30 days'
      GROUP BY dp.pattern_key
    ),
    sig_agg AS (
      SELECT
        key AS pattern_key,
        COALESCE(AVG(numeric_value) FILTER (WHERE signal_type = 'comp_sale'), 0)::float AS comp_slope,
        COALESCE(AVG(numeric_value) FILTER (WHERE signal_type = 'keyword_trend'), 0)::float AS trend_z
      FROM market_signals
      WHERE observed_at >= ${now}::timestamptz - interval '90 days'
      GROUP BY key
    )
    SELECT
      pc.pattern_key,
      pc.total_domains,
      pc.available_count,
      pc.registered_count,
      COALESCE(sc.newly_reg_7d, 0)::int AS newly_reg_7d,
      COALESCE(sc.newly_reg_30d, 0)::int AS newly_reg_30d,
      COALESCE(sc.dropped_30d, 0)::int AS dropped_30d,
      COALESCE(sa.comp_slope, 0)::float AS comp_slope,
      COALESCE(sa.trend_z, 0)::float AS trend_z
    FROM pat_counts pc
    LEFT JOIN snap_changes sc ON sc.pattern_key = pc.pattern_key
    LEFT JOIN sig_agg sa ON sa.pattern_key = pc.pattern_key
  `);

  const rows = (res as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  if (rows.length === 0) return { patternsUpdated: 0 };

  const computed = rows.map((row) => {
    const key = String(row.pattern_key);
    const availableCount = Number(row.available_count ?? 0);
    const newlyReg30d = Number(row.newly_reg_30d ?? 0);
    const metrics = computePatternMetrics({
      patternKey: key,
      totalDomains: Number(row.total_domains ?? 0),
      availableCount,
      registeredCount: Number(row.registered_count ?? 0),
      newlyRegistered7d: Number(row.newly_reg_7d ?? 0),
      newlyRegistered30d: newlyReg30d,
      dropped30d: Number(row.dropped_30d ?? 0),
      availableStart30d: availableCount + newlyReg30d,
      tldPriorAbsorption30d: 0.04,
      compPriceSlope: Number(row.comp_slope ?? 0),
      trendZScore: Number(row.trend_z ?? 0),
    });
    const parts = key.split(":");
    const patternType = parts[0] ?? "other";
    const tldPart = parts.find((p) => p.startsWith(".")) ?? null;
    return {
      patternKey: metrics.patternKey,
      patternType,
      tld: tldPart,
      totalDomains: metrics.totalDomains,
      availableCount: metrics.availableCount,
      registeredCount: metrics.registeredCount,
      absorption7d: metrics.absorption7d,
      absorption30d: metrics.absorption30d,
      shrunkAbsorption30d: metrics.shrunkAbsorption30d,
      dropRate30d: metrics.dropRate30d,
      scarcityRatio: metrics.scarcityRatio,
      compPriceSlope: metrics.compPriceSlope,
      trendZScore: metrics.trendZScore,
      momentumScore: metrics.momentumScore,
      updatedAt: now,
    };
  });

  const CHUNK = 500;
  for (let i = 0; i < computed.length; i += CHUNK) {
    const slice = computed.slice(i, i + CHUNK);
    await db
      .insert(patterns)
      .values(slice)
      .onConflictDoUpdate({
        target: patterns.patternKey,
        set: {
          totalDomains: sql`excluded.total_domains`,
          availableCount: sql`excluded.available_count`,
          registeredCount: sql`excluded.registered_count`,
          absorption7d: sql`excluded.absorption_7d`,
          absorption30d: sql`excluded.absorption_30d`,
          shrunkAbsorption30d: sql`excluded.shrunk_absorption_30d`,
          dropRate30d: sql`excluded.drop_rate_30d`,
          scarcityRatio: sql`excluded.scarcity_ratio`,
          compPriceSlope: sql`excluded.comp_price_slope`,
          trendZScore: sql`excluded.trend_z_score`,
          momentumScore: sql`excluded.momentum_score`,
          updatedAt: now,
        },
      });
  }

  return { patternsUpdated: computed.length };
}
