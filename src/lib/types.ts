export const SUPPORTED_TLDS = [
  ".com",
  ".net",
  ".org",
  ".ai",
  ".io",
  ".co",
  ".app",
  ".dev",
] as const;

export type TldCode = (typeof SUPPORTED_TLDS)[number];

export type DomainStatus =
  | "available"
  | "registered"
  | "grace"
  | "redemption"
  | "unknown";

export type RefreshTier = "hot" | "warm" | "cold";

export type PatternArchetype =
  | "SINGLE_WORD"
  | "COMPOUND_2WORD"
  | "COMPOUND_3PLUS"
  | "SHORT_BRAND_LE6"
  | "HYPHENATED"
  | "NUMERIC";

export type RegistrarId = "cloudflare" | "porkbun" | "namecheap" | "optimal";

export type SignalType = "comp_sale" | "keyword_trend" | "registry_price";

export interface FeatureContribution {
  feature: string;
  impactPct: number;
  explanation: string;
}

export interface DomainCursor {
  sortValue: number;
  id: number;
}
