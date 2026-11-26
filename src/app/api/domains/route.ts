import { desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { domains } from "@/db/schema";
import {
  buildDomainWhereClause,
  decodeCursor,
  encodeCursor,
} from "./query";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tld = searchParams.get("tld");
  const pattern = searchParams.get("pattern");
  const q = searchParams.get("q");
  const minGrowthRaw = searchParams.get("minGrowth");
  const minGrowth =
    minGrowthRaw !== null && minGrowthRaw !== "" ? Number(minGrowthRaw) : null;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;
  const cursor = decodeCursor(searchParams.get("cursor"));

  const spec = buildDomainWhereClause({
    status,
    tld,
    pattern,
    q,
    minGrowth,
    cursor,
    limit,
  });

  const db = createDb();
  const rows = await db
    .select()
    .from(domains)
    .where(spec.where)
    .orderBy(desc(domains.predicted12mGrowthPct), desc(domains.id))
    .limit(spec.limit + 1);

  const hasMore = rows.length > spec.limit;
  const items = hasMore ? rows.slice(0, spec.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          sortValue: last.predicted12mGrowthPct ?? 0,
          id: last.id,
        })
      : null;

  const countRes = await db.execute(
    sql`SELECT reltuples::bigint AS approx FROM pg_class WHERE relname = 'domains'`
  );
  const approxRow = (
    countRes as unknown as { rows?: Array<{ approx?: string | number }> }
  ).rows?.[0];
  const totalApprox = Number(approxRow?.approx ?? items.length);

  return NextResponse.json({
    items,
    nextCursor,
    totalApprox,
  });
}
