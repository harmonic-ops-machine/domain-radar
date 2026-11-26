import { describe, expect, it, vi } from "vitest";
import { probeDomain } from "@/lib/prober/probe-domain";
import { RegistryRateGuard } from "@/lib/prober/rdap";

describe("2-stage DNS + authoritative RDAP prober", () => {
  it("skips RDAP when DNS NS exists and cached RDAP is fresh (< 7 days)", async () => {
    const fetchFn = vi.fn();
    const out = await probeDomain(
      {
        fqdn: "example.com",
        tld: ".com",
        previousStatus: "registered",
        lastRdapAt: new Date(),
      },
      {
        dnsResolveNs: async () => ["ns1.example.com"],
        fetchFn,
        guard: new RegistryRateGuard(),
      }
    );
    expect(out.status).toBe("registered");
    expect(out.source).toBe("dns_cached");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("marks available ONLY on authoritative RDAP 404 when DNS returns NXDOMAIN", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const out = await probeDomain(
      {
        fqdn: "truthcipher.com",
        tld: ".com",
        previousStatus: "unknown",
        lastRdapAt: null,
      },
      {
        dnsResolveNs: async () => {
          const err = Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
          throw err;
        },
        fetchFn,
        guard: new RegistryRateGuard(),
      }
    );
    expect(out.status).toBe("available");
    expect(out.changed).toBe(true);
    expect(out.source).toBe("rdap");
  });

  it("preserves prior status and opens per-registry circuit breaker on HTTP 429 or DNS SERVFAIL", async () => {
    const guard = new RegistryRateGuard({ defaultCooldownMs: 60_000 });
    const fetch429 = vi.fn().mockResolvedValue(
      new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "90" },
      })
    );
    const first = await probeDomain(
      {
        fqdn: "truthreal.ai",
        tld: ".ai",
        previousStatus: "registered",
        lastRdapAt: null,
      },
      {
        dnsResolveNs: async () => {
          throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
        },
        fetchFn: fetch429,
        guard,
      }
    );
    expect(first.status).toBe("registered");
    expect(first.changed).toBe(false);
    expect(first.source).toBe("error_preserved");
    expect(first.retryAfterSeconds).toBe(90);

    const second = await probeDomain(
      {
        fqdn: "realledger.ai",
        tld: ".ai",
        previousStatus: "available",
        lastRdapAt: null,
      },
      {
        dnsResolveNs: async () => {
          throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
        },
        fetchFn: fetch429,
        guard,
      }
    );
    expect(second.status).toBe("available");
    expect(second.errorCode).toBe("CIRCUIT_OPEN");
    expect(fetch429).toHaveBeenCalledTimes(1);
  });

  it("clamps abusive Retry-After values to at most 3600 seconds", async () => {
    const guard = new RegistryRateGuard();
    const fetchHuge = vi.fn().mockResolvedValue(
      new Response("slow down", {
        status: 429,
        headers: { "Retry-After": "9999999" },
      })
    );
    const out = await probeDomain(
      { fqdn: "truthreal.io", tld: ".io", previousStatus: "unknown", lastRdapAt: null },
      {
        dnsResolveNs: async () => {
          throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
        },
        fetchFn: fetchHuge,
        guard,
      }
    );
    expect(out.retryAfterSeconds).toBeLessThanOrEqual(3600);
  });

  it("uses authoritative WHOIS fallback for .co instead of broken RDAP 404 stub", async () => {
    const fetchFn = vi.fn();
    const whoisFn = vi
      .fn()
      .mockResolvedValueOnce(
        "Domain Name: T.CO\r\nRegistry Expiry Date: 2027-04-25T23:59:59.0Z\r\nRegistrar: CSC Corporate Domains\r\nAccess to the Whois and RDAP services is rate limited.\r\n"
      )
      .mockResolvedValueOnce("The queried object does not exist: DOMAIN NOT FOUND\r\n");

    const reg = await probeDomain(
      { fqdn: "t.co", tld: ".co", previousStatus: "unknown", lastRdapAt: null },
      {
        dnsResolveNs: async () => ["ns1.t.co"],
        fetchFn,
        whoisFn,
        guard: new RegistryRateGuard(),
      }
    );
    expect(reg.status).toBe("registered");
    expect(reg.registrar).toBe("CSC Corporate Domains");
    expect(fetchFn).not.toHaveBeenCalled();

    const avail = await probeDomain(
      { fqdn: "zz-unregistered.co", tld: ".co", previousStatus: "unknown", lastRdapAt: null },
      {
        dnsResolveNs: async () => {
          throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
        },
        fetchFn,
        whoisFn,
        guard: new RegistryRateGuard(),
      }
    );
    expect(avail.status).toBe("available");
    expect(avail.changed).toBe(true);
    expect(whoisFn).toHaveBeenCalledTimes(2);
  });
});
