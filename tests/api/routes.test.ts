import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/auth/cron";
import {
  encodeCursor,
  decodeCursor,
  buildDomainWhereClause,
} from "@/app/api/domains/query";
import {
  GET as probeGet,
  maxDuration as probeMaxDuration,
} from "@/app/api/cron/probe/route";

describe("cron auth & keyset-paginated domain API", () => {
  it("rejects missing or mismatched CRON_SECRET with HTTP 401 and sets Fluid Compute maxDuration=300", async () => {
    process.env.CRON_SECRET = "super-secret-token-value";
    expect(probeMaxDuration).toBe(300);
    expect(
      verifyCronSecret(new Request("http://localhost/api/cron/probe"))
    ).toBe(false);
    expect(
      verifyCronSecret(
        new Request("http://localhost/api/cron/probe", {
          headers: { authorization: "Bearer wrong" },
        })
      )
    ).toBe(false);
    expect(
      verifyCronSecret(
        new Request("http://localhost/api/cron/probe", {
          headers: { authorization: "Bearer super-secret-token-value" },
        })
      )
    ).toBe(true);

    const res = await probeGet(new Request("http://localhost/api/cron/probe"));
    expect(res.status).toBe(401);
  });

  it("round-trips keyset cursor and rejects malformed cursors cleanly", () => {
    const token = encodeCursor({ sortValue: 42.75, id: 98123 });
    expect(decodeCursor(token)).toEqual({ sortValue: 42.75, id: 98123 });
    expect(decodeCursor("not-valid-base64!!!")).toBeNull();

    const spec = buildDomainWhereClause({
      status: "available",
      tld: ".ai",
      minGrowth: 20,
      cursor: { sortValue: 42.75, id: 98123 },
      limit: Number("abc"),
    });
    expect(spec.hasKeysetPredicate).toBe(true);
    expect(spec.usesOffset).toBe(false);
    expect(spec.limit).toBe(50);
    expect(spec.nullSafeSort).toBe(true);
  });
});
