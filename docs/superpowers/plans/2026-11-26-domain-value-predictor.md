# Domain Radar (100k Self-Updating Pattern Tracker & Value Increase Predictor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-updating Vercel + Neon Postgres platform that continuously monitors 100,000 domains, tracks structural and semantic registration patterns, and predicts 12-month value appreciation and 5-year net ROI with explainable drivers.

**Architecture:** Next.js 15 App Router deployed on Vercel Fluid Compute (`maxDuration = 300`) backed by Neon Serverless Postgres via Drizzle ORM, using Postgres `FOR UPDATE SKIP LOCKED` lease queues instead of external brokers to drive tiered 2-stage DNS + rate-limited RDAP refresh workers. A scheduled analytics pipeline aggregates 7d/30d pattern absorption, scarcity, and comparable-sale velocity with Empirical Bayes shrinkage to produce versioned, backtestable value-increase forecasts rendered in a keyset-paginated 100k Command Center UI.

**Tech Stack:** TypeScript 5 (`strict: true`), Next.js 15 (App Router), Tailwind CSS 4, Drizzle ORM (`drizzle-orm/neon-serverless` + `drizzle-orm/node-postgres`), `@neondatabase/serverless`, `pg`, `zod`, Vitest 3, Vercel Fluid Compute & Cron/Schedules, Neon Serverless Postgres.

**Spec:** `docs/superpowers/specs/2026-11-26-domain-value-predictor-spec.md`

---

## Scope & Subsystem Map

This system spans four cleanly bounded subsystems, sequenced into 8 independently testable tasks so each milestone produces working, verifiable software (and can optionally be split into separate delivery branches if desired):

1. **Data Layer & 100k Ingestion** (Tasks 1–2): Neon/Drizzle schema, dual-driver factory, 5-year TCO pricing engine, and 500-row chunked 100k bulk seeder.
2. **Self-Updating Probe Engine** (Tasks 3–4): Polite 2-stage DNS pre-filter + per-registry circuit-broken RDAP client, plus lease-locked `SKIP LOCKED` tiered scheduler with 240s Fluid Compute time guard.
3. **Pattern Tracker & Value Increase Predictor** (Tasks 5–6): Morpheme/archetype pattern extractor, Empirical-Bayes-shrunk velocity tracker, explainable ridge-weighted value predictor, and historical backtester.
4. **Vercel Cron APIs & 100k Command Center UI** (Tasks 7–8): Constant-time `CRON_SECRET` protected cron/import routes, O(log N) keyset-paginated APIs, `vercel.json`, and Next.js dashboard/explorer/simulator UI.

---

## Global Constraints

- **Runtime & Framework:** Node.js `>=22.0.0`, Next.js `15.x` App Router (TypeScript `strict: true`), Vitest `3.x` for unit/integration tests.
- **Database & ORM:** Neon Serverless Postgres with Drizzle ORM (`drizzle-orm/neon-serverless` WebSocket pool for transactions/`SKIP LOCKED` in production, `drizzle-orm/node-postgres` for migrations, seeds, and local tests).
- **Scale Target:** `100,000` active tracked domains in Neon Postgres with zero full-table scans on user queries (`O(log N)` keyset cursor pagination) and chunked bulk writes (`500` rows/batch, strictly `< 10,000` bind parameters per query).
- **Vercel Execution Budget:** Every cron/worker route declares `export const maxDuration = 300` (Fluid Compute Hobby-safe ceiling; Pro supports `800`) and enforces a hard internal cutoff at `240_000 ms` (`240s`), leaving `60s` margin to commit telemetry and never trigger `504 FUNCTION_INVOCATION_TIMEOUT`.
- **Two-Stage Polite Probing:** Never classify a domain `available` from DNS alone or from HTTP `429`/`5xx`/timeouts. Only an authoritative RDAP `404` marks `status = "available"`; errors preserve previous `status` and apply exponential backoff (`min(24h, 5m * 2^errors)`).
- **Zero Extra Infrastructure:** No Redis, Kafka, or separate VPS required; work queues use Postgres `FOR UPDATE SKIP LOCKED` with a `6-minute` lease (`lease_until`) that auto-reclaims crashed workers.
- **Security:** All `/api/cron/*` and `/api/signals/import` routes require `Authorization: Bearer <CRON_SECRET>` validated via `crypto.timingSafeEqual`; unauthorized calls return `401`.
- **Supported TLDs (v1):** `.com`, `.net`, `.org`, `.ai`, `.io`, `.co`, `.app`, `.dev`.
- **Pricing & 5-Year Horizon:** TCO model incorporates Nov 2026 baseline rates (ICANN `$0.20/yr` included), configurable annual renewal inflation (default `3.0%`), and `.ai` 2-year minimum billing cadence.
- **Explainable Predictions:** Every prediction stores `model_version`, Empirical-Bayes-shrunk pattern velocity (`priorWeight = 20`), clamped `predicted_12m_growth_pct` in `[-50, +300]`, calibrated `confidence` in `[0, 1]`, and ordered `top_drivers` JSONB.

---

## Review Focus

1. **Stale/crashed worker leases stranding domain shards:** A Vercel worker crashing after claiming rows must never strand them permanently; `claimNextBatch()` must reclaim rows where `lease_until < NOW()` using `FOR UPDATE SKIP LOCKED` and stop before `240s` elapsed. *(Pinned in Task 4.)*
2. **RDAP `429`/timeout cascades or DNS `SERVFAIL` corrupting availability:** Transient DNS or RDAP `429`/`503` errors must never mark a registered domain `available`; they must trip a per-registry circuit breaker, keep prior `status`, and back off without inserting fake change snapshots. *(Pinned in Task 3.)*
3. **Neon Postgres 65,535 bind-parameter crash & dirty FQDN imports at 100k scale:** Bulk upserting >5,000 rows in one query fails on Postgres; `bulkUpsertDomains()` must chunk into `500`-row batches, lowercase/deduplicate FQDNs, and reject invalid/unsupported TLDs cleanly. *(Pinned in Task 2.)*
4. **Small-sample patterns (`n < 5`) exploding Value Increase Predictor growth:** A pattern with 1/2 registrations must not predict `+400%` growth; Empirical Bayes shrinkage (`priorWeight = 20`), growth clamping `[-50, +300]`, and smooth confidence decay must suppress noise. *(Pinned in Task 5 & Task 6.)*
5. **Offset-pagination full-table scans on 100k rows & unauthenticated Cron abuse:** `/api/domains` must use keyset cursor `(sortValue, id)` pagination rather than `OFFSET`, and `/api/cron/*` must reject invalid/missing Bearer tokens in constant time with HTTP `401`. *(Pinned in Task 7.)*

---

## File Structure

All paths below are rooted at `/home/antigravity/domain-radar/`:

