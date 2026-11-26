import { NextResponse } from "next/server";
import { z } from "zod";
import { createDb } from "@/db";
import { marketSignals } from "@/db/schema";
import { verifyCronSecret } from "@/lib/auth/cron";

export const dynamic = "force-dynamic";

const SignalItemSchema = z.object({
  signalType: z.enum(["comp_sale", "keyword_trend", "registry_price"]),
  key: z.string().min(1).max(200),
  tld: z.string().max(16).optional().nullable(),
  numericValue: z.number().finite(),
  observedAt: z.string().datetime().optional(),
  source: z.string().min(1).max(120),
  metadata: z.record(z.unknown()).optional(),
});

const SignalBatchSchema = z.array(SignalItemSchema).min(1).max(5_000);

export async function POST(req: Request) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SignalBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = createDb();
  const CHUNK = 500;
  for (let i = 0; i < parsed.data.length; i += CHUNK) {
    const slice = parsed.data.slice(i, i + CHUNK).map((item) => ({
      signalType: item.signalType,
      key: item.key,
      tld: item.tld ?? null,
      numericValue: item.numericValue,
      observedAt: item.observedAt ? new Date(item.observedAt) : new Date(),
      source: item.source,
      metadata: item.metadata ?? null,
    }));
    await db.insert(marketSignals).values(slice);
  }

  return NextResponse.json({ imported: parsed.data.length });
}
