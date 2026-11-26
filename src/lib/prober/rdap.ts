import net from "node:net";
import type { DomainStatus, TldCode } from "@/lib/types";

export const RDAP_ENDPOINTS: Record<TldCode, string> = {
  ".com": "https://rdap.verisign.com/com/v1/domain/{fqdn}",
  ".net": "https://rdap.verisign.com/net/v1/domain/{fqdn}",
  ".org": "https://rdap.publicinterestregistry.org/rdap/domain/{fqdn}",
  ".ai": "https://rdap.identitydigital.services/rdap/domain/{fqdn}",
  ".io": "https://rdap.identitydigital.services/rdap/domain/{fqdn}",
  ".co": "https://rdap.registry.co/domain/{fqdn}",
  ".app": "https://pubapi.registry.google/rdap/domain/{fqdn}",
  ".dev": "https://pubapi.registry.google/rdap/domain/{fqdn}",
};

/**
 * ccTLDs whose public RDAP endpoint is absent or returns 404 stubs even for
 * registered domains use their authoritative TCP/43 registry WHOIS host instead.
 */
export const WHOIS_FALLBACK_HOSTS: Partial<Record<TldCode, string>> = {
  ".co": "whois.registry.co",
};

export type WhoisResolver = (
  host: string,
  fqdn: string,
  timeoutMs: number
) => Promise<string>;

function defaultWhoisQuery(
  host: string,
  fqdn: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: 43 }, () => {
      socket.write(`${fqdn}\r\n`);
    });
    let body = "";
    socket.setEncoding("utf8");
    socket.setTimeout(timeoutMs, () => {
      socket.destroy(Object.assign(new Error("WHOIS_TIMEOUT"), { code: "WHOIS_TIMEOUT" }));
    });
    socket.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) {
        socket.destroy();
      }
    });
    socket.on("end", () => resolve(body));
    socket.on("error", (err) => reject(err));
  });
}

function parseWhoisBody(body: string): RdapCheckResult {
  if (/^Domain Name:\s*.+/im.test(body)) {
    let status: DomainStatus = "registered";
    const statusMatches = body.match(/^Domain Status:.*$/gim) ?? [];
    const lowerStatuses = statusMatches.map((line) => line.toLowerCase());
    if (lowerStatuses.some((s) => s.includes("redemption"))) {
      status = "redemption";
    } else if (lowerStatuses.some((s) => s.includes("renewperiod") || s.includes("grace"))) {
      status = "grace";
    }

    const registrarMatch = body.match(/^Registrar:\s*(.+)$/im);
    const registrar = registrarMatch ? registrarMatch[1].trim() : null;

    const expiryMatch = body.match(/^Registry Expiry Date:\s*(.+)$/im);
    let expiresAt: Date | null = null;
    if (expiryMatch) {
      const parsed = new Date(expiryMatch[1].trim());
      if (!Number.isNaN(parsed.getTime())) {
        expiresAt = parsed;
      }
    }

    return {
      ok: true,
      status,
      registrar,
      expiresAt,
      httpStatus: null,
      errorCode: null,
      retryAfterSeconds: null,
    };
  }
  if (/DOMAIN NOT FOUND|No Data Found|object does not exist/i.test(body)) {
    return {
      ok: true,
      status: "available",
      registrar: null,
      expiresAt: null,
      httpStatus: null,
      errorCode: null,
      retryAfterSeconds: null,
    };
  }
  if (/quota\s*exceeded|too\s*many\s*requests|limit\s*exceeded|rate\s*limit/i.test(body)) {
    return {
      ok: false,
      status: null,
      registrar: null,
      expiresAt: null,
      httpStatus: null,
      errorCode: "WHOIS_RATE_LIMIT",
      retryAfterSeconds: 60,
    };
  }
  return {
    ok: false,
    status: null,
    registrar: null,
    expiresAt: null,
    httpStatus: null,
    errorCode: "WHOIS_PARSE_ERROR",
    retryAfterSeconds: null,
  };
}

