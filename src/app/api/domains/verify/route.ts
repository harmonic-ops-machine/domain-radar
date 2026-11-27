import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDb } from "@/db";
import { domainSnapshots, domains } from "@/db/schema";
import { probeDomain } from "@/lib/prober/probe-domain";
import { RegistryRateGuard } from "@/lib/prober/rdap";
import type { DomainStatus, TldCode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const verifyBodySchema = z.object({
  fqdn: z.string().trim().min(3).max(253),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = verifyBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid fqdn" }, { status: 400 });
    }

    const fqdn = parsed.data.fqdn.toLowerCase();
    const db = createDb();
    const [row] = await db
      .select()
      .from(domains)
      .where(eq(domains.fqdn, fqdn))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const now = new Date();
    const guard = new RegistryRateGuard();
    const outcome = await probeDomain(
      {
        fqdn: row.fqdn,
        tld: row.tld as TldCode,
        previousStatus: row.status as DomainStatus,
        // Force fresh authoritative RDAP/WHOIS on manual user verification
        lastRdapAt: null,
      },
      { guard, nowFn: () => now }
    );

    const clearReg = outcome.source === "rdap" && outcome.status === "available";
    const isError = outcome.source === "error_preserved";

    await db
      .update(domains)
      .set({
        status: outcome.status,
        registrar: clearReg ? null : (outcome.registrar ?? row.registrar),
        expiresAt: clearReg ? null : (outcome.expiresAt ?? row.expiresAt),
        lastCheckedAt: now,
        lastRdapAt: outcome.source === "rdap" ? now : row.lastRdapAt,
        consecutiveErrors: isError ? row.consecutiveErrors + 1 : 0,
        lastError: outcome.errorCode,
        updatedAt: now,
      })
      .where(eq(domains.id, row.id));

    if (!isError) {
      await db.insert(domainSnapshots).values({
        domainId: row.id,
        observedAt: now,
        status: outcome.status,
        registrar: clearReg ? null : outcome.registrar,
        expiresAt: clearReg ? null : outcome.expiresAt,
        source: outcome.source,
        changeReason: outcome.changed ? "manual_verify_change" : "manual_verify",
      });
    }

    return NextResponse.json({
      id: row.id,
      fqdn: row.fqdn,
      status: outcome.status,
      previousStatus: outcome.previousStatus,
      changed: outcome.changed,
      source: outcome.source,
      registrar: clearReg ? null : (outcome.registrar ?? row.registrar),
      expiresAt: (clearReg ? null : (outcome.expiresAt ?? row.expiresAt))?.toISOString() ?? null,
      lastCheckedAt: now.toISOString(),
      errorCode: outcome.errorCode,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
