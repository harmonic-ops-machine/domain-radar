import { NextResponse } from "next/server";
import { createDb } from "@/db";
import { verifyCronSecret } from "@/lib/auth/cron";
import { refreshAllPatternMetrics } from "@/lib/patterns/tracker";
import { recomputePredictionsBatch } from "@/lib/predictor/model";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createDb();
    const { patternsUpdated } = await refreshAllPatternMetrics(db);
    const { scored, stoppedForBudget } = await recomputePredictionsBatch(db, {
      chunkSize: 500,
      budgetMs: 240_000,
    });
    return NextResponse.json({ patternsUpdated, scored, stoppedForBudget });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Pattern refresh failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