```text
domain-radar/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── drizzle.config.ts
├── vercel.json
├── .env.example
├── src/
│   ├── db/
│   │   ├── schema.ts                  # 8 Drizzle tables + composite indexes
│   │   ├── index.ts                   # Dual-driver Neon/pg DB factory
│   │   └── migrations/                # Generated Drizzle SQL migrations
│   ├── lib/
│   │   ├── types.ts                   # Shared canonical domain/pattern/prediction types
│   │   ├── domains/
│   │   │   ├── normalize.ts           # FQDN sanitizer, TLD validator, structural flags
│   │   │   └── bulk-upsert.ts         # 500-row chunked ON CONFLICT upsert
│   │   ├── pricing/
│   │   │   └── tco.ts                 # Nov 2026 baseline TLD prices & 5-yr TCO calculator
│   │   ├── prober/
│   │   │   ├── dns.ts                 # Stage-1 DNS NS/SOA pre-filter
│   │   │   ├── rdap.ts                # Stage-2 RDAP client + per-host limiter/breaker
│   │   │   └── probe-domain.ts        # 2-stage orchestrator (strict 404-only available)
│   │   ├── worker/
│   │   │   ├── scheduler.ts           # Tiered cadence (6h/24h/72h) & error backoff
│   │   │   └── claim-and-process.ts   # SKIP LOCKED batch claimer, 240s guard, diff snapshots
│   │   ├── patterns/
│   │   │   ├── extract.ts             # Word tokenizer, archetype classifier, pattern keys
│   │   │   └── tracker.ts             # 7d/30d absorption, EB shrinkage, momentum index
│   │   ├── predictor/
│   │   │   ├── features.ts            # Intrinsic + pattern + spillover + renewal-drag vector
│   │   │   ├── model.ts               # Versioned explainable value-increase scorer
│   │   │   └── backtest.ts            # MAPE & Precision@K historical evaluator
│   │   └── auth/
│   │       └── cron.ts                # Constant-time CRON_SECRET Bearer verifier
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Command Center Overview (KPIs + Radar + Top Picks)
│   │   └── api/
│   │       ├── cron/probe/route.ts    # Fluid Compute 300s self-updating probe tick
│   │       ├── cron/patterns/route.ts # Fluid Compute 300s pattern & predictor refresh
│   │       ├── domains/
│   │       │   ├── query.ts           # Keyset cursor encoder & Drizzle where-clause builder
│   │       │   └── route.ts           # Keyset-paginated 100k domain search/filter API
│   │       ├── patterns/route.ts      # Pattern velocity leaderboard API
│   │       └── signals/import/route.ts# Auth-protected comp-sale & trend signal ingest
│   └── components/
│       ├── DomainExplorer.tsx         # Filterable keyset-paginated 100k explorer + drivers
│       ├── PatternRadar.tsx           # Breakout pattern absorption & scarcity panel
│       └── PortfolioSimulator.tsx     # 5-Yr TCO vs. predicted ROI simulator + CSV export
├── scripts/
│   └── seed-100k.ts                   # Generates & imports 100,000 domains via unpooled URL
└── tests/
    ├── db/schema.test.ts
    ├── domains/normalize-and-bulk.test.ts
    ├── pricing/tco.test.ts
    ├── prober/probe-domain.test.ts
    ├── worker/claim-and-process.test.ts
    ├── patterns/extract-and-track.test.ts
    ├── predictor/model-and-backtest.test.ts
    ├── api/routes.test.ts
    └── ui/command-center.test.tsx
```

---

