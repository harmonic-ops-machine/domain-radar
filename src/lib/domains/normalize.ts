import { SUPPORTED_TLDS, type TldCode } from "@/lib/types";

const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SUPPORTED_TLD_SET = new Set<string>(SUPPORTED_TLDS);

export interface NormalizedDomain {
  fqdn: string;
  sld: string;
  tld: TldCode;
  length: number;
  hasHyphen: boolean;
  hasDigit: boolean;
}

export function normalizeDomain(raw: string): NormalizedDomain | null {
  const cleaned = raw.trim().replace(/\.+$/, "").toLowerCase();
  if (!cleaned) return null;

  const parts = cleaned.split(".");
  if (parts.length !== 2) return null;

  const [sld, tldRaw] = parts;
  if (!sld || !tldRaw) return null;

  const tld = `.${tldRaw}`;
  if (!SUPPORTED_TLD_SET.has(tld)) return null;
  if (!LABEL_REGEX.test(sld)) return null;

  return {
    fqdn: `${sld}${tld}`,
    sld,
    tld: tld as TldCode,
    length: sld.length,
    hasHyphen: sld.includes("-"),
    hasDigit: /\d/.test(sld),
  };
}