export interface RdapCheckResult {
  ok: boolean;
  status: DomainStatus | null;
  registrar: string | null;
  expiresAt: Date | null;
  httpStatus: number | null;
  errorCode: string | null;
  retryAfterSeconds: number | null;
}

export class RegistryRateGuard {
  private readonly maxConcurrentPerHost: number;
  private readonly defaultCooldownMs: number;
  private readonly nowFn: () => number;
  private readonly inFlight = new Map<string, number>();
  private readonly cooldownUntil = new Map<string, number>();

  constructor(opts?: {
    maxConcurrentPerHost?: number;
    defaultCooldownMs?: number;
    nowFn?: () => number;
  }) {
    this.maxConcurrentPerHost = opts?.maxConcurrentPerHost ?? 4;
    this.defaultCooldownMs = opts?.defaultCooldownMs ?? 60_000;
    this.nowFn = opts?.nowFn ?? (() => Date.now());
  }

  getRemainingCooldownSeconds(host: string): number {
    const until = this.cooldownUntil.get(host) ?? 0;
    const remMs = until - this.nowFn();
    return remMs > 0 ? Math.ceil(remMs / 1000) : 0;
  }

  tripCooldown(host: string, retryAfterSeconds?: number | null): void {
    const ms =
      retryAfterSeconds && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : this.defaultCooldownMs;
    this.cooldownUntil.set(host, this.nowFn() + ms);
  }

  tryAcquire(host: string): { acquired: boolean; reason?: string; retryAfterSeconds?: number } {
    const remSec = this.getRemainingCooldownSeconds(host);
    if (remSec > 0) {
      return { acquired: false, reason: "CIRCUIT_OPEN", retryAfterSeconds: remSec };
    }
    const current = this.inFlight.get(host) ?? 0;
    if (current >= this.maxConcurrentPerHost) {
      return { acquired: false, reason: "HOST_CONCURRENCY_CAP", retryAfterSeconds: 5 };
    }
    this.inFlight.set(host, current + 1);
    return { acquired: true };
  }

  release(host: string): void {
    const current = this.inFlight.get(host) ?? 0;
    if (current <= 1) {
      this.inFlight.delete(host);
    } else {
      this.inFlight.set(host, current - 1);
    }
  }
}

function parseRdapBody(body: Record<string, unknown>): {
  status: DomainStatus;
  registrar: string | null;
  expiresAt: Date | null;
} {
  const statuses = Array.isArray(body.status)
    ? body.status.map((s) => String(s).toLowerCase())
    : [];

  let status: DomainStatus = "registered";
  if (statuses.some((s) => s.includes("redemption"))) {
    status = "redemption";
  } else if (statuses.some((s) => s.includes("renewperiod") || s.includes("grace"))) {
    status = "grace";
  }

  let expiresAt: Date | null = null;
  if (Array.isArray(body.events)) {
    for (const ev of body.events as Array<Record<string, unknown>>) {
      if (ev.eventAction === "expiration" && typeof ev.eventDate === "string") {
        const parsed = new Date(ev.eventDate);
        if (!Number.isNaN(parsed.getTime())) {
          expiresAt = parsed;
        }
      }
    }
  }

  let registrar: string | null = null;
  if (Array.isArray(body.entities)) {
    for (const ent of body.entities as Array<Record<string, unknown>>) {
      const roles = Array.isArray(ent.roles) ? ent.roles.map(String) : [];
      if (!roles.includes("registrar")) continue;
      const vcard = ent.vcardArray;
      if (Array.isArray(vcard) && Array.isArray(vcard[1])) {
        for (const prop of vcard[1] as Array<unknown[]>) {
          if (prop[0] === "fn" && typeof prop[3] === "string") {
            registrar = prop[3];
            break;
          }
        }
      }
      if (registrar) break;
    }
  }

  return { status, registrar, expiresAt };
}

