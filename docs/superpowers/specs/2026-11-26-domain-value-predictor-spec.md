# Domain Radar — 100k Self-Updating Pattern Tracker & Value Increase Predictor Spec

**Date:** 2026-11-26
**Target Project Directory:** `/home/antigravity/domain-radar`
**Hosting & Database:** Vercel (Next.js App Router + Fluid Compute + Cron/Schedules) + Neon Serverless Postgres (Drizzle ORM)

---

## 1. Objective

Build a production-grade, self-updating intelligence platform capable of continuously monitoring **100,000 domains** on Vercel + Neon Postgres, automatically detecting registration/drop patterns across structural and semantic families, and forecasting **12-month value appreciation** and **5-year net ROI** (after registrar holding costs) with explainable feature attribution.

## 2. Global Constraints

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

## 3. Subsystems

1. **Data Layer & 100k Ingestion (`Neon + Drizzle`)**
   - 8 tables: `domains`, `domain_snapshots`, `patterns`, `domain_patterns`, `market_signals`, `value_predictions`, `worker_runs`, `tld_pricing`.
   - Diff-only snapshot persistence: `domain_snapshots` inserts a row only when `status`, `registrar`, or `expires_at` changes, or once every 7 days as a heartbeat checkpoint.
   - 100k seeder (`scripts/seed-100k.ts`) combining verified seed lists (including the 100 `truth`/`real` domains) + combinatorial keyword/morpheme matrix across supported TLDs.

2. **Self-Updating Probe Engine (`Vercel Fluid Compute + Lease Queue`)**
   - **Tiered Refresh Cadence:**
     - `hot` (top 5,000 by score / watchlist / recently changed): every `6 hours`
     - `warm` (next 20,000): every `24 hours`
     - `cold` (remaining 75,000): every `72 hours`
   - **Throughput Math:** `5,000*4 + 20,000*1 + 75,000/3 = 65,000` checks/day (`~2,708/hr`). Stage-1 DNS NS lookup filters ~80% of stably delegated domains in `<15ms`, leaving `~540` RDAP queries/hour (~9/min total across 8 registries — completely under RDAP rate limits).
   - **Per-Registry Limiter & Circuit Breaker:** Max `4` concurrent requests per RDAP host; HTTP `429` opens a `60s` (or `Retry-After`) host cooldown and skips remaining items for that host in the current tick.

3. **Pattern Tracking Engine**
   - Extracts multi-label patterns per domain: `tld:<tld>`, `prefix:<tok0>`, `suffix:<tokLast>`, `archetype:<arch>:<tld>`, `len_bucket:<bucket>:<tld>`.
   - Rolling 7d & 30d aggregation per pattern:
     - `absorption7d` / `absorption30d`: newly registered fraction of formerly available domains in the pattern.
     - `shrunkAbsorption30d`: Empirical Bayes shrinkage `(reg30d + priorWeight * tldPrior) / (availStart30d + priorWeight)` with `priorWeight = 20`.
     - `scarcityRatio`: `registeredCount / totalDomains`.
     - `dropRate30d`: `registered -> available` churn fraction.
     - `compPriceSlope`: log-price trend from `market_signals` (`signal_type = "comp_sale"`).
     - `trendZScore`: normalized external search/keyword delta (`signal_type = "keyword_trend"`).
     - `momentumScore`: `0..100` composite index.

4. **Value Increase Predictor & Backtester**
   - Deterministic, versioned model (`v1-ridge-explainable`) combining:
     - Intrinsic score: TLD authority multiplier, length curve (`<=6` premium, `7-10` core, `11-15` moderate, `>15` decay), pronounceability (vowel ratio `0.25..0.55`), clean-char bonus (no hyphen/digit), dictionary word bonus.
     - Dynamic appreciation drivers: `shrunkAbsorption30d`, `scarcityRatio`, `crossTldSpillover` (`.com` registered while `.ai`/`.io` available boosts spillover), `compPriceSlope`, `trendZScore`, minus `renewalDrag` (5-yr TCO ratio).
   - Backtest module compares historical `value_predictions` (`T - 30d` or held-out comp sales) against observed absorption/sale outcomes and reports `mapePct`, `precisionAt20`, and `beatsBaseline`.

5. **Web Command Center (Next.js App Router)**
   - **Overview Dashboard (`/`)**: Live catalog telemetry (100k status distribution, freshness SLA %, worker run health, top 10 breakout patterns, top 10 value-increase opportunities).
   - **100k Domain Explorer**: Keyset-paginated table with instant filters (`status`, `tld`, `pattern`, `minGrowthPct`, `minRoi`, `q`), expandable prediction waterfall (`top_drivers`), and watchlist pin.
   - **Pattern Radar**: Momentum leaderboard with 7d/30d absorption, scarcity bar, and remaining available count.
   - **5-Yr Portfolio Simulator**: Multi-registrar TCO (Cloudflare / Porkbun / Namecheap / Optimal) vs. predicted value and net ROI multiple with CSV export.

## 4. Non-Goals (v1)

- Automated registrar checkout / credit-card purchasing (read-only intelligence + export only).
- Multi-tenant SaaS billing/auth (single operator protected by `CRON_SECRET` / optional admin token).
- Deep-learning GPU training (replaced by fast, transparent, backtestable regularized scoring running inside Vercel + Neon).
