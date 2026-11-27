import { and, eq, gte, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { domains } from "@/db/schema";
import type { DomainCursor } from "@/lib/types";

export const NULL_GROWTH_SENTINEL = -999999;
export const NULL_VALUE_SENTINEL = -1;

export type DomainSortMode = "growth" | "value";

export interface DomainFilterParams {
  status?: string | null;
  tld?: string | null;
  pattern?: string | null;
  minGrowth?: number | null;
  minValue?: number | null;
  verifiedOnly?: boolean;
  sort?: DomainSortMode;
  q?: string | null;
  cursor?: DomainCursor | null;
  limit?: number;
}

export interface DomainQuerySpec {
  where: SQL | undefined;
  limit: number;
  sort: DomainSortMode;
  hasKeysetPredicate: boolean;
  usesOffset: false;
  nullSafeSort: true;
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

export function sanitizeLimit(raw: number | undefined, fallback = 50, max = 100): number {
  if (raw === undefined || !Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.min(Math.floor(raw), max));
}

export function buildDomainWhereClause(
  params: DomainFilterParams
): DomainQuerySpec {
  const predicates: SQL[] = [];
  const sort: DomainSortMode = params.sort === "value" ? "value" : "growth";

  if (params.status === "expensive") {
    const cond = or(
      inArray(domains.status, ["registered", "grace", "redemption"]),
      gte(domains.estimatedValueUsd, 2000)
    );
    if (cond) predicates.push(cond);
  } else if (params.status && params.status !== "all") {
    predicates.push(eq(domains.status, params.status));
  }

  if (params.verifiedOnly) {
    predicates.push(isNotNull(domains.lastCheckedAt));
  }

  if (params.tld && params.tld !== "all") {
    predicates.push(eq(domains.tld, params.tld));
  }
  if (
    params.minGrowth !== null &&
    params.minGrowth !== undefined &&
    Number.isFinite(params.minGrowth)
  ) {
    predicates.push(gte(domains.predicted12mGrowthPct, params.minGrowth));
  }
  if (
    params.minValue !== null &&
    params.minValue !== undefined &&
    Number.isFinite(params.minValue)
  ) {
    predicates.push(gte(domains.estimatedValueUsd, params.minValue));
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
    const sortExpr =
      sort === "value"
        ? sql`COALESCE(${domains.estimatedValueUsd}, ${NULL_VALUE_SENTINEL})`
        : sql`COALESCE(${domains.predicted12mGrowthPct}, ${NULL_GROWTH_SENTINEL})`;
    predicates.push(
      sql`(${sortExpr} < ${params.cursor.sortValue} OR (${sortExpr} = ${params.cursor.sortValue} AND ${domains.id} < ${params.cursor.id}))`
    );
  }

  const limit = sanitizeLimit(params.limit, 50, 100);

  return {
    where: predicates.length > 0 ? and(...predicates) : undefined,
    limit,
    sort,
    hasKeysetPredicate,
    usesOffset: false,
    nullSafeSort: true,
  };
}
