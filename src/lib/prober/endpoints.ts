import type { TldCode } from "@/lib/types";

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
