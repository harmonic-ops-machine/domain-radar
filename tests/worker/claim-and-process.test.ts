import { describe, expect, it, vi } from "vitest";
import { computeNextCheckAt, computeRefreshTier } from "@/lib/worker/scheduler";
import {
  buildClaimBatchSql,
  processWorkerTick,
} from "@/lib/worker/claim-and-process";

describe("tiered scheduler & lease-locked worker", () => {
  it("generates atomic SKIP LOCKED claim SQL that reclaims expired leases", () => {
    const sqlText = buildClaimBatchSql(40, 360_000);
    expect(sqlText).toContain("lease_until IS NULL OR lease_until < NOW()");
    expect(sqlText).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("computes 6h/24h/72h tiered cadences and exponential error backoff capped at 24h", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(
      computeNextCheckAt({ tier: "hot", consecutiveErrors: 0, now }).toISOString()
    ).toBe("2026-11-26T18:00:00.000Z");
    expect(
      computeNextCheckAt({ tier: "warm", consecutiveErrors: 0, now }).toISOString()
    ).toBe("2026-11-27T12:00:00.000Z");
    expect(
      computeNextCheckAt({ tier: "cold", consecutiveErrors: 0, now }).toISOString()
    ).toBe("2026-11-29T12:00:00.000Z");
    expect(
      computeNextCheckAt({ tier: "hot", consecutiveErrors: 1, now }).toISOString()
    ).toBe("2026-11-26T12:10:00.000Z");
    expect(
      computeNextCheckAt({ tier: "hot", consecutiveErrors: 20, now }).toISOString()
    ).toBe("2026-11-27T12:00:00.000Z");
    expect(
      computeRefreshTier({
        watched: false,
        changed: true,
        predicted12mGrowthPct: 5,
      })
    ).toBe("hot");
  });

  it("stops cleanly before the 240s Fluid Compute time budget and writes diff-only snapshots", async () => {
    let fakeNow = 1_000_000;
    const snapshotsWritten: unknown[] = [];
    const claimBatch = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 1,
          fqdn: "truthcipher.com",
          tld: ".com",
          status: "available",
          tier: "hot",
          consecutiveErrors: 0,
          lastRdapAt: null,
        },
        {
          id: 2,
          fqdn: "truthslate.com",
          tld: ".com",
          status: "available",
          tier: "hot",
          consecutiveErrors: 0,
          lastRdapAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 3,
          fqdn: "truthcrest.com",
          tld: ".com",
          status: "available",
          tier: "hot",
          consecutiveErrors: 0,
          lastRdapAt: null,
        },
      ]);

    const probeFn = vi.fn(async (d) => {
      fakeNow += 130_000;
      return {
        fqdn: d.fqdn,
        status: d.id === 1 ? "registered" : "available",
        previousStatus: d.status,
        changed: d.id === 1,
        source: "rdap" as const,
        registrar: d.id === 1 ? "Cloudflare" : null,
        expiresAt: null,
        httpStatus: d.id === 1 ? 200 : 404,
        errorCode: null,
        retryAfterSeconds: null,
      };
    });

    const result = await processWorkerTick({} as never, {
      budgetMs: 240_000,
      batchSize: 2,
      nowFn: () => fakeNow,
      claimBatchFn: claimBatch,
      probeFn: probeFn as never,
      commitBatchFn: async (outcomes) => {
        snapshotsWritten.push(...outcomes.filter((o) => o.outcome.changed));
      },
      recordRunFn: vi.fn().mockResolvedValue("run-uuid-1"),
    });

    expect(result.claimed).toBe(2);
    expect(result.changed).toBe(1);
    expect(result.stoppedForBudget).toBe(true);
    expect(claimBatch).toHaveBeenCalledTimes(1);
    expect(snapshotsWritten).toHaveLength(1);
  });
});
