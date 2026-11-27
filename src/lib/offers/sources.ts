import { calculateFiveYearTco } from "@/lib/pricing/tco";
import { RDAP_ENDPOINTS, WHOIS_FALLBACK_HOSTS } from "@/lib/prober/endpoints";
import type { TldCode } from "@/lib/types";

export interface DomainOfferLink {
  source: string;
  kind: "registrar" | "aftermarket" | "backorder";
  actionLabel: string;
  url: string;
  priceLabel: string;
  fiveYrLabel?: string;
  badge?: string;
}

const EXTRA_REGISTRAR_Y1: Record<TldCode, { spaceship: number; dynadot: number }> = {
  ".com": { spaceship: 9.08, dynadot: 10.19 },
  ".net": { spaceship: 11.48, dynadot: 11.99 },
  ".org": { spaceship: 8.98, dynadot: 10.99 },
  ".ai": { spaceship: 69.98, dynadot: 74.99 },
  ".io": { spaceship: 32.98, dynadot: 38.99 },
  ".co": { spaceship: 11.98, dynadot: 14.99 },
  ".app": { spaceship: 13.98, dynadot: 15.99 },
  ".dev": { spaceship: 12.98, dynadot: 14.99 },
};

export function getVerificationProofUrl(fqdn: string, tld: TldCode): {
  label: string;
  url: string;
} {
  const whoisHost = WHOIS_FALLBACK_HOSTS[tld];
  if (whoisHost) {
    return {
      label: `WHOIS (${whoisHost})`,
      url: `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(fqdn)}`,
    };
  }
  const rdapUrl = RDAP_ENDPOINTS[tld]?.replace("{fqdn}", encodeURIComponent(fqdn));
  return {
    label: "Live Registry RDAP",
    url: rdapUrl || `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(fqdn)}`,
  };
}

export function buildDomainOfferLinks(input: {
  fqdn: string;
  tld: TldCode;
  status: string;
  estimatedValueUsd?: number | null;
}): DomainOfferLink[] {
  const fqdnEnc = encodeURIComponent(input.fqdn);
  const sld = input.fqdn.split(".")[0] ?? input.fqdn;

  if (input.status === "available") {
    const cf = calculateFiveYearTco(input.tld, { registrar: "cloudflare" });
    const pb = calculateFiveYearTco(input.tld, { registrar: "porkbun" });
    const nc = calculateFiveYearTco(input.tld, { registrar: "namecheap" });
    const extra = EXTRA_REGISTRAR_Y1[input.tld] ?? { spaceship: 12, dynadot: 14 };

    return [
      {
        source: "Porkbun",
        kind: "registrar",
        actionLabel: "Buy on Porkbun",
        url: `https://porkbun.com/checkout/search?q=${fqdnEnc}`,
        priceLabel: `$${pb.year1Usd.toFixed(2)}/yr`,
        fiveYrLabel: `$${pb.fiveYrTotalUsd.toFixed(2)} / 5yr`,
        badge: "Direct Checkout",
      },
      {
        source: "Cloudflare",
        kind: "registrar",
        actionLabel: "Register At-Cost",
        url: `https://domains.cloudflare.com/?domain=${fqdnEnc}`,
        priceLabel: `$${cf.year1Usd.toFixed(2)}/yr`,
        fiveYrLabel: `$${cf.fiveYrTotalUsd.toFixed(2)} / 5yr`,
        badge: "Wholesale",
      },
      {
        source: "Namecheap",
        kind: "registrar",
        actionLabel: "Check Namecheap",
        url: `https://www.namecheap.com/domains/registration/results/?domain=${fqdnEnc}`,
        priceLabel: `$${nc.year1Usd.toFixed(2)}/yr`,
        fiveYrLabel: `$${nc.fiveYrTotalUsd.toFixed(2)} / 5yr`,
      },
      {
        source: "Spaceship",
        kind: "registrar",
        actionLabel: "Buy on Spaceship",
        url: `https://www.spaceship.com/domain-search/?query=${fqdnEnc}`,
        priceLabel: `~$${extra.spaceship.toFixed(2)}/yr`,
        badge: "Low Promo",
      },
      {
        source: "Dynadot",
        kind: "registrar",
        actionLabel: "Buy on Dynadot",
        url: `https://www.dynadot.com/domain/search?domain=${fqdnEnc}`,
        priceLabel: `~$${extra.dynadot.toFixed(2)}/yr`,
      },
    ];
  }

  const est = input.estimatedValueUsd ?? 0;
  const estLabel =
    est >= 1_000_000
      ? `~$${(est / 1_000_000).toFixed(1)}M est`
      : est >= 1_000
      ? `~$${Math.round(est / 1000)}k est`
      : est > 0
      ? `~$${Math.round(est)} est`
      : "Make Offer";

  const offers: DomainOfferLink[] = [
    {
      source: "Afternic",
      kind: "aftermarket",
      actionLabel: "Check BIN / Offer",
      url: `https://www.afternic.com/domain/${fqdnEnc}`,
      priceLabel: estLabel,
      badge: "Aftermarket",
    },
    {
      source: "Sedo",
      kind: "aftermarket",
      actionLabel: "Sedo Listing",
      url: `https://sedo.com/search/details/?domain=${fqdnEnc}`,
      priceLabel: "Make Offer",
      badge: "Global Broker",
    },
    {
      source: "GoDaddy",
      kind: "aftermarket",
      actionLabel: "Broker / Auction",
      url: `https://www.godaddy.com/domainsearch/find?domainToCheck=${fqdnEnc}`,
      priceLabel: "Broker Service",
    },
    {
      source: "Atom",
      kind: "aftermarket",
      actionLabel: "Brandable Market",
      url: `https://www.atom.com/name/${encodeURIComponent(sld)}`,
      priceLabel: "Premium Check",
    },
    {
      source: "DropCatch",
      kind: "backorder",
      actionLabel:
        input.status === "grace" || input.status === "redemption"
          ? "Backorder Drop"
          : "Watch / Backorder",
      url: `https://www.dropcatch.com/domain/${fqdnEnc}`,
      priceLabel: "$59+ Backorder",
      badge:
        input.status === "grace" || input.status === "redemption"
          ? "Expiring Soon"
          : undefined,
    },
  ];

  return offers;
}
