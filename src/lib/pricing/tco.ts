import type { RegistrarId, TldCode } from "@/lib/types";

export interface TldPricingRow {
  tld: TldCode;
  cfY1Usd: number;
  cfRenewUsd: number;
  pbY1Usd: number;
  pbRenewUsd: number;
  ncY1Usd: number;
  ncRenewUsd: number;
  minBillingYears: number;
}

export interface TcoResult {
  year1Usd: number;
  renewals4YrUsd: number;
  fiveYrTotalUsd: number;
  minBillingYears: number;
  registrar: RegistrarId;
}

export const DEFAULT_TLD_PRICING: Record<TldCode, TldPricingRow> = {
  ".com": {
    tld: ".com",
    cfY1Usd: 11.17,
    cfRenewUsd: 11.17,
    pbY1Usd: 11.81,
    pbRenewUsd: 11.81,
    ncY1Usd: 12.28,
    ncRenewUsd: 20.18,
    minBillingYears: 1,
  },
  ".net": {
    tld: ".net",
    cfY1Usd: 11.84,
    cfRenewUsd: 11.84,
    pbY1Usd: 12.52,
    pbRenewUsd: 12.52,
    ncY1Usd: 13.18,
    ncRenewUsd: 17.18,
    minBillingYears: 1,
  },
  ".org": {
    tld: ".org",
    cfY1Usd: 10.11,
    cfRenewUsd: 10.11,
    pbY1Usd: 7.98,
    pbRenewUsd: 11.84,
    ncY1Usd: 7.44,
    ncRenewUsd: 15.18,
    minBillingYears: 1,
  },
  ".ai": {
    tld: ".ai",
    cfY1Usd: 80.0,
    cfRenewUsd: 80.0,
    pbY1Usd: 82.7,
    pbRenewUsd: 82.7,
    ncY1Usd: 89.98,
    ncRenewUsd: 114.98,
    minBillingYears: 2,
  },
  ".io": {
    tld: ".io",
    cfY1Usd: 50.0,
    cfRenewUsd: 50.0,
    pbY1Usd: 28.12,
    pbRenewUsd: 51.8,
    ncY1Usd: 29.98,
    ncRenewUsd: 64.98,
    minBillingYears: 1,
  },
  ".co": {
    tld: ".co",
    cfY1Usd: 26.5,
    cfRenewUsd: 26.5,
    pbY1Usd: 15.76,
    pbRenewUsd: 31.2,
    ncY1Usd: 16.98,
    ncRenewUsd: 34.98,
    minBillingYears: 1,
  },
  ".app": {
    tld: ".app",
    cfY1Usd: 14.0,
    cfRenewUsd: 14.0,
    pbY1Usd: 8.75,
    pbRenewUsd: 14.93,
    ncY1Usd: 7.48,
    ncRenewUsd: 19.98,
    minBillingYears: 1,
  },
  ".dev": {
    tld: ".dev",
    cfY1Usd: 12.0,
    cfRenewUsd: 12.0,
    pbY1Usd: 8.75,
    pbRenewUsd: 12.87,
    ncY1Usd: 7.48,
    ncRenewUsd: 17.98,
    minBillingYears: 1,
  },
};

export function renewalMultiplier4Yr(annualInflation: number): number {
  let sum = 0;
  for (let year = 1; year <= 4; year++) {
    sum += (1 + annualInflation) ** year;
  }
  return sum;
}

export function calculateFiveYearTco(
  tld: TldCode,
  opts?: {
    registrar?: RegistrarId;
    annualInflation?: number;
    pricingTable?: Record<TldCode, TldPricingRow>;
  }
): TcoResult {
  const registrar: RegistrarId = opts?.registrar ?? "cloudflare";
  const annualInflation = opts?.annualInflation ?? 0.03;
  const table = opts?.pricingTable ?? DEFAULT_TLD_PRICING;
  const row = table[tld];
  const mult = renewalMultiplier4Yr(annualInflation);

  if (registrar === "optimal") {
    const candidates: Array<{
      reg: Exclude<RegistrarId, "optimal">;
      y1: number;
      renew: number;
    }> = [
      { reg: "cloudflare", y1: row.cfY1Usd, renew: row.cfRenewUsd },
      { reg: "porkbun", y1: row.pbY1Usd, renew: row.pbRenewUsd },
      { reg: "namecheap", y1: row.ncY1Usd, renew: row.ncRenewUsd },
    ];
    let best = candidates[0];
    let bestTotal = best.y1 + best.renew * mult;
    for (const c of candidates.slice(1)) {
      const total = c.y1 + c.renew * mult;
      if (total < bestTotal) {
        best = c;
        bestTotal = total;
      }
    }
    const renewals4YrUsd = Number((best.renew * mult).toFixed(2));
    return {
      year1Usd: Number(best.y1.toFixed(2)),
      renewals4YrUsd,
      fiveYrTotalUsd: Number((best.y1 + best.renew * mult).toFixed(2)),
      minBillingYears: row.minBillingYears,
      registrar: best.reg,
    };
  }

  let y1: number;
  let renew: number;
  if (registrar === "porkbun") {
    y1 = row.pbY1Usd;
    renew = row.pbRenewUsd;
  } else if (registrar === "namecheap") {
    y1 = row.ncY1Usd;
    renew = row.ncRenewUsd;
  } else {
    y1 = row.cfY1Usd;
    renew = row.cfRenewUsd;
  }

  const renewals4YrUsd = Number((renew * mult).toFixed(2));
  const fiveYrTotalUsd = Number((y1 + renew * mult).toFixed(2));
  return {
    year1Usd: Number(y1.toFixed(2)),
    renewals4YrUsd,
    fiveYrTotalUsd,
    minBillingYears: row.minBillingYears,
    registrar,
  };
}
