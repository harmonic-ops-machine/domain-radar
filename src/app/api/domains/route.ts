import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { domains } from "@/db/schema";
import {
  buildDomainWhereClause,
  decodeCursor,
  encodeCursor,
  NULL_GROWTH_SENTINEL,
  NULL_VALUE_SENTINEL,
  type DomainSortMode,
} from "./query";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tld = searchParams.get("tld");
  const pattern = searchParams.get("pattern");
  const q = searchParams.get("q");
  const sortRaw = searchParams.get("sort");
  const sort: DomainSortMode = sortRaw === "value" ? "value" : "growth";
  const verifiedOnly = searchParams.get("verifiedOnly") === "true";
  const minGrowthRaw = searchParams.get("minGrowth");
  const minGrowth =
    minGrowthRaw !== null && minGrowthRaw !== "" ? Number(minGrowthRaw) : null;
  const minValueRaw = searchParams.get("minValue");
  const minValue =
    minValueRaw !== null && minValueRaw !== "" ? Number(minValueRaw) : null;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;
  const cursor = decodeCursor(searchParams.get("cursor"));

  const spec = buildDomainWhereClause({
    status,
    tld,
    pattern,
    minGrowth,
    minValue,
    verifiedOnly,
    sort,
    q,
    cursor,
    limit,
  });

  const db = createDb();
  const orderExpr =
    spec.sort === "value"
      ? sql`COALESCE(${domains.estimatedValueUsd}, ${NULL_VALUE_SENTINEL}) DESC`
      : sql`COALESCE(${domains.predicted12mGrowthPct}, ${NULL_GROWTH_SENTINEL}) DESC`;

  const rows = await db
    .select({
      id: domains.id,
      fqdn: domains.fqdn,
      sld: domains.sld,
      tld: domains.tld,
      length: domains.length,
      tokens: domains.tokens,
      archetype: domains.archetype,
      status: domains.status,
      tier: domains.tier,
      registrar: domains.registrar,
      expiresAt: domains.expiresAt,
      lastCheckedAt: domains.lastCheckedAt,
      fiveYrTcoUsd: domains.fiveYrTcoUsd,
      estimatedValueUsd: domains.estimatedValueUsd,
      predicted12mGrowthPct: domains.predicted12mGrowthPct,
      net5yrRoiMultiple: domains.net5yrRoiMultiple,
      confidence: domains.confidence,
      topDrivers: domains.topDrivers,
      watched: domains.watched,
    })
    .from(domains)
    .where(spec.where)
    .orderBy(orderExpr, desc(domains.id))
    .limit(spec.limit + 1);

  const hasMore = rows.length > spec.limit;
  const items = hasMore ? rows.slice(0, spec.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue:
            spec.sort === "value"
              ? (last.estimatedValueUsd ?? NULL_VALUE_SENTINEL)
              : (last.predicted12mGrowthPct ?? NULL_GROWTH_SENTINEL),
          id: last.id,
        })
      : null;

  const countRes = await db.execute(
    sql`SELECT reltuples::bigint AS approx FROM pg_class WHERE relname = 'domains'`
  );
  const approxRow = (
    countRes as unknown as { rows?: Array<{ approx?: string | number }> }
  ).rows?.[0];
  const approxNum = Number(approxRow?.approx ?? -1);
  const totalApprox = approxNum >= 0 ? approxNum : items.length;

  return NextResponse.json({
    items,
    nextCursor,
    totalApprox,
  });
}