export async function queryRdap(
  fqdn: string,
  tld: TldCode,
  opts: {
    fetchFn?: typeof fetch;
    whoisFn?: WhoisResolver;
    guard: RegistryRateGuard;
    timeoutMs?: number;
  }
): Promise<RdapCheckResult> {
  const whoisHost = WHOIS_FALLBACK_HOSTS[tld];
  if (whoisHost) {
    const slot = opts.guard.tryAcquire(whoisHost);
    if (!slot.acquired) {
      return {
        ok: false,
        status: null,
        registrar: null,
        expiresAt: null,
        httpStatus: null,
        errorCode: slot.reason ?? "CIRCUIT_OPEN",
        retryAfterSeconds: slot.retryAfterSeconds ?? 60,
      };
    }
    try {
      const whoisFn = opts.whoisFn ?? defaultWhoisQuery;
      const raw = await whoisFn(whoisHost, fqdn, opts.timeoutMs ?? 4_000);
      const parsed = parseWhoisBody(raw);
      if (parsed.errorCode === "WHOIS_RATE_LIMIT") {
        opts.guard.tripCooldown(whoisHost, parsed.retryAfterSeconds ?? 60);
      }
      return parsed;
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : "WHOIS_NETWORK_ERROR";
      return {
        ok: false,
        status: null,
        registrar: null,
        expiresAt: null,
        httpStatus: null,
        errorCode: code === "WHOIS_TIMEOUT" ? "WHOIS_TIMEOUT" : "WHOIS_NETWORK_ERROR",
        retryAfterSeconds: null,
      };
    } finally {
      opts.guard.release(whoisHost);
    }
  }

  const url = RDAP_ENDPOINTS[tld].replace("{fqdn}", encodeURIComponent(fqdn));
  const host = new URL(url).host;
  const slot = opts.guard.tryAcquire(host);
  if (!slot.acquired) {
    return {
      ok: false,
      status: null,
      registrar: null,
      expiresAt: null,
      httpStatus: null,
      errorCode: slot.reason ?? "CIRCUIT_OPEN",
      retryAfterSeconds: slot.retryAfterSeconds ?? 60,
    };
  }

  const fetchFn = opts.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4_000);

  try {
    const res = await fetchFn(url, {
      headers: {
        Accept: "application/rdap+json, application/json",
        "User-Agent": "domain-radar/1.0",
      },
      signal: controller.signal,
    });

    if (res.status === 404) {
      return {
        ok: true,
        status: "available",
        registrar: null,
        expiresAt: null,
        httpStatus: 404,
        errorCode: null,
        retryAfterSeconds: null,
      };
    }

    if (res.status === 429 || res.status === 503) {
      const header = res.headers.get("Retry-After")?.trim() ?? "";
      let retryAfterSeconds = 60;
      if (/^\d+$/.test(header)) {
        retryAfterSeconds = Number(header);
      } else if (header) {
        const parsedDate = Date.parse(header);
        if (!Number.isNaN(parsedDate)) {
          retryAfterSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
        }
      }
      retryAfterSeconds = Math.max(1, Math.min(3600, retryAfterSeconds));
      opts.guard.tripCooldown(host, retryAfterSeconds);
      return {
        ok: false,
        status: null,
        registrar: null,
        expiresAt: null,
        httpStatus: res.status,
        errorCode: `HTTP_${res.status}`,
        retryAfterSeconds,
      };
    }

    if (res.status >= 200 && res.status < 300) {
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // Non-JSON 2xx still confirms registered record
      }
      const parsed = parseRdapBody(body);
      return {
        ok: true,
        status: parsed.status,
        registrar: parsed.registrar,
        expiresAt: parsed.expiresAt,
        httpStatus: res.status,
        errorCode: null,
        retryAfterSeconds: null,
      };
    }

    return {
      ok: false,
      status: null,
      registrar: null,
      expiresAt: null,
      httpStatus: res.status,
      errorCode: `HTTP_${res.status}`,
      retryAfterSeconds: null,
    };
  } catch (err) {
    const isAbort =
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError";
    return {
      ok: false,
      status: null,
      registrar: null,
      expiresAt: null,
      httpStatus: null,
      errorCode: isAbort ? "RDAP_TIMEOUT" : "RDAP_NETWORK_ERROR",
      retryAfterSeconds: null,
    };
  } finally {
    clearTimeout(timer);
    opts.guard.release(host);
  }
}
