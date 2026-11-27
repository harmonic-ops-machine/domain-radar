import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { FeatureContribution } from "@/lib/types";

export const domains = pgTable(
  "domains",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fqdn: text("fqdn").notNull().unique(),
    sld: text("sld").notNull(),
    tld: text("tld").notNull(),
    length: integer("length").notNull(),
    hasHyphen: boolean("has_hyphen").notNull().default(false),
    hasDigit: boolean("has_digit").notNull().default(false),
    tokens: text("tokens").array().notNull().default([]),
    archetype: text("archetype").notNull().default("COMPOUND_2WORD"),
    status: text("status").notNull().default("unknown"),
    tier: text("tier").notNull().default("cold"),
    registrar: text("registrar"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastRdapAt: timestamp("last_rdap_at", { withTimezone: true }),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    consecutiveErrors: integer("consecutive_errors").notNull().default(0),
    lastError: text("last_error"),
    fiveYrTcoUsd: doublePrecision("five_yr_tco_usd"),
    estimatedValueUsd: doublePrecision("estimated_value_usd"),
    predicted12mGrowthPct: doublePrecision("predicted_12m_growth_pct"),
    net5yrRoiMultiple: doublePrecision("net_5yr_roi_multiple"),
    confidence: doublePrecision("confidence"),
    topDrivers: jsonb("top_drivers")
      .$type<FeatureContribution[]>()
      .notNull()
      .default([]),
    watched: boolean("watched").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_domains_due_claim").on(
      table.nextCheckAt,
      table.leaseUntil,
      table.tier
    ),
    index("idx_domains_growth_cursor").on(
      table.predicted12mGrowthPct,
      table.id
    ),
    index("idx_domains_status_tld").on(table.status, table.tld, table.id),
    index("idx_domains_status_tld_growth").on(
      table.status,
      table.tld,
      table.predicted12mGrowthPct,
      table.id
    ),
  ]
);

export const domainSnapshots = pgTable(
  "domain_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    domainId: bigint("domain_id", { mode: "number" })
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status").notNull(),
    registrar: text("registrar"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    source: text("source").notNull(),
    changeReason: text("change_reason").notNull(),
  },
  (table) => [
    index("idx_snapshots_domain_obs").on(table.domainId, table.observedAt),
  ]
);

export const patterns = pgTable(
  "patterns",
  {
    patternKey: text("pattern_key").primaryKey(),
    patternType: text("pattern_type").notNull(),
    tld: text("tld"),
    totalDomains: integer("total_domains").notNull().default(0),
    availableCount: integer("available_count").notNull().default(0),
    registeredCount: integer("registered_count").notNull().default(0),
    absorption7d: doublePrecision("absorption_7d").notNull().default(0),
    absorption30d: doublePrecision("absorption_30d").notNull().default(0),
    shrunkAbsorption30d: doublePrecision("shrunk_absorption_30d")
      .notNull()
      .default(0),
    dropRate30d: doublePrecision("drop_rate_30d").notNull().default(0),
    scarcityRatio: doublePrecision("scarcity_ratio").notNull().default(0),
    compPriceSlope: doublePrecision("comp_price_slope").notNull().default(0),
    trendZScore: doublePrecision("trend_z_score").notNull().default(0),
    momentumScore: doublePrecision("momentum_score").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_patterns_momentum").on(table.momentumScore)]
);

export const domainPatterns = pgTable(
  "domain_patterns",
  {
    domainId: bigint("domain_id", { mode: "number" })
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    patternKey: text("pattern_key")
      .notNull()
      .references(() => patterns.patternKey, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.domainId, table.patternKey] }),
    index("idx_domain_patterns_key").on(table.patternKey, table.domainId),
  ]
);

export const marketSignals = pgTable(
  "market_signals",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    signalType: text("signal_type").notNull(),
    key: text("key").notNull(),
    tld: text("tld"),
    numericValue: doublePrecision("numeric_value").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: text("source").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("idx_market_signals_lookup").on(
      table.signalType,
      table.key,
      table.observedAt
    ),
  ]
);

export const valuePredictions = pgTable(
  "value_predictions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    domainId: bigint("domain_id", { mode: "number" })
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    modelVersion: text("model_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    estimatedFairValueUsd: doublePrecision("estimated_fair_value_usd").notNull(),
    predicted12mValueUsd: doublePrecision("predicted_12m_value_usd").notNull(),
    predicted12mGrowthPct: doublePrecision("predicted_12m_growth_pct").notNull(),
    fiveYrTcoUsd: doublePrecision("five_yr_tco_usd").notNull(),
    net5yrRoiMultiple: doublePrecision("net_5yr_roi_multiple").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    topDrivers: jsonb("top_drivers")
      .$type<FeatureContribution[]>()
      .notNull()
      .default([]),
  },
  (table) => [
    index("idx_value_predictions_domain_time").on(
      table.domainId,
      table.computedAt
    ),
  ]
);

export const workerRuns = pgTable("worker_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobType: text("job_type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  claimedCount: integer("claimed_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  rateLimitedCount: integer("rate_limited_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  stoppedForBudget: boolean("stopped_for_budget").notNull().default(false),
  status: text("status").notNull().default("running"),
  notes: text("notes"),
});

export const tldPricing = pgTable("tld_pricing", {
  tld: text("tld").primaryKey(),
  cfY1Usd: doublePrecision("cf_y1_usd").notNull(),
  cfRenewUsd: doublePrecision("cf_renew_usd").notNull(),
  pbY1Usd: doublePrecision("pb_y1_usd").notNull(),
  pbRenewUsd: doublePrecision("pb_renew_usd").notNull(),
  ncY1Usd: doublePrecision("nc_y1_usd").notNull(),
  ncRenewUsd: doublePrecision("nc_renew_usd").notNull(),
  minBillingYears: integer("min_billing_years").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tldRateBenchmarks = pgTable(
  "tld_rate_benchmarks",
  {
    tld: text("tld").notNull(),
    registrar: text("registrar").notNull(),
    regYear1Usd: doublePrecision("reg_year1_usd").notNull(),
    renewAnnualUsd: doublePrecision("renew_annual_usd").notNull(),
    minTermYears: integer("min_term_years").notNull().default(1),
    restoreFeeUsd: doublePrecision("restore_fee_usd").notNull().default(40.0),
    verifiedAt: text("verified_at").notNull().default("2026-11-26"),
  },
  (table) => [primaryKey({ columns: [table.tld, table.registrar] })]
);

export const aiRivalryRegimes = pgTable("ai_rivalry_regimes", {
  regimeSlug: text("regime_slug").primaryKey(),
  label: text("label").notNull(),
  realityMult: doublePrecision("reality_mult").notNull(),
  justiceMult: doublePrecision("justice_mult").notNull(),
  composabilityMult: doublePrecision("composability_mult").notNull(),
  activeProbability: doublePrecision("active_probability").notNull(),
});

export const lexicalClusterSeeds = pgTable("lexical_cluster_seeds", {
  morpheme: text("morpheme").primaryKey(),
  cluster: text("cluster").notNull(),
  patternRule: text("pattern_rule").notNull(),
  priorWeight: doublePrecision("prior_weight").notNull(),
});
