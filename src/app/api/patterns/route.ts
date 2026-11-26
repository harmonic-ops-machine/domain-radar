import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { patterns } from "@/db/schema";

import { sanitizeLimit } from "@/app/api/domains/query";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tld = searchParams.get("tld");
  const limitRaw = searchParams.get("limit");
  const limit = sanitizeLimit(limitRaw ? Number(limitRaw) : undefined, 50, 200);

  const db = createDb();
  const items = await db
    .select()
    .from(patterns)
    .where(tld && tld !== "all" ? eq(patterns.tld, tld) : undefined)
    .orderBy(desc(patterns.momentumScore))
    .limit(limit);

  return NextResponse.json({ items });
}
