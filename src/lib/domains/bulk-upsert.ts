import { sql } from "drizzle-orm";
import type { Database } from "@/db";
import { domainPatterns, domains, patterns } from "@/db/schema";
import { extractDomainPatterns } from "@/lib/patterns/extract";
import { calculateFiveYearTco } from "@/lib/pricing/tco";
import type { RefreshTier, TldCode } from "@/lib/types";
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
    const chunk = uniqueRows.slice(i, i + chunkSize);
    const extractedByFqdn = new Map<
      string,
      ReturnType<typeof extractDomainPatterns>
    >();

    const slice = chunk.map((d) => {
      const extracted = extractDomainPatterns(d.sld, d.tld);
      extractedByFqdn.set(d.fqdn, extracted);
      return {
        fqdn: d.fqdn,
        sld: d.sld,
        tld: d.tld,
        length: d.length,
        hasHyphen: d.hasHyphen,
        hasDigit: d.hasDigit,
        tokens: extracted.tokens,
        archetype: extracted.archetype,
        tier,
        watched,
        fiveYrTcoUsd: calculateFiveYearTco(d.tld, { registrar: "cloudflare" })
          .fiveYrTotalUsd,
      };
    });

    const upsertBuilder = db
      .insert(domains)
      .values(slice)
      .onConflictDoUpdate({
        target: domains.fqdn,
        set: {
          tokens: sql`excluded.tokens`,
          archetype: sql`excluded.archetype`,
          tier: sql`CASE WHEN ${domains.watched} OR excluded.watched THEN 'hot' ELSE excluded.tier END`,
          watched: sql`${domains.watched} OR excluded.watched`,
          fiveYrTcoUsd: sql`excluded.five_yr_tco_usd`,
          updatedAt: new Date(),
        },
      });

    const returned =
      typeof (upsertBuilder as unknown as { returning?: unknown }).returning ===
      "function"
        ? await upsertBuilder.returning({
            id: domains.id,
            sld: domains.sld,
            tld: domains.tld,
          })
        : ((await upsertBuilder) as unknown as
            | Array<{ id: number; sld: string; tld: string }>
            | undefined);

    if (Array.isArray(returned) && returned.length > 0) {
      const patternStubs = new Map<
        string,
        { patternKey: string; patternType: string; tld: string | null }
      >();
      const links: Array<{ domainId: number; patternKey: string }> = [];

      for (const row of returned) {
        const extracted =
          extractedByFqdn.get(`${row.sld}${row.tld}`) ??
          extractDomainPatterns(row.sld, row.tld as TldCode);
        for (const key of extracted.keys) {
          if (!patternStubs.has(key)) {
            const parts = key.split(":");
            patternStubs.set(key, {
              patternKey: key,
              patternType: parts[0] ?? "other",
              tld: parts.find((p) => p.startsWith(".")) ?? null,
            });
          }
          links.push({ domainId: row.id, patternKey: key });
        }
      }

      const stubArr = Array.from(patternStubs.values());
      for (let p = 0; p < stubArr.length; p += MAX_CHUNK_SIZE) {
        await db
          .insert(patterns)
          .values(stubArr.slice(p, p + MAX_CHUNK_SIZE))
          .onConflictDoNothing();
      }

      for (let l = 0; l < links.length; l += MAX_CHUNK_SIZE) {
        await db
          .insert(domainPatterns)
          .values(links.slice(l, l + MAX_CHUNK_SIZE))
          .onConflictDoNothing();
      }
    }

    chunksWritten += 1;
  }

  return {
    accepted: uniqueRows.length,
    duplicatesRemoved,
    invalidRejected,
    chunksWritten,
  };
}
