import dns from "node:dns/promises";

export type DnsResolver = (fqdn: string) => Promise<string[]>;

export interface DnsCheckResult {
  delegated: boolean;
  transientError: boolean;
  errorCode: string | null;
}

const DEFAULT_DNS_TIMEOUT_MS = 2_000;

export async function checkDnsDelegation(
  fqdn: string,
  resolver: DnsResolver = (host) => dns.resolveNs(host),
  timeoutMs: number = DEFAULT_DNS_TIMEOUT_MS
): Promise<DnsCheckResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      resolver(fqdn),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error("ETIMEOUT"), { code: "ETIMEOUT" }));
        }, timeoutMs);
      }),
    ]);
    return {
      delegated: Array.isArray(records) && records.length > 0,
      transientError: false,
      errorCode: null,
    };
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "DNS_ERROR";
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      return {
        delegated: false,
        transientError: false,
        errorCode: code,
      };
    }
    return {
      delegated: false,
      transientError: true,
      errorCode: code,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
