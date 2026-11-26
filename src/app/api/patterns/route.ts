import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { patterns } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tld = searchParams.get("tld");
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") ?? 50), 200));

  const db = createDb();
  const items = await db
    .select()
    .from(patterns)
    .where(tld && tld !== "all" ? eq(patterns.tld, tld) : undefined)
    .orderBy(desc(patterns.momentumScore))
    .limit(limit);

  return NextResponse.json({ items });
}
