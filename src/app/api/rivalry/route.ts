import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import {
  DEFAULT_RIVALRY_REGIMES,
  DEFAULT_TLD_BENCHMARKS,
  INFERENCE_RATE_BENCHMARKS,
  type RivalryRegime,
  type RivalryRegimeSlug,
  type TldRateBenchmark,
} from "@/lib/rivalry/regimes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createDb();
    const [regimeRes, rateRes, seedRes] = await Promise.all([
      db.execute(
        sql`SELECT regime_slug, label, reality_mult, justice_mult, composability_mult, active_probability FROM ai_rivalry_regimes ORDER BY active_probability DESC`
      ),
      db.execute(
        sql`SELECT tld, registrar, reg_year1_usd, renew_annual_usd, min_term_years, restore_fee_usd, verified_at FROM tld_rate_benchmarks ORDER BY tld, reg_year1_usd ASC`
      ),
      db.execute(
        sql`SELECT morpheme, cluster, pattern_rule, prior_weight FROM lexical_cluster_seeds ORDER BY cluster, prior_weight DESC`
      ),
    ]);

    const dbRegimes = (
      (regimeRes as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []
    ).map((r): RivalryRegime => {
      const slug = String(r.regime_slug) as RivalryRegimeSlug;
      const fallback = DEFAULT_RIVALRY_REGIMES.find((d) => d.slug === slug);
      return {
        slug,
        label: String(r.label),
        shortLabel: fallback?.shortLabel ?? String(r.regime_slug),
        summary: fallback?.summary ?? "",
        realityMult: Number(r.reality_mult),
        justiceMult: Number(r.justice_mult),
        composabilityMult: Number(r.composability_mult),
        activeProbability: Number(r.active_probability),
      };
    });

    const blended: RivalryRegime =
      dbRegimes.length > 0
        ? {
            slug: "expected_blended",
            label: "Probability-Weighted Expected Regime",
            shortLabel: "Blended EV",
            summary: "Live probability-weighted expectation across Neon ai_rivalry_regimes",
            realityMult: Number(
              dbRegimes
                .reduce((a, r) => a + r.realityMult * r.activeProbability, 0)
                .toFixed(2)
            ),
            justiceMult: Number(
              dbRegimes
                .reduce((a, r) => a + r.justiceMult * r.activeProbability, 0)
                .toFixed(2)
            ),
            composabilityMult: Number(
              dbRegimes
                .reduce((a, r) => a + r.composabilityMult * r.activeProbability, 0)
                .toFixed(2)
            ),
            activeProbability: 1,
          }
        : DEFAULT_RIVALRY_REGIMES[0];

    const benchmarks: TldRateBenchmark[] = (
      (rateRes as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []
    ).map((r) => ({
      tld: String(r.tld),
      registrar: String(r.registrar),
      regYear1Usd: Number(r.reg_year1_usd),
      renewAnnualUsd: Number(r.renew_annual_usd),
      minTermYears: Number(r.min_term_years),
      restoreFeeUsd: Number(r.restore_fee_usd),
      verifiedAt: String(r.verified_at).slice(0, 10),
    }));

    const lexicalSeeds = (
      (seedRes as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? []
    ).map((r) => ({
      morpheme: String(r.morpheme),
      cluster: String(r.cluster),
      patternRule: String(r.pattern_rule),
      priorWeight: Number(r.prior_weight),
    }));

    return NextResponse.json({
      source: "neon-live",
      regimes: dbRegimes.length > 0 ? [blended, ...dbRegimes] : DEFAULT_RIVALRY_REGIMES,
      benchmarks: benchmarks.length > 0 ? benchmarks : DEFAULT_TLD_BENCHMARKS,
      inferenceBenchmarks: INFERENCE_RATE_BENCHMARKS,
      lexicalSeeds,
    });
  } catch {
    return NextResponse.json({
      source: "defaults",
      regimes: DEFAULT_RIVALRY_REGIMES,
      benchmarks: DEFAULT_TLD_BENCHMARKS,
      inferenceBenchmarks: INFERENCE_RATE_BENCHMARKS,
      lexicalSeeds: [],
    });
  }
}