### Task 1: Project Scaffold, Dual-Driver Neon/Postgres Setup & Drizzle Schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `drizzle.config.ts`, `.env.example`
- Create: `src/lib/types.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: none (foundational task)
- Produces:
  - `DomainStatus = "available" | "registered" | "grace" | "redemption" | "unknown"`
  - `RefreshTier = "hot" | "warm" | "cold"`
  - `TldCode = ".com" | ".net" | ".org" | ".ai" | ".io" | ".co" | ".app" | ".dev"`
  - `createDb(options?: { url?: string; driver?: "neon" | "pg" }): Database` in `src/db/index.ts`
  - Drizzle tables: `domains`, `domainSnapshots`, `patterns`, `domainPatterns`, `marketSignals`, `valuePredictions`, `workerRuns`, `tldPricing` in `src/db/schema.ts`

- [ ] **Step 1: Initialize project config and dependencies**

Create `package.json` (Next.js 15, React 19, TypeScript 5, Tailwind CSS 4, `drizzle-orm`, `@neondatabase/serverless`, `pg`, `zod`, devDeps `drizzle-kit`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `tsx`, `@types/pg`), `tsconfig.json` (`strict: true`, path alias `@/* -> ./src/*`), `vitest.config.ts` (configuring `@vitejs/plugin-react`, `@/*` alias, and `environmentMatchGlobs: [["tests/ui/**", "jsdom"]]`), `drizzle.config.ts` (pointing `dbCredentials.url` to `process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL`), and `.env.example` (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, plus Hobby vs Pro cron cadence notes). Run `npm install`.

- [ ] **Step 2: Write the failing schema and driver-factory test**

```ts
// tests/db/schema.test.ts
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  domains,
  domainSnapshots,
  patterns,
  domainPatterns,
  marketSignals,
  valuePredictions,
  workerRuns,
  tldPricing,
} from "@/db/schema";
import { resolveDriver } from "@/db/index";

describe("Drizzle schema & dual-driver factory", () => {
  it("defines all 8 core tables with required composite indexes", () => {
    const domainCfg = getTableConfig(domains);
    const indexNames = domainCfg.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_domains_due_claim");
    expect(indexNames).toContain("idx_domains_growth_cursor");
    expect(indexNames).toContain("idx_domains_status_tld");

    const snapCfg = getTableConfig(domainSnapshots);
    expect(snapCfg.indexes.map((i) => i.config.name)).toContain("idx_snapshots_domain_obs");

    expect(getTableConfig(patterns).name).toBe("patterns");
    expect(getTableConfig(domainPatterns).name).toBe("domain_patterns");
    expect(getTableConfig(marketSignals).name).toBe("market_signals");
    expect(getTableConfig(valuePredictions).name).toBe("value_predictions");
    expect(getTableConfig(workerRuns).name).toBe("worker_runs");
    expect(getTableConfig(tldPricing).name).toBe("tld_pricing");
  });

  it("selects neon driver for neon.tech URLs and pg driver for localhost", () => {
    expect(resolveDriver("postgres://user:pw@ep-cool-pooler.us-east-2.aws.neon.tech/neondb")).toBe("neon");
    expect(resolveDriver("postgresql://postgres:postgres@localhost:5432/domain_radar")).toBe("pg");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL with module not found for `@/db/schema` and `@/db/index`.

- [ ] **Step 4: Implement `src/lib/types.ts`, `src/db/schema.ts`, and `src/db/index.ts`**

- `src/lib/types.ts`: export `SUPPORTED_TLDS`, `DomainStatus`, `RefreshTier`, `TldCode`, `PatternArchetype`, `FeatureContribution`, `DomainCursor`.
- `src/db/schema.ts`: define the 8 PostgreSQL tables:
  - `domains`: `id` (`bigserial` PK), `fqdn` (`text` unique notNull), `sld`, `tld`, `length`, `hasHyphen`, `hasDigit`, `tokens` (`text[]`), `archetype`, `status` (default `"unknown"`), `tier` (default `"cold"`), `registrar`, `expiresAt`, `lastCheckedAt`, `lastRdapAt`, `nextCheckAt`, `leaseUntil`, `consecutiveErrors` (default `0`), `lastError`, `fiveYrTcoUsd` (`doublePrecision`), `estimatedValueUsd`, `predicted12mGrowthPct`, `net5yrRoiMultiple`, `confidence`, `watched` (`boolean` default `false`), `createdAt`, `updatedAt`. Indexes: `idx_domains_due_claim (nextCheckAt, leaseUntil, tier)`, `idx_domains_growth_cursor (predicted12mGrowthPct, id)`, `idx_domains_status_tld (status, tld, id)`.
  - `domainSnapshots`: `id`, `domainId` (FK -> `domains.id` cascade), `observedAt`, `status`, `registrar`, `expiresAt`, `source`, `changeReason`. Index `idx_snapshots_domain_obs (domainId, observedAt)`.
  - `patterns`: `patternKey` (PK), `patternType`, `tld`, `totalDomains`, `availableCount`, `registeredCount`, `absorption7d`, `absorption30d`, `shrunkAbsorption30d`, `dropRate30d`, `scarcityRatio`, `compPriceSlope`, `trendZScore`, `momentumScore`, `updatedAt`. Index `idx_patterns_momentum (momentumScore)`.
  - `domainPatterns`: composite PK `(domainId, patternKey)` with FKs to `domains` and `patterns`, plus index on `(patternKey, domainId)`.
  - `marketSignals`: `id`, `signalType` (`"comp_sale" | "keyword_trend" | "registry_price"`), `key`, `tld`, `numericValue`, `observedAt`, `source`, `metadata` (`jsonb`).
  - `valuePredictions`: `id`, `domainId` (FK), `modelVersion`, `computedAt`, `estimatedFairValueUsd`, `predicted12mValueUsd`, `predicted12mGrowthPct`, `fiveYrTcoUsd`, `net5yrRoiMultiple`, `confidence`, `topDrivers` (`jsonb`). Index `(domainId, computedAt)`.
  - `workerRuns`: `id` (`uuid` PK), `jobType`, `startedAt`, `finishedAt`, `claimedCount`, `updatedCount`, `changedCount`, `rateLimitedCount`, `errorCount`, `stoppedForBudget`, `status`, `notes`.
  - `tldPricing`: `tld` (PK), `cfY1Usd`, `cfRenewUsd`, `pbY1Usd`, `pbRenewUsd`, `ncY1Usd`, `ncRenewUsd`, `minBillingYears` (default `1`, `2` for `.ai`), `updatedAt`.
- `src/db/index.ts`: export `resolveDriver(url: string): "neon" | "pg"` and `createDb(...)` switching cleanly between `drizzle-orm/neon-serverless` (`Pool`) and `drizzle-orm/node-postgres` (`Pool`) without instantiating sockets during build-time import.

- [ ] **Step 5: Run test and generate initial Drizzle migration**

Run: `npx vitest run tests/db/schema.test.ts && npx drizzle-kit generate`
Expected: PASS (2/2 tests) and migration SQL created in `src/db/migrations/`.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts drizzle.config.ts .env.example src/lib/types.ts src/db/ tests/db/schema.test.ts
git commit -m "feat: scaffold Next.js + Drizzle Neon schema for 100k domain radar"
```

---

### Task 2: Domain Normalizer, 5-Year TCO Calculator & 100k Chunked Bulk Upsert Engine

**Files:**
- Create: `src/lib/domains/normalize.ts`
- Create: `src/lib/pricing/tco.ts`
- Create: `src/lib/domains/bulk-upsert.ts`
- Create: `scripts/seed-100k.ts`
- Test: `tests/domains/normalize-and-bulk.test.ts`
- Test: `tests/pricing/tco.test.ts`

**Interfaces:**
- Consumes: `domains`, `tldPricing` from `src/db/schema.ts`; `TldCode`, `SUPPORTED_TLDS` from `src/lib/types.ts`
- Produces:
  - `normalizeDomain(raw: string): NormalizedDomain | null` in `src/lib/domains/normalize.ts`
  - `DEFAULT_TLD_PRICING: Record<TldCode, TldPricingRow>` and `calculateFiveYearTco(tld: TldCode, opts?: { registrar?: "cloudflare" | "porkbun" | "namecheap" | "optimal"; annualInflation?: number; pricingTable?: Record<TldCode, TldPricingRow> }): { year1Usd: number; renewals4YrUsd: number; fiveYrTotalUsd: number; minBillingYears: number; registrar: string }` in `src/lib/pricing/tco.ts`
  - `bulkUpsertDomains(db: Database, rawDomains: string[], opts?: { chunkSize?: number; tier?: RefreshTier; watched?: boolean }): Promise<BulkUpsertResult>` in `src/lib/domains/bulk-upsert.ts`

- [ ] **Step 1: Write failing tests for normalization, 5-year TCO, and 500-row chunked bulk upsert (Review Focus #3)**

```ts
// tests/pricing/tco.test.ts
import { describe, expect, it } from "vitest";
import { calculateFiveYearTco } from "@/lib/pricing/tco";

describe("5-year TCO calculator", () => {
  it("matches Nov 2026 Cloudflare .com 5-yr cost at 3% annual renewal inflation", () => {
    const res = calculateFiveYearTco(".com", { registrar: "cloudflare", annualInflation: 0.03 });
    expect(res.year1Usd).toBeCloseTo(11.17, 2);
    expect(res.fiveYrTotalUsd).toBeCloseTo(59.30, 2);
  });

  it("accounts for .ai 2-year minimum billing cadence when requested in cashflow mode", () => {
    const annualized = calculateFiveYearTco(".ai", { registrar: "cloudflare", annualInflation: 0.03 });
    expect(annualized.fiveYrTotalUsd).toBeCloseTo(424.73, 2);
    expect(annualized.minBillingYears).toBe(2);
  });

  it("picks cheapest registrar per TLD for optimal mode", () => {
    const ioOpt = calculateFiveYearTco(".io", { registrar: "optimal", annualInflation: 0.03 });
    expect(ioOpt.fiveYrTotalUsd).toBeLessThan(
      calculateFiveYearTco(".io", { registrar: "cloudflare", annualInflation: 0.03 }).fiveYrTotalUsd
    );
  });
});
```

```ts
// tests/domains/normalize-and-bulk.test.ts
import { describe, expect, it, vi } from "vitest";
import { normalizeDomain } from "@/lib/domains/normalize";
import { bulkUpsertDomains, MAX_CHUNK_SIZE } from "@/lib/domains/bulk-upsert";

describe("domain normalization & 100k chunked bulk upsert", () => {
  it("normalizes casing/whitespace and rejects invalid or unsupported TLDs", () => {
    expect(normalizeDomain("  TruthLedger.AI. ")).toEqual({
      fqdn: "truthledger.ai",
      sld: "truthledger",
      tld: ".ai",
      length: 11,
      hasHyphen: false,
      hasDigit: false,
    });
    expect(normalizeDomain("-bad-.com")).toBeNull();
    expect(normalizeDomain("foo.unsupportedtld")).toBeNull();
    expect(normalizeDomain("sub.domain.com")).toBeNull();
  });

  it("splits 2,350 domains into 500-row chunks and deduplicates before DB writes", async () => {
    const insertedChunks: number[] = [];
    const fakeDb = {
      insert: vi.fn(() => ({
        values: vi.fn((rows: unknown[]) => {
          insertedChunks.push(rows.length);
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
        }),
      })),
    };
    const raw = [
      ...Array.from({ length: 2350 }, (_, i) => `truthnode${i}.com`),
      "TRUTHNODE0.COM", // duplicate
      "invalid..com",   // invalid
    ];
    const result = await bulkUpsertDomains(fakeDb as never, raw, { chunkSize: MAX_CHUNK_SIZE });
    expect(MAX_CHUNK_SIZE).toBe(500);
    expect(insertedChunks).toEqual([500, 500, 500, 500, 350]);
    expect(result).toEqual({ accepted: 2350, duplicatesRemoved: 1, invalidRejected: 1, chunksWritten: 5 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pricing/tco.test.ts tests/domains/normalize-and-bulk.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/pricing/tco.ts`, `src/lib/domains/normalize.ts`, `src/lib/domains/bulk-upsert.ts`, and `scripts/seed-100k.ts`**

- `src/lib/pricing/tco.ts`: seed `DEFAULT_TLD_PRICING` with exact Nov 2026 rates (`.com` CF `$11.17/$11.17`, PB `$11.81/$11.81`, NC `$12.28/$20.18`; `.org` CF `$10.11/$10.11`, PB `$7.98/$11.84`, NC `$7.44/$15.18`; `.ai` CF `$80/$80`, PB `$82.70/$82.70`, NC `$89.98/$114.98`, `minBillingYears: 2`; `.io` CF `$50/$50`, PB `$28.12/$51.80`, NC `$29.98/$64.98`; `.app` CF `$14/$14`, PB `$8.75/$14.93`, NC `$7.48/$19.98`; `.dev` CF `$12/$12`, PB `$8.75/$12.87`, NC `$7.48/$17.98`; `.net` CF `$11.84/$11.84`, PB `$12.52/$12.52`, NC `$13.18/$17.18`; `.co` CF `$26.50/$26.50`, PB `$15.76/$31.20`, NC `$16.98/$34.98`). Compute `renewals4YrUsd = renew * sum_{k=1..4}(1 + annualInflation)^k` and pick `MIN` Y1 + `MIN` renew for `"optimal"`.
- `src/lib/domains/normalize.ts`: strip trailing dot/whitespace, lowercase, enforce 2-label domain (`sld.tld`), validate RFC 1035 label regex `/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/`, verify `.tld` is in `SUPPORTED_TLDS`.
- `src/lib/domains/bulk-upsert.ts`: export `MAX_CHUNK_SIZE = 500`, deduplicate by `fqdn`, populate default `fiveYrTcoUsd` via `calculateFiveYearTco(tld, { registrar: "cloudflare" })`, upsert via `INSERT ... ON CONFLICT (fqdn) DO UPDATE` in chunks of `Math.min(chunkSize, MAX_CHUNK_SIZE)`.
- `scripts/seed-100k.ts`: CLI script reading `DATABASE_URL_UNPOOLED` that seeds `tld_pricing`, loads the 100 verified `truth`/`real` domains as `tier: "hot", watched: true`, and deterministically generates 99,900 additional domains across high-signal keyword/morpheme stems × suffixes × supported TLDs (totaling exactly `100,000` unique FQDNs) in 500-row batches with progress telemetry.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pricing/tco.test.ts tests/domains/normalize-and-bulk.test.ts`
Expected: PASS (5/5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing/tco.ts src/lib/domains/ scripts/seed-100k.ts tests/pricing/ tests/domains/
git commit -m "feat: add domain normalizer, 5-yr TCO pricing, and 100k chunked bulk upsert"
```

---

### Task 3: Two-Stage Self-Updating Probe Engine (DNS Pre-Filter + Rate-Limited Authoritative RDAP)

**Files:**
- Create: `src/lib/prober/dns.ts`
- Create: `src/lib/prober/rdap.ts`
- Create: `src/lib/prober/probe-domain.ts`
- Test: `tests/prober/probe-domain.test.ts`

**Interfaces:**
- Consumes: `DomainStatus`, `TldCode` from `src/lib/types.ts`
- Produces:
  - `checkDnsDelegation(fqdn: string, resolver?: DnsResolver): Promise<DnsCheckResult>` in `src/lib/prober/dns.ts`
  - `RDAP_ENDPOINTS: Record<TldCode, string>`, `RegistryRateGuard`, and `queryRdap(fqdn: string, tld: TldCode, opts: { fetchFn?: typeof fetch; guard: RegistryRateGuard; timeoutMs?: number }): Promise<RdapCheckResult>` in `src/lib/prober/rdap.ts`
  - `probeDomain(input: ProbeInput, deps: ProbeDeps): Promise<ProbeOutcome>` in `src/lib/prober/probe-domain.ts`

- [ ] **Step 1: Write failing tests covering 2-stage probing, strict 404-only availability, and 429 circuit breaker (Review Focus #2)**

```ts
// tests/prober/probe-domain.test.ts
import { describe, expect, it, vi } from "vitest";
import { probeDomain } from "@/lib/prober/probe-domain";
import { RegistryRateGuard } from "@/lib/prober/rdap";

describe("2-stage DNS + authoritative RDAP prober", () => {
  it("skips RDAP when DNS NS exists and cached RDAP is fresh (< 7 days)", async () => {
    const fetchFn = vi.fn();
    const out = await probeDomain(
      { fqdn: "example.com", tld: ".com", previousStatus: "registered", lastRdapAt: new Date() },
      { dnsResolveNs: async () => ["ns1.example.com"], fetchFn, guard: new RegistryRateGuard() }
    );
    expect(out.status).toBe("registered");
    expect(out.source).toBe("dns_cached");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("marks available ONLY on authoritative RDAP 404 when DNS returns NXDOMAIN", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const out = await probeDomain(
      { fqdn: "truthcipher.com", tld: ".com", previousStatus: "unknown", lastRdapAt: null },
      {
        dnsResolveNs: async () => {
          const err = Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
          throw err;
        },
        fetchFn,
        guard: new RegistryRateGuard(),
      }
    );
    expect(out.status).toBe("available");
    expect(out.changed).toBe(true);
    expect(out.source).toBe("rdap");
  });

  it("preserves prior status and opens per-registry circuit breaker on HTTP 429 or DNS SERVFAIL", async () => {
    const guard = new RegistryRateGuard({ defaultCooldownMs: 60_000 });
    const fetch429 = vi.fn().mockResolvedValue(
      new Response("rate limited", { status: 429, headers: { "Retry-After": "90" } })
    );
    const first = await probeDomain(
      { fqdn: "truthreal.ai", tld: ".ai", previousStatus: "registered", lastRdapAt: null },
      { dnsResolveNs: async () => { throw Object.assign(new Error("ENODATA"), { code: "ENODATA" }); }, fetchFn: fetch429, guard }
    );
    expect(first.status).toBe("registered");
    expect(first.changed).toBe(false);
    expect(first.source).toBe("error_preserved");
    expect(first.retryAfterSeconds).toBe(90);

    // Second call to same .ai registry during cooldown is short-circuited without calling fetch
    const second = await probeDomain(
      { fqdn: "realledger.ai", tld: ".ai", previousStatus: "available", lastRdapAt: null },
      { dnsResolveNs: async () => { throw Object.assign(new Error("ENODATA"), { code: "ENODATA" }); }, fetchFn: fetch429, guard }
    );
    expect(second.status).toBe("available");
    expect(second.errorCode).toBe("CIRCUIT_OPEN");
    expect(fetch429).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/prober/probe-domain.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/prober/dns.ts`, `src/lib/prober/rdap.ts`, and `src/lib/prober/probe-domain.ts`**

- `src/lib/prober/dns.ts`: wraps `dns.promises.resolveNs` with a `2,000 ms` abort timeout; maps `ENOTFOUND`/`ENODATA` -> `{ delegated: false, transientError: false }`, non-empty NS array -> `{ delegated: true, transientError: false }`, and `SERVFAIL`/`ETIMEOUT`/other -> `{ delegated: false, transientError: true }`.
- `src/lib/prober/rdap.ts`: defines `RDAP_ENDPOINTS` for all 8 TLDs (`.com`/`.net` -> `rdap.verisign.com`, `.org` -> `rdap.publicinterestregistry.org`, `.ai`/`.io` -> `rdap.identitydigital.services`, `.co` -> `rdap.registry.co`, `.app`/`.dev` -> `pubapi.registry.google`). Implements `RegistryRateGuard` tracking in-flight count per host (`maxConcurrentPerHost = 4`) and per-host `cooldownUntil` timestamp triggered on `429`/`503`. Parses RDAP JSON `events` (`expiration`), `entities` (`registrar` vCard `fn`), and EPP `status` (`redemptionPeriod` -> `"redemption"`, `autoRenewPeriod`/`renewPeriod` -> `"grace"`).
- `src/lib/prober/probe-domain.ts`: executes Stage 1 DNS; if `delegated && previousStatus === "registered"` and `lastRdapAt` is within `7 days`, returns `dns_cached` without calling RDAP; if DNS had `transientError`, preserves `previousStatus` (`error_preserved`); otherwise invokes Stage 2 `queryRdap`. Only HTTP `404` maps to `"available"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/prober/probe-domain.test.ts`
Expected: PASS (3/3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prober/ tests/prober/probe-domain.test.ts
git commit -m "feat: add 2-stage DNS + circuit-broken RDAP domain prober"
```

---

### Task 4: Lease-Locked Self-Updating Worker & Tiered Refresh Scheduler (`FOR UPDATE SKIP LOCKED`)

**Files:**
- Create: `src/lib/worker/scheduler.ts`
- Create: `src/lib/worker/claim-and-process.ts`
- Test: `tests/worker/claim-and-process.test.ts`

**Interfaces:**
- Consumes: `domains`, `domainSnapshots`, `workerRuns` from `src/db/schema.ts`; `probeDomain`, `RegistryRateGuard` from `src/lib/prober/*`
- Produces:
  - `computeNextCheckAt(input: { tier: RefreshTier; consecutiveErrors: number; retryAfterSeconds?: number | null; now?: Date }): Date` and `computeRefreshTier(input: { watched: boolean; changed: boolean; predicted12mGrowthPct: number | null; rankHint?: number }): RefreshTier` in `src/lib/worker/scheduler.ts`
  - `buildClaimBatchSql(limit: number, leaseMs: number): string`, `claimNextBatch(db: Database, limit: number, leaseMs?: number): Promise<ClaimedDomain[]>`, and `processWorkerTick(db: Database, opts?: WorkerTickOptions): Promise<WorkerTickResult>` in `src/lib/worker/claim-and-process.ts`

- [ ] **Step 1: Write failing tests for tiered cadence, exponential backoff, stale-lease reclamation, and 240s budget cutoff (Review Focus #1)**

```ts
// tests/worker/claim-and-process.test.ts
import { describe, expect, it, vi } from "vitest";
import { computeNextCheckAt, computeRefreshTier } from "@/lib/worker/scheduler";
import { buildClaimBatchSql, processWorkerTick } from "@/lib/worker/claim-and-process";

describe("tiered scheduler & lease-locked worker", () => {
  it("generates atomic SKIP LOCKED claim SQL that reclaims expired leases", () => {
    const sqlText = buildClaimBatchSql(40, 360_000);
    expect(sqlText).toContain("lease_until IS NULL OR lease_until < NOW()");
    expect(sqlText).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("computes 6h/24h/72h tiered cadences and exponential error backoff capped at 24h", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(computeNextCheckAt({ tier: "hot", consecutiveErrors: 0, now }).toISOString()).toBe("2026-11-26T18:00:00.000Z");
    expect(computeNextCheckAt({ tier: "warm", consecutiveErrors: 0, now }).toISOString()).toBe("2026-11-27T12:00:00.000Z");
    expect(computeNextCheckAt({ tier: "cold", consecutiveErrors: 0, now }).toISOString()).toBe("2026-11-29T12:00:00.000Z");
    expect(computeNextCheckAt({ tier: "hot", consecutiveErrors: 1, now }).toISOString()).toBe("2026-11-26T12:10:00.000Z");
    expect(computeNextCheckAt({ tier: "hot", consecutiveErrors: 20, now }).toISOString()).toBe("2026-11-27T12:00:00.000Z");
    expect(computeRefreshTier({ watched: false, changed: true, predicted12mGrowthPct: 5 })).toBe("hot");
  });

  it("stops cleanly before the 240s Fluid Compute time budget and writes diff-only snapshots", async () => {
    let fakeNow = 1_000_000;
    const snapshotsWritten: unknown[] = [];
    const claimBatch = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 1, fqdn: "truthcipher.com", tld: ".com", status: "available", tier: "hot", consecutiveErrors: 0, lastRdapAt: null },
        { id: 2, fqdn: "truthslate.com", tld: ".com", status: "available", tier: "hot", consecutiveErrors: 0, lastRdapAt: null },
      ])
      .mockResolvedValueOnce([
        { id: 3, fqdn: "truthcrest.com", tld: ".com", status: "available", tier: "hot", consecutiveErrors: 0, lastRdapAt: null },
      ]);

    const probeFn = vi.fn(async (d) => {
      fakeNow += 130_000; // pushes elapsed past 240_000 ms budget after batch 1
      return {
        fqdn: d.fqdn,
        status: d.id === 1 ? "registered" : "available",
        previousStatus: d.status,
        changed: d.id === 1,
        source: "rdap",
        registrar: d.id === 1 ? "Cloudflare" : null,
        expiresAt: null,
        httpStatus: d.id === 1 ? 200 : 404,
        errorCode: null,
        retryAfterSeconds: null,
      };
    });

    const result = await processWorkerTick({} as never, {
      budgetMs: 240_000,
      batchSize: 2,
      nowFn: () => fakeNow,
      claimBatchFn: claimBatch,
      probeFn: probeFn as never,
      commitBatchFn: async (outcomes) => {
        snapshotsWritten.push(...outcomes.filter((o) => o.changed));
      },
      recordRunFn: vi.fn().mockResolvedValue("run-uuid-1"),
    });

    expect(result.claimed).toBe(2);
    expect(result.changed).toBe(1);
    expect(result.stoppedForBudget).toBe(true);
    expect(claimBatch).toHaveBeenCalledTimes(1); // did NOT start second batch after budget expired
    expect(snapshotsWritten).toHaveLength(1); // diff-only snapshot
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/worker/claim-and-process.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/worker/scheduler.ts` and `src/lib/worker/claim-and-process.ts`**

- `src/lib/worker/scheduler.ts`: exact constants `TIER_INTERVAL_MS = { hot: 6h, warm: 24h, cold: 72h }`, backoff `Math.min(24h, 5m * 2 ** consecutiveErrors)` (honoring `retryAfterSeconds` if larger), and tier promotion (`watched || changed || growth >= 25` -> `"hot"`, `growth >= 10` -> `"warm"`, else `"cold"`).
- `src/lib/worker/claim-and-process.ts`:
  - `claimNextBatch(db, limit, leaseMs = 360_000)` executes atomic CTE SQL:
    ```sql
    WITH due AS (
      SELECT id FROM domains
      WHERE next_check_at <= NOW()
        AND (lease_until IS NULL OR lease_until < NOW())
      ORDER BY CASE tier WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 ELSE 2 END, next_check_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE domains d
    SET lease_until = NOW() + ($2 || ' milliseconds')::interval
    FROM due WHERE d.id = due.id
    RETURNING d.id, d.fqdn, d.tld, d.status, d.tier, d.consecutive_errors, d.last_rdap_at;
    ```
  - `processWorkerTick` loops claiming sub-batches (`batchSize = 40`), running probes concurrently through a shared `RegistryRateGuard`, committing domain updates + diff-only `domain_snapshots` (plus 7-day heartbeat snapshots) and clearing `lease_until = NULL`, stopping cleanly once `nowFn() - startedAt >= budgetMs` (default `240_000`), and writing a summary row into `worker_runs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/worker/claim-and-process.test.ts`
Expected: PASS (3/3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/worker/ tests/worker/claim-and-process.test.ts
git commit -m "feat: add SKIP LOCKED lease worker and tiered refresh scheduler"
```

---

### Task 5: Pattern Extraction Engine & Rolling Velocity/Saturation Tracker

**Files:**
- Create: `src/lib/patterns/extract.ts`
- Create: `src/lib/patterns/tracker.ts`
- Test: `tests/patterns/extract-and-track.test.ts`

**Interfaces:**
- Consumes: `domains`, `domainSnapshots`, `patterns`, `domainPatterns`, `marketSignals` from `src/db/schema.ts`; `TldCode`, `PatternArchetype` from `src/lib/types.ts`
- Produces:
  - `extractDomainPatterns(sld: string, tld: TldCode): ExtractedPatterns` in `src/lib/patterns/extract.ts`
  - `computePatternMetrics(input: PatternAggregationInput): PatternMetrics` and `refreshAllPatternMetrics(db: Database, now?: Date): Promise<{ patternsUpdated: number }>` in `src/lib/patterns/tracker.ts`

- [ ] **Step 1: Write failing tests for tokenization, pattern keys, and Empirical Bayes small-sample shrinkage (Review Focus #4)**

```ts
// tests/patterns/extract-and-track.test.ts
import { describe, expect, it } from "vitest";
import { extractDomainPatterns } from "@/lib/patterns/extract";
import { computePatternMetrics } from "@/lib/patterns/tracker";

describe("pattern extraction & Empirical Bayes velocity tracking", () => {
  it("tokenizes compound SLDs into morphemes, archetype, and multi-label pattern keys", () => {
    const res = extractDomainPatterns("truthledger", ".ai");
    expect(res.tokens).toEqual(["truth", "ledger"]);
    expect(res.archetype).toBe("COMPOUND_2WORD");
    expect(res.keys).toEqual(
      expect.arrayContaining([
        "tld:.ai",
        "prefix:truth",
        "prefix:truth:.ai",
        "suffix:ledger",
        "archetype:COMPOUND_2WORD:.ai",
        "len_bucket:11-15:.ai",
      ])
    );
  });

  it("shrinks noisy n=2 absorption toward TLD prior while letting n=200 absorption dominate", () => {
    const noisySmall = computePatternMetrics({
      patternKey: "prefix:flint:.ai",
      totalDomains: 2,
      availableCount: 1,
      registeredCount: 1,
      newlyRegistered7d: 1,
      newlyRegistered30d: 1,
      dropped30d: 0,
      availableStart30d: 2,
      tldPriorAbsorption30d: 0.04,
      compPriceSlope: 0,
      trendZScore: 0,
    });
    const robustLarge = computePatternMetrics({
      patternKey: "prefix:truth:.ai",
      totalDomains: 200,
      availableCount: 40,
      registeredCount: 160,
      newlyRegistered7d: 12,
      newlyRegistered30d: 40,
      dropped30d: 1,
      availableStart30d: 80,
      tldPriorAbsorption30d: 0.04,
      compPriceSlope: 0.18,
      trendZScore: 1.8,
    });
    expect(noisySmall.absorption30d).toBeCloseTo(0.5, 2);
    expect(noisySmall.shrunkAbsorption30d).toBeLessThan(0.10); // shrunk heavily toward 0.04 prior
    expect(robustLarge.shrunkAbsorption30d).toBeGreaterThan(0.40);
    expect(robustLarge.momentumScore).toBeGreaterThan(noisySmall.momentumScore + 30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/patterns/extract-and-track.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/patterns/extract.ts` and `src/lib/patterns/tracker.ts`**

- `src/lib/patterns/extract.ts`: greedy longest-match morpheme tokenizer backed by a curated high-signal English/tech/brand lexicon (~500 roots including `truth`, `real`, `ledger`, `vault`, `proof`, `audit`, `signal`, `canon`, `notary`, `forge`, `agent`, `cloud`, `pay`, `ai`, etc.) plus hyphen/digit split; classifies `SINGLE_WORD`, `COMPOUND_2WORD`, `COMPOUND_3PLUS`, `SHORT_BRAND_LE6`, `HYPHENATED`, `NUMERIC`; emits deterministic `keys` array (`tld:*`, `prefix:<tok0>`, `prefix:<tok0>:<tld>`, `suffix:<tokLast>`, `archetype:<arch>:<tld>`, `len_bucket:<bucket>:<tld>`).
- `src/lib/patterns/tracker.ts`: computes `shrunkAbsorption30d = (newlyRegistered30d + PRIOR_WEIGHT * tldPriorAbsorption30d) / (availableStart30d + PRIOR_WEIGHT)` with `PRIOR_WEIGHT = 20`, `scarcityRatio = registeredCount / Math.max(1, totalDomains)`, `dropRate30d = dropped30d / Math.max(1, registeredCount + dropped30d)`, and `momentumScore` in `[0, 100]` combining shrunk 30d absorption (40%), scarcity pressure (20%), comp-sale log slope (20%), keyword trend Z-score (20%) minus drop-churn penalty. `refreshAllPatternMetrics(db)` executes set-based SQL aggregation over `domain_patterns` + `domain_snapshots` (last 7d & 30d) + `market_signals` and upserts `patterns`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/patterns/extract-and-track.test.ts`
Expected: PASS (2/2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/patterns/ tests/patterns/extract-and-track.test.ts
git commit -m "feat: add morpheme pattern extractor and Empirical-Bayes velocity tracker"
```

---

### Task 6: Explainable Value Increase Predictor & Historical Backtest Evaluator

**Files:**
- Create: `src/lib/predictor/features.ts`
- Create: `src/lib/predictor/model.ts`
- Create: `src/lib/predictor/backtest.ts`
- Test: `tests/predictor/model-and-backtest.test.ts`

**Interfaces:**
- Consumes: `ExtractedPatterns`, `PatternMetrics` from `src/lib/patterns/*`; `calculateFiveYearTco` from `src/lib/pricing/tco.ts`; `domains`, `patterns`, `valuePredictions`, `marketSignals` from `src/db/schema.ts`
- Produces:
  - `buildFeatureVector(input: FeatureInput): DomainFeatureVector` in `src/lib/predictor/features.ts`
  - `MODEL_VERSION = "v1-ridge-explainable"`, `scoreDomain(input: ScoreDomainInput): PredictionOutput`, and `recomputePredictionsBatch(db: Database, opts?: { chunkSize?: number }): Promise<{ scored: number }>` in `src/lib/predictor/model.ts`
  - `evaluateBacktest(samples: BacktestSample[]): BacktestReport` in `src/lib/predictor/backtest.ts`

- [ ] **Step 1: Write failing tests for value prediction, growth clamping, confidence decay, cross-TLD spillover, and backtesting (Review Focus #4)**

```ts
// tests/predictor/model-and-backtest.test.ts
import { describe, expect, it } from "vitest";
import { scoreDomain, MODEL_VERSION } from "@/lib/predictor/model";
import { evaluateBacktest } from "@/lib/predictor/backtest";

describe("explainable value-increase predictor & backtester", () => {
  it("boosts .ai domain when .com counterpart is taken and pattern momentum is high, with explainable drivers", () => {
    const high = scoreDomain({
      domainId: 10,
      fqdn: "truthledger.ai",
      sld: "truthledger",
      tld: ".ai",
      tokens: ["truth", "ledger"],
      archetype: "COMPOUND_2WORD",
      hasHyphen: false,
      hasDigit: false,
      fiveYrTcoUsd: 424.73,
      comCounterpartRegistered: true,
      snapshotAgeDays: 1,
      matchedPatterns: [
        { patternKey: "prefix:truth:.ai", totalDomains: 150, availableCount: 25, registeredCount: 125, absorption7d: 0.08, absorption30d: 0.35, shrunkAbsorption30d: 0.31, dropRate30d: 0.01, scarcityRatio: 0.83, compPriceSlope: 0.22, trendZScore: 2.1, momentumScore: 84 },
      ],
    });
    expect(high.modelVersion).toBe(MODEL_VERSION);
    expect(high.predicted12mGrowthPct).toBeGreaterThan(25);
    expect(high.predicted12mGrowthPct).toBeLessThanOrEqual(300);
    expect(high.confidence).toBeGreaterThan(0.7);
    expect(high.topDrivers.length).toBeGreaterThanOrEqual(3);
    expect(high.topDrivers[0].explanation).toBeTruthy();
  });

  it("clamps extreme growth to [-50, +300] and lowers confidence for tiny/stale samples", () => {
    const extreme = scoreDomain({
      domainId: 11,
      fqdn: "x-99-weird.io",
      sld: "x-99-weird",
      tld: ".io",
      tokens: ["x", "99", "weird"],
      archetype: "HYPHENATED",
      hasHyphen: true,
      hasDigit: true,
      fiveYrTcoUsd: 265.46,
      comCounterpartRegistered: false,
      snapshotAgeDays: 30,
      matchedPatterns: [
        { patternKey: "prefix:x:.io", totalDomains: 2, availableCount: 1, registeredCount: 1, absorption7d: 0.5, absorption30d: 0.5, shrunkAbsorption30d: 0.99, dropRate30d: 0, scarcityRatio: 0.99, compPriceSlope: 5.0, trendZScore: 10.0, momentumScore: 100 },
      ],
    });
    expect(extreme.predicted12mGrowthPct).toBeLessThanOrEqual(300);
    expect(extreme.predicted12mGrowthPct).toBeGreaterThanOrEqual(-50);
    expect(extreme.confidence).toBeLessThan(0.35);
  });

  it("computes MAPE and Precision@K against a naive 0%-growth baseline", () => {
    const report = evaluateBacktest([
      { domainId: 1, predicted12mGrowthPct: 45, actualGrowthPct: 40, actuallyAbsorbed: true },
      { domainId: 2, predicted12mGrowthPct: 30, actualGrowthPct: 28, actuallyAbsorbed: true },
      { domainId: 3, predicted12mGrowthPct: -5, actualGrowthPct: -8, actuallyAbsorbed: false },
    ]);
    expect(report.sampleSize).toBe(3);
    expect(report.beatsBaseline).toBe(true);
    expect(report.mapePct).toBeLessThan(report.baselineMapePct);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/predictor/model-and-backtest.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `src/lib/predictor/features.ts`, `src/lib/predictor/model.ts`, and `src/lib/predictor/backtest.ts`**

- `src/lib/predictor/features.ts`: computes normalized intrinsic factors (`tldBaseValueUsd`, `lengthScore`, `pronounceabilityScore`, `cleanCharPenalty`, `wordQualityScore`) and dynamic factors (`maxShrunkAbsorption30d`, `weightedScarcity`, `crossTldSpillover`, `compPriceSlope`, `trendZScore`, `renewalDragPct`).
- `src/lib/predictor/model.ts`: combines regularized weights into `estimatedFairValueUsd`, sums individual dynamic driver contributions into `rawGrowthPct`, clamps `predicted12mGrowthPct = clamp(rawGrowthPct, -50, 300)`, computes `predicted12mValueUsd = fair * (1 + growth/100)` and `net5yrRoiMultiple = (fair * (1 + growth/100)^2.5) / fiveYrTcoUsd` (damped 5-yr compounding), computes `confidence = (effectiveN / (effectiveN + 20)) * freshnessDecay(snapshotAgeDays)` where `freshnessDecay = snapshotAgeDays <= 7 ? 1 : Math.max(0.25, 1 - (snapshotAgeDays - 7) * 0.03)`, and returns top 5 sorted `FeatureContribution` entries. `recomputePredictionsBatch(db)` writes updated columns on `domains` and appends `value_predictions` in 500-row chunks.
- `src/lib/predictor/backtest.ts`: calculates mean absolute error/MAPE vs. naive 0%-growth baseline and Precision@20 (or Precision@N when `sampleSize < 20`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/predictor/model-and-backtest.test.ts`
Expected: PASS (3/3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/predictor/ tests/predictor/model-and-backtest.test.ts
git commit -m "feat: add explainable value-increase predictor and backtest evaluator"
```

---

### Task 7: Authenticated Vercel Cron Endpoints, Keyset-Paginated APIs & `vercel.json`

**Files:**
- Create: `src/lib/auth/cron.ts`
- Create: `src/app/api/cron/probe/route.ts`
- Create: `src/app/api/cron/patterns/route.ts`
- Create: `src/app/api/domains/query.ts`
- Create: `src/app/api/domains/route.ts`
- Create: `src/app/api/patterns/route.ts`
- Create: `src/app/api/signals/import/route.ts`
- Create: `vercel.json`
- Test: `tests/api/routes.test.ts`

**Interfaces:**
- Consumes: `processWorkerTick` (Task 4), `refreshAllPatternMetrics` (Task 5), `recomputePredictionsBatch` (Task 6), `createDb`, `domains`, `patterns`, `marketSignals` (Task 1)
- Produces:
  - `verifyCronSecret(req: Request, expectedSecret?: string): boolean` in `src/lib/auth/cron.ts`
  - `encodeCursor(cursor: DomainCursor): string`, `decodeCursor(raw: string | null): DomainCursor | null`, and `buildDomainWhereClause(params: DomainFilterParams): DomainQuerySpec` in `src/app/api/domains/query.ts`
  - HTTP contracts:
    - `GET /api/cron/probe` (`maxDuration = 300`, Bearer auth -> `200 WorkerTickResult | 401`)
    - `GET /api/cron/patterns` (`maxDuration = 300`, Bearer auth -> `200 { patternsUpdated, scored } | 401`)
    - `GET /api/domains?status=&tld=&pattern=&minGrowth=&q=&cursor=&limit=50` (`-> { items, nextCursor, totalApprox }`)
    - `GET /api/patterns?tld=&limit=50` (`-> { items }`)
    - `POST /api/signals/import` (Bearer auth, Zod-validated JSON array -> `200 { imported }`)

- [ ] **Step 1: Write failing tests for constant-time CRON_SECRET auth and keyset cursor encoding/filtering (Review Focus #5)**

```ts
// tests/api/routes.test.ts
import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/auth/cron";
import { encodeCursor, decodeCursor, buildDomainWhereClause } from "@/app/api/domains/query";
import { GET as probeGet, maxDuration as probeMaxDuration } from "@/app/api/cron/probe/route";

describe("cron auth & keyset-paginated domain API", () => {
  it("rejects missing or mismatched CRON_SECRET with HTTP 401 and sets Fluid Compute maxDuration=300", async () => {
    process.env.CRON_SECRET = "super-secret-token-value";
    expect(probeMaxDuration).toBe(300);
    expect(verifyCronSecret(new Request("http://localhost/api/cron/probe"))).toBe(false);
    expect(verifyCronSecret(new Request("http://localhost/api/cron/probe", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
    expect(verifyCronSecret(new Request("http://localhost/api/cron/probe", { headers: { authorization: "Bearer super-secret-token-value" } }))).toBe(true);

    const res = await probeGet(new Request("http://localhost/api/cron/probe"));
    expect(res.status).toBe(401);
  });

  it("round-trips keyset cursor and rejects malformed cursors cleanly", () => {
    const token = encodeCursor({ sortValue: 42.75, id: 98123 });
    expect(decodeCursor(token)).toEqual({ sortValue: 42.75, id: 98123 });
    expect(decodeCursor("not-valid-base64!!!")).toBeNull();

    const spec = buildDomainWhereClause({ status: "available", tld: ".ai", minGrowth: 20, cursor: { sortValue: 42.75, id: 98123 } });
    expect(spec.hasKeysetPredicate).toBe(true);
    expect(spec.usesOffset).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/routes.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement auth helper, API routes, query builder, and `vercel.json`**

- `src/lib/auth/cron.ts`: extracts Bearer token, compares SHA-256 digests with `crypto.timingSafeEqual` so differing string lengths never leak timing or throw `RangeError`.
- `src/app/api/domains/query.ts` & `route.ts`: keyset predicate `(predicted_12m_growth_pct < $sortValue OR (predicted_12m_growth_pct = $sortValue AND id < $id))` ordered by `(predicted_12m_growth_pct DESC, id DESC)`, clamped `limit <= 100`, zero `OFFSET`.
- `src/app/api/cron/probe/route.ts` & `patterns/route.ts`: both export `export const maxDuration = 300; export const dynamic = "force-dynamic";`, enforce `verifyCronSecret`, and return structured JSON.
- `src/app/api/signals/import/route.ts`: Bearer-guarded Zod array validator inserting `comp_sale`, `keyword_trend`, or `registry_price` rows into `market_signals` in 500-row chunks.
- `vercel.json`: strictly valid JSON declaring Pro-compatible cron schedules (`/api/cron/probe` every 15 minutes `*/15 * * * *` and `/api/cron/patterns` every 6 hours `0 */6 * * *`); Hobby-plan daily fallback (`0 2 * * *`) or external cron trigger notes live in `.env.example`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/routes.test.ts`
Expected: PASS (2/2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/ src/app/api/ vercel.json tests/api/routes.test.ts
git commit -m "feat: add authenticated Vercel cron routes and keyset-paginated APIs"
```

---

### Task 8: Next.js Command Center Dashboard (100k Explorer, Pattern Radar & 5-Yr ROI Simulator)

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/components/DomainExplorer.tsx`
- Create: `src/components/PatternRadar.tsx`
- Create: `src/components/PortfolioSimulator.tsx`
- Test: `tests/ui/command-center.test.tsx`

**Interfaces:**
- Consumes: `GET /api/domains`, `GET /api/patterns` (Task 7); `calculateFiveYearTco` (Task 2); `PredictionOutput`, `PatternMetrics` types (Tasks 5–6)
- Produces:
  - Server-rendered Command Center page `/` displaying catalog health KPIs, `PatternRadar`, `DomainExplorer`, and `PortfolioSimulator`.

- [ ] **Step 1: Write failing component tests for Explorer driver waterfall, Pattern Radar rendering, and 5-Yr ROI Simulator CSV export**

```tsx
// tests/ui/command-center.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioSimulator } from "@/components/PortfolioSimulator";
import { PatternRadar } from "@/components/PatternRadar";

describe("Command Center UI components", () => {
  it("recalculates 5-year TCO and net ROI when switching registrar in PortfolioSimulator", () => {
    render(
      <PortfolioSimulator
        selectedDomains={[
          { fqdn: "truthcipher.com", tld: ".com", estimatedValueUsd: 450, predicted12mGrowthPct: 32 },
          { fqdn: "truthledger.ai", tld: ".ai", estimatedValueUsd: 1800, predicted12mGrowthPct: 48 },
        ]}
      />
    );
    const cfText = screen.getByTestId("five-yr-total").textContent;
    fireEvent.change(screen.getByLabelText("Registrar"), { target: { value: "namecheap" } });
    const ncText = screen.getByTestId("five-yr-total").textContent;
    expect(cfText).not.toBe(ncText);
    expect(Number(ncText!.replace(/[^0-9.]/g, ""))).toBeGreaterThan(Number(cfText!.replace(/[^0-9.]/g, "")));
  });

  it("renders breakout pattern absorption and remaining inventory in PatternRadar", () => {
    render(
      <PatternRadar
        patterns={[
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
        ]}
      />
    );
    expect(screen.getByText("prefix:truth:.ai")).toBeTruthy();
    expect(screen.getByText(/25 avail/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/command-center.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement layout, page, and the 3 interactive Command Center components**

- `src/app/layout.tsx` & `globals.css`: clean dark/slate financial-terminal aesthetic with crisp typography, monospace numeric tables (`tabular-nums`), and semantic emerald/amber/rose badges.
- `src/components/PatternRadar.tsx`: displays top accelerating patterns with 7d/30d shrunk absorption rate, scarcity progress bar, remaining available inventory count, and click-to-filter hook into `DomainExplorer`.
- `src/components/DomainExplorer.tsx`: cursor-paginated table (`Next 50` via `nextCursor`) with filters (`status`, `tld`, `pattern`, `minGrowth`, `q`), expandable row panel rendering the `topDrivers` attribution waterfall bar chart, and checkbox selection feeding `PortfolioSimulator`.
- `src/components/PortfolioSimulator.tsx`: live client-side 5-year TCO vs. predicted value & net ROI calculator powered by `calculateFiveYearTco`, registrar switcher (`cloudflare`, `porkbun`, `namecheap`, `optimal`), inflation slider (`0%..10%`), and 1-click CSV export.
- `src/app/page.tsx`: Server Component loading initial KPI summary (100k tracked count, % fresh within tier SLA, last worker run, top 15 patterns, first 50 top-predicted available domains) with graceful empty-DB onboarding banner when `DATABASE_URL` is not yet configured.

- [ ] **Step 4: Run full test suite and production build check**

Run: `npx vitest run && npm run build`
Expected: All unit/component tests PASS and Next.js production build completes with zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/page.tsx src/components/ tests/ui/command-center.test.tsx
git commit -m "feat: add 100k Domain Radar command center UI, pattern radar, and 5-yr ROI simulator"
```
