import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { verifyCronSecret } from "@/lib/auth/cron";
import { processWorkerTick } from "@/lib/worker/claim-and-process";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createDb();
  const result = await processWorkerTick(db, {
    budgetMs: 240_000,
    batchSize: 40,
  });

  return NextResponse.json(result);
}
