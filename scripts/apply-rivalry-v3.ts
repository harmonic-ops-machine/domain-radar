import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { createDb } from "@/db";
import { bulkUpsertDomains } from "@/lib/domains/bulk-upsert";
import { refreshAllPatternMetrics } from "@/lib/patterns/tracker";
import { recomputePredictionsBatch } from "@/lib/predictor/model";
import { processWorkerTick } from "@/lib/worker/claim-and-process";

const RJC_SEED_DOMAINS: string[] = [
  // REALITY cluster (Ground-Truth, Provenance, World Models)
  "realityattest.com", "realityprovenance.com", "realitydocket.com", "realityledger.com",
  "realityverity.com", "realityground.com", "realitybeacon.com", "realityvault.com",
  "realitymesh.ai", "realityproof.ai", "realityattest.ai", "realitycausal.ai",
  "groundtruthmesh.com", "groundtruthledger.com", "groundtruthproof.ai", "groundtruth.dev",
  "verityprovenance.com", "verityattest.com", "verityfabric.com", "veritymanifold.ai",
  "sim2realmesh.com", "sim2realproof.com", "sim2real.io", "sim2reallabs.ai",
  "worldmeshproof.com", "worldmesh.dev", "worldmeshattest.ai", "causalprovenance.com",
  "causalverity.com", "causalmesh.ai", "ontologicalproof.com", "attestprovenance.com",
  "provenanceledger.ai", "provenancevault.dev", "provenancemesh.io", "realityweave.com",
  "realityconduit.com", "realitycharter.com", "realitytribunal.com", "realityfiduciary.com",

  // JUSTICE cluster (Algorithmic Accountability, Adjudication, Governance)
  "justicetribunal.com", "justicefiduciary.com", "justiceredress.com", "justicecharter.com",
  "justicedocket.com", "justiceprovenance.com", "justiceattest.com", "justicemesh.ai",
  "justiceaudit.ai", "justiceredress.ai", "justicecharter.org", "justiceledger.io",
  "fiduciaryagent.com", "fiduciarymesh.com", "fiduciaryproof.ai", "fiduciaryaudit.ai",
  "tribunaldocket.com", "tribunalledger.com", "tribunalproof.ai", "tribunal.dev",
  "redressledger.com", "redressdocket.com", "redressproof.ai", "redressprotocol.com",
  "sovereigncharter.com", "sovereigntribunal.com", "sovereigndocket.com", "sovereignredress.com",
  "arbitrateproof.com", "arbitratemesh.ai", "arbitrateledger.com", "lexprovenance.com",
  "lextribunal.com", "lexfiduciary.com", "lexredress.com", "charterattest.com",
  "charterprovenance.com", "docketprovenance.com", "docketfiduciary.com", "audittribunal.com",

  // COMPOSABILITY cluster (Modular Agent Meshes, Protocol Bridges, Zero-Lock-In Fabrics)
  "composablefabric.com", "composablemesh.com", "composableinterop.com", "composableweave.com",
  "composableconduit.com", "composablemanifold.com", "composableagent.ai", "composablemesh.ai",
  "composablefabric.dev", "composable.app", "composableinterop.dev", "composablegraft.com",
  "interopfabric.com", "interopmanifold.com", "interopconduit.com", "interopweave.com",
  "interopmesh.ai", "interopfabric.dev", "functorfabric.com", "functormesh.com",
  "functormanifold.com", "functorweave.com", "functor.dev", "functorinterop.ai",
  "manifoldfabric.com", "manifoldweave.com", "manifoldconduit.com", "manifoldinterop.ai",
  "morphismfabric.com", "morphismmesh.com", "morphismweave.com", "morphismconduit.com",
  "federatedfabric.com", "federatedmanifold.com", "federatedconduit.com", "federatedweave.com",
  "federatedinterop.ai", "graftfabric.com", "graftmanifold.com", "conduitfabric.dev",
];

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL_UNPOOLED");

  // 1. Apply the Neon SQL migration idempotently
  const sqlFile = path.resolve(process.cwd(), "migrations/20261126_rivalry_lexical_rates.sql");
  const migrationSql = fs.readFileSync(sqlFile, "utf8");
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log("Applying migrations/20261126_rivalry_lexical_rates.sql...");
  await client.query(migrationSql);
  const checkTables = await client.query(`
    SELECT
      (SELECT count(*)::int FROM tld_rate_benchmarks) AS benchmarks,
      (SELECT count(*)::int FROM ai_rivalry_regimes) AS regimes,
      (SELECT count(*)::int FROM lexical_cluster_seeds) AS lexical_seeds
  `);
  console.log("MIGRATION COUNTS:", checkTables.rows[0]);
  await client.end();

  // 2. Seed REALITY / JUSTICE / COMPOSABILITY hot/watched domains
  const db = createDb({ url, driver: "pg" });
  console.log(`Seeding ${RJC_SEED_DOMAINS.length} REALITY / JUSTICE / COMPOSABILITY domains as hot+watched...`);
  const upsertRes = await bulkUpsertDomains(db, RJC_SEED_DOMAINS, {
    tier: "hot",
    watched: true,
  });
  console.log("UPSERT RESULT:", upsertRes);

  // Force immediate probe priority on these newly seeded domains
  await db.execute(
    sql`UPDATE domains SET tier = 'hot', next_check_at = NOW() - interval '1 hour' WHERE fqdn IN (${sql.join(
      RJC_SEED_DOMAINS.map((f) => sql`${f}`),
      sql`, `
    )})`
  );

  // 3. Probe them live via DNS + authoritative RDAP
  console.log("Probing REALITY / JUSTICE / COMPOSABILITY domains live via DNS + RDAP...");
  const tick = await processWorkerTick(db, {
    budgetMs: 45_000,
    batchSize: 40,
    concurrency: 6,
  });
  console.log("LIVE RJC PROBE TICK:", tick);

  // 4. Refresh pattern metrics & rescore
  console.log("Refreshing pattern metrics & rescoring with v2-powerlaw-market...");
  const pat = await refreshAllPatternMetrics(db);
  const scored = await recomputePredictionsBatch(db, {
    chunkSize: 500,
    budgetMs: 180_000,
  });
  console.log("SCORING:", { ...pat, ...scored });

  const rjcVerified = await db.execute(
    sql`SELECT fqdn, status, estimated_value_usd, last_checked_at FROM domains WHERE fqdn IN (${sql.join(
      RJC_SEED_DOMAINS.map((f) => sql`${f}`),
      sql`, `
    )}) AND status = 'available' AND last_checked_at IS NOT NULL ORDER BY estimated_value_usd DESC LIMIT 12`
  );
  console.log("SAMPLE VERIFIED AVAILABLE RJC DOMAINS:", (rjcVerified as unknown as { rows: unknown[] }).rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
