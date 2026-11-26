import { and, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { domains } from "@/db/schema";
import type { DomainCursor } from "@/lib/types";

export interface DomainFilterParams {
  status?: string | null;
  tld?: string | null;
  pattern?: string | null;
  minGrowth?: number | null;
  q?: string | null;
  cursor?: DomainCursor | null;
  limit?: number;
}

export interface DomainQuerySpec {
  where: SQL | undefined;
  limit: number;
  hasKeysetPredicate: boolean;
  usesOffset: false;
}

export function encodeCursor(cursor: DomainCursor): string {
  return Buffer.from(
    JSON.stringify({ s: cursor.sortValue, i: cursor.id }),
    "utf8"
  ).toString("base64url");
}

export function decodeCursor(raw: string | null): DomainCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { s?: unknown; i?: unknown };
    if (
      typeof parsed.s === "number" &&
      Number.isFinite(parsed.s) &&
      typeof parsed.i === "number" &&
      Number.isInteger(parsed.i) &&
      parsed.i > 0
    ) {
      return { sortValue: parsed.s, id: parsed.i };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildDomainWhereClause(
  params: DomainFilterParams
): DomainQuerySpec {
  const predicates: SQL[] = [];

  if (params.status && params.status !== "all") {
    predicates.push(eq(domains.status, params.status));
  }
  if (params.tld && params.tld !== "all") {
    predicates.push(eq(domains.tld, params.tld));
  }
  if (params.minGrowth !== null && params.minGrowth !== undefined && Number.isFinite(params.minGrowth)) {
    predicates.push(gte(domains.predicted12mGrowthPct, params.minGrowth));
  }
  if (params.q && params.q.trim().length > 0) {
    predicates.push(ilike(domains.fqdn, `%${params.q.trim().toLowerCase()}%`));
  }
  if (params.pattern && params.pattern.trim().length > 0) {
    predicates.push(
      sql`EXISTS (SELECT 1 FROM domain_patterns dp WHERE dp.domain_id = ${domains.id} AND dp.pattern_key = ${params.pattern.trim()})`
    );
  }

  let hasKeysetPredicate = false;
  if (params.cursor) {
    hasKeysetPredicate = true;
    const keyset = or(
      lt(domains.predicted12mGrowthPct, params.cursor.sortValue),
      and(
        eq(domains.predicted12mGrowthPct, params.cursor.sortValue),
        lt(domains.id, params.cursor.id)
      )
    );
    if (keyset) predicates.push(keyset);
  }

  const limit = Math.max(1, Math.min(params.limit ?? 50, 100));

  return {
    where: predicates.length > 0 ? and(...predicates) : undefined,
    limit,
    hasKeysetPredicate,
    usesOffset: false,
  };
}
