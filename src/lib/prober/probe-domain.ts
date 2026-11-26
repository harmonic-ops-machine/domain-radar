import type { DomainStatus, TldCode } from "@/lib/types";
import { checkDnsDelegation, type DnsResolver } from "./dns";
import { queryRdap, type RegistryRateGuard } from "./rdap";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ProbeInput {
  fqdn: string;
  tld: TldCode;
  previousStatus: DomainStatus;
  lastRdapAt: Date | null;
}

export interface ProbeDeps {
  dnsResolveNs?: DnsResolver;
  fetchFn?: typeof fetch;
  guard: RegistryRateGuard;
  nowFn?: () => Date;
}

export interface ProbeOutcome {
  fqdn: string;
  status: DomainStatus;
  previousStatus: DomainStatus;
  changed: boolean;
  source: "dns_cached" | "rdap" | "error_preserved";
  registrar: string | null;
  expiresAt: Date | null;
  httpStatus: number | null;
  errorCode: string | null;
  retryAfterSeconds: number | null;
}

export async function probeDomain(
  input: ProbeInput,
  deps: ProbeDeps
): Promise<ProbeOutcome> {
  const now = deps.nowFn ? deps.nowFn() : new Date();
  const dnsRes = await checkDnsDelegation(input.fqdn, deps.dnsResolveNs);

  if (dnsRes.transientError) {
    return {
      fqdn: input.fqdn,
      status: input.previousStatus,
      previousStatus: input.previousStatus,
      changed: false,
      source: "error_preserved",
      registrar: null,
      expiresAt: null,
      httpStatus: null,
      errorCode: dnsRes.errorCode ?? "DNS_TRANSIENT_ERROR",
      retryAfterSeconds: null,
    };
  }

  const rdapFresh =
    input.lastRdapAt !== null &&
    now.getTime() - input.lastRdapAt.getTime() < SEVEN_DAYS_MS;

  if (dnsRes.delegated && input.previousStatus === "registered" && rdapFresh) {
    return {
      fqdn: input.fqdn,
      status: "registered",
      previousStatus: input.previousStatus,
      changed: false,
      source: "dns_cached",
      registrar: null,
      expiresAt: null,
      httpStatus: null,
      errorCode: null,
      retryAfterSeconds: null,
    };
  }

  const rdap = await queryRdap(input.fqdn, input.tld, {
    fetchFn: deps.fetchFn,
    guard: deps.guard,
  });

  if (!rdap.ok || rdap.status === null) {
    return {
      fqdn: input.fqdn,
      status: input.previousStatus,
      previousStatus: input.previousStatus,
      changed: false,
      source: "error_preserved",
      registrar: null,
      expiresAt: null,
      httpStatus: rdap.httpStatus,
      errorCode: rdap.errorCode ?? "RDAP_ERROR",
      retryAfterSeconds: rdap.retryAfterSeconds,
    };
  }

  return {
    fqdn: input.fqdn,
    status: rdap.status,
    previousStatus: input.previousStatus,
    changed: rdap.status !== input.previousStatus,
    source: "rdap",
    registrar: rdap.registrar,
    expiresAt: rdap.expiresAt,
    httpStatus: rdap.httpStatus,
    errorCode: null,
    retryAfterSeconds: null,
  };
}
