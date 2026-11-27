import { sql } from "drizzle-orm";
import { createDb } from "@/db";
import { refreshAllPatternMetrics } from "@/lib/patterns/tracker";
import { recomputePredictionsBatch } from "@/lib/predictor/model";
import { processWorkerTick } from "@/lib/worker/claim-and-process";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL_UNPOOLED");
  const db = createDb({ url, driver: "pg" });

  console.log("Promoting short <=6-char .com domains to hot tier...");
  await db.execute(
    sql`UPDATE domains SET tier = 'hot', next_check_at = NOW() WHERE tld = '.com' AND length <= 6`
  );

  console.log("Running 40s live DNS + authoritative RDAP/WHOIS probe pass...");
  const tick = await processWorkerTick(db, {
    budgetMs: 40_000,
    batchSize: 40,
    concurrency: 10,
  });
  console.log("LIVE PROBE TICK:", tick);

  console.log("Refreshing pattern metrics & rescoring 100k domains with v2-powerlaw-market...");
  const pat = await refreshAllPatternMetrics(db);
  const scored = await recomputePredictionsBatch(db, {
    chunkSize: 500,
    budgetMs: 180_000,
  });
  console.log("PATTERNS & SCORING:", { ...pat, ...scored });

  const counts = await db.execute(
    sql`SELECT status, COUNT(*)::int AS n FROM domains WHERE last_checked_at IS NOT NULL GROUP BY status ORDER BY n DESC`
  );
  console.log("VERIFIED COUNTS:", (counts as unknown as { rows: unknown[] }).rows);

  const sampleExpensive = await db.execute(
    sql`SELECT fqdn, status, estimated_value_usd, registrar, last_checked_at FROM domains WHERE fqdn IN ('openai.com','metaai.com','truthcipher.com','truthledger.ai') ORDER BY estimated_value_usd DESC`
  );
  console.log("SPOT CHECK:", (sampleExpensive as unknown as { rows: unknown[] }).rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
