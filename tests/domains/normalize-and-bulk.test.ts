import { describe, expect, it, vi } from "vitest";
import { normalizeDomain } from "@/lib/domains/normalize";
import { bulkUpsertDomains, MAX_CHUNK_SIZE } from "@/lib/domains/bulk-upsert";

describe("domain normalization & 100k chunked bulk upsert", () => {
  it("normalizes casing/whitespace and rejects invalid or unsupported TLDs", () => {
    expect(normalizeDomain("  TruthLedger.AI. ")).toEqual({
      fqdn: "truthledger.ai",
      sld: "truthledger",
      tld: ".ai",
      length: 11,
      hasHyphen: false,
      hasDigit: false,
    });
    expect(normalizeDomain("-bad-.com")).toBeNull();
    expect(normalizeDomain("foo.unsupportedtld")).toBeNull();
    expect(normalizeDomain("sub.domain.com")).toBeNull();
  });

  it("splits 2,350 domains into 500-row chunks and deduplicates before DB writes", async () => {
    const insertedChunks: number[] = [];
    const fakeDb = {
      insert: vi.fn(() => ({
        values: vi.fn((rows: unknown[]) => {
          insertedChunks.push(rows.length);
          return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
        }),
      })),
    };
    const raw = [
      ...Array.from({ length: 2350 }, (_, i) => `truthnode${i}.com`),
      "TRUTHNODE0.COM",
      "invalid..com",
    ];
    const result = await bulkUpsertDomains(fakeDb as never, raw, {
      chunkSize: MAX_CHUNK_SIZE,
    });
    expect(MAX_CHUNK_SIZE).toBe(500);
    expect(insertedChunks).toEqual([500, 500, 500, 500, 350]);
    expect(result).toEqual({
      accepted: 2350,
      duplicatesRemoved: 1,
      invalidRejected: 1,
      chunksWritten: 5,
    });
  });
});
