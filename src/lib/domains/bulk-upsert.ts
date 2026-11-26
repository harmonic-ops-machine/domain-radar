import { sql } from "drizzle-orm";
import type { Database } from "@/db";
import { domains } from "@/db/schema";
import { calculateFiveYearTco } from "@/lib/pricing/tco";
import type { RefreshTier } from "@/lib/types";
import { normalizeDomain, type NormalizedDomain } from "./normalize";

export const MAX_CHUNK_SIZE = 500;

export interface BulkUpsertResult {
  accepted: number;
  duplicatesRemoved: number;
  invalidRejected: number;
  chunksWritten: number;
}

export async function bulkUpsertDomains(
  db: Database,
  rawDomains: string[],
  opts?: {
    chunkSize?: number;
    tier?: RefreshTier;
    watched?: boolean;
  }
): Promise<BulkUpsertResult> {
  const chunkSize = Math.max(
    1,
    Math.min(opts?.chunkSize ?? MAX_CHUNK_SIZE, MAX_CHUNK_SIZE)
  );
  const tier: RefreshTier = opts?.tier ?? "cold";
  const watched = opts?.watched ?? false;

  const seen = new Map<string, NormalizedDomain>();
  let duplicatesRemoved = 0;
  let invalidRejected = 0;

  for (const raw of rawDomains) {
    const norm = normalizeDomain(raw);
    if (!norm) {
      invalidRejected += 1;
      continue;
    }
    if (seen.has(norm.fqdn)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.set(norm.fqdn, norm);
  }

  const uniqueRows = Array.from(seen.values());
  let chunksWritten = 0;

  for (let i = 0; i < uniqueRows.length; i += chunkSize) {
    const slice = uniqueRows.slice(i, i + chunkSize).map((d) => ({
      fqdn: d.fqdn,
      sld: d.sld,
      tld: d.tld,
      length: d.length,
      hasHyphen: d.hasHyphen,
      hasDigit: d.hasDigit,
      tier,
      watched,
      fiveYrTcoUsd: calculateFiveYearTco(d.tld, { registrar: "cloudflare" })
        .fiveYrTotalUsd,
    }));

    await db
      .insert(domains)
      .values(slice)
      .onConflictDoUpdate({
        target: domains.fqdn,
        set: {
          tier: sql`CASE WHEN ${domains.watched} OR excluded.watched THEN 'hot' ELSE excluded.tier END`,
          watched: sql`${domains.watched} OR excluded.watched`,
          fiveYrTcoUsd: sql`excluded.five_yr_tco_usd`,
          updatedAt: new Date(),
        },
      });
    chunksWritten += 1;
  }

  return {
    accepted: uniqueRows.length,
    duplicatesRemoved,
    invalidRejected,
    chunksWritten,
  };
}
