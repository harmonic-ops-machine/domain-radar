# Domain Radar

**100,000-domain self-updating pattern tracker & value-increase predictor** built for **Vercel (Next.js 15 App Router + Fluid Compute)** and **Neon Serverless Postgres (Drizzle ORM)**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fharmonic-ops-machine%2Fdomain-radar&env=DATABASE_URL,DATABASE_URL_UNPOOLED,CRON_SECRET&project-name=domain-radar&repository-name=domain-radar)

## Architecture

- **Neon Serverless Postgres (8 tables):** `domains`, `domain_snapshots` (diff-only + 7d heartbeat), `patterns`, `domain_patterns`, `market_signals`, `value_predictions`, `worker_runs`, `tld_pricing`.
- **Zero-Broker Lease Queue:** Postgres `FOR UPDATE SKIP LOCKED` with 6-minute auto-reclaiming leases (`lease_until`) and tiered refresh cadence (`hot` 6h / `warm` 24h / `cold` 72h).
- **Two-Stage Polite Prober:** Stage-1 DNS NS pre-filter + Stage-2 authoritative RDAP with per-host concurrency cap (`4/host`) and `429`/`503` circuit breaker (strict `404`-only availability).
- **Pattern Velocity & Value Predictor:** Morpheme/archetype extractor + Empirical Bayes shrinkage (`priorWeight = 20`) + explainable `v1-ridge-explainable` 12-month growth & 5-year net ROI scorer.
- **100k Command Center UI:** `O(log N)` keyset-paginated `DomainExplorer` with expandable driver attribution, `PatternRadar`, and `PortfolioSimulator` with Nov 2026 registrar TCO (Cloudflare, Porkbun, Namecheap, Optimal Mix) and CSV export.

## Quickstart (Neon + Vercel)

1. Click **Deploy with Vercel** above (or import `harmonic-ops-machine/domain-radar` in Vercel) and attach the **Neon Postgres** integration so `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are populated. Set a 32-byte random `CRON_SECRET`.
2. Push migrations and seed 100,000 domains using Neon's unpooled URL:
   ```bash
   DATABASE_URL_UNPOOLED="<neon-unpooled-url>" npm run db:migrate
   DATABASE_URL_UNPOOLED="<neon-unpooled-url>" npm run seed:100k
   ```
3. Trigger an initial pattern & prediction pass:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/cron/patterns
   ```

> **Vercel Hobby vs. Pro:** `vercel.json` schedules `/api/cron/probe` every 15 minutes (`*/15 * * * *`, Pro). On Hobby, switch `vercel.json` to daily (`0 2 * * *`) or call `/api/cron/probe` every 15 minutes from an external scheduler with `Authorization: Bearer <CRON_SECRET>`.

## Local Development & Verification

```bash
npm install
npx tsc --noEmit
npx vitest run
npm run build
```
