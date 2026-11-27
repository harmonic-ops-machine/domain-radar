import { calculateFiveYearTco } from "@/lib/pricing/tco";
import type { DomainStatus, TldCode } from "@/lib/types";

export interface DomainOffer {
  source: string;
  shortLabel: string;
  kind: "registrar" | "aftermarket";
  actionLabel: string;
  url: string;
  year1Usd: number | null;
  fiveYrTcoUsd: number | null;
  cheapest: boolean;
}

const SPACESHIP_PRICES: Record<TldCode, { y1: number; renew: number }> = {
  ".com": { y1: 9.08, renew: 10.68 },
  ".net": { y1: 11.48, renew: 12.68 },
  ".org": { y1: 7.48, renew: 10.98 },
  ".ai": { y1: 78.98, renew: 78.98 },
  ".io": { y1: 31.98, renew: 49.98 },
  ".co": { y1: 13.98, renew: 29.98 },
  ".app": { y1: 11.98, renew: 14.98 },
  ".dev": { y1: 10.98, renew: 12.98 },
};

export function buildDomainOffers(
  fqdn: string,
  tld: TldCode,
  status: DomainStatus | string,
  opts?: { annualInflation?: number }
): DomainOffer[] {
  const inflation = opts?.annualInflation ?? 0.03;
  const encoded = encodeURIComponent(fqdn);
  const sld = fqdn.split(".")[0] ?? fqdn;

  const cf = calculateFiveYearTco(tld, {
    registrar: "cloudflare",
    annualInflation: inflation,
  });
  const pb = calculateFiveYearTco(tld, {
    registrar: "porkbun",
    annualInflation: inflation,
  });
  const nc = calculateFiveYearTco(tld, {
    registrar: "namecheap",
    annualInflation: inflation,
  });

  const spBase = SPACESHIP_PRICES[tld] ?? SPACESHIP_PRICES[".com"];
  let mult = 0;
  for (let y = 1; y <= 4; y++) mult += (1 + inflation) ** y;
  const spFiveYr = Number((spBase.y1 + spBase.renew * mult).toFixed(2));

  const registrarOffers: DomainOffer[] = [
    {
      source: "Cloudflare Registrar",
      shortLabel: "CF",
      kind: "registrar",
      actionLabel: "Register at-cost",
      url: `https://domains.cloudflare.com/?domain=${encoded}`,
      year1Usd: cf.year1Usd,
      fiveYrTcoUsd: cf.fiveYrTotalUsd,
      cheapest: false,
    },
    {
      source: "Porkbun",
      shortLabel: "PB",
      kind: "registrar",
      actionLabel: "Register",
      url: `https://porkbun.com/checkout/search?q=${encoded}`,
      year1Usd: pb.year1Usd,
      fiveYrTcoUsd: pb.fiveYrTotalUsd,
      cheapest: false,
    },
    {
      source: "Spaceship",
      shortLabel: "SP",
      kind: "registrar",
      actionLabel: "Register",
      url: `https://www.spaceship.com/domain-search/?query=${encoded}`,
      year1Usd: spBase.y1,
      fiveYrTcoUsd: spFiveYr,
      cheapest: false,
    },
    {
      source: "Namecheap",
      shortLabel: "NC",
      kind: "registrar",
      actionLabel: "Register",
      url: `https://www.namecheap.com/domains/registration/results/?domain=${encoded}`,
      year1Usd: nc.year1Usd,
      fiveYrTcoUsd: nc.fiveYrTotalUsd,
      cheapest: false,
    },
  ];

  // Mark cheapest standard registrar (CF vs PB vs NC; note Spaceship is promo-dependent)
  const coreThree = registrarOffers.filter((r) => r.source !== "Spaceship");
  let minCore = coreThree[0];
  for (const r of coreThree.slice(1)) {
    if ((r.fiveYrTcoUsd ?? Infinity) < (minCore.fiveYrTcoUsd ?? Infinity)) {
      minCore = r;
    }
  }
  minCore.cheapest = true;

  const aftermarketOffers: DomainOffer[] = [
    {
      source: "Afternic",
      shortLabel: "AF",
      kind: "aftermarket",
      actionLabel: "Check / Buy Now",
      url: `https://www.afternic.com/domain/${encoded}`,
      year1Usd: null,
      fiveYrTcoUsd: null,
      cheapest: false,
    },
    {
      source: "Sedo",
      shortLabel: "Sedo",
      kind: "aftermarket",
      actionLabel: "Make Offer",
      url: `https://sedo.com/search/?keyword=${encoded}`,
      year1Usd: null,
      fiveYrTcoUsd: null,
      cheapest: false,
    },
    {
      source: "GoDaddy Broker",
      shortLabel: "GD",
      kind: "aftermarket",
      actionLabel: "Broker / Auction",
      url: `https://www.godaddy.com/domainsearch/find?domainToCheck=${encoded}`,
      year1Usd: null,
      fiveYrTcoUsd: null,
      cheapest: false,
    },
    {
      source: "Atom",
      shortLabel: "Atom",
      kind: "aftermarket",
      actionLabel: "Premium Listing",
      url: `https://www.atom.com/name/${encodeURIComponent(sld)}`,
      year1Usd: null,
      fiveYrTcoUsd: null,
      cheapest: false,
    },
  ];

  if (status === "available") {
    return [...registrarOffers, ...aftermarketOffers.slice(0, 2)];
  }
  return [...aftermarketOffers, ...registrarOffers.slice(0, 2)];
}
