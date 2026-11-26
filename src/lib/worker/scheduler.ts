import type { RefreshTier } from "@/lib/types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const TIER_INTERVAL_MS: Record<RefreshTier, number> = {
  hot: 6 * HOUR_MS,
  warm: 24 * HOUR_MS,
  cold: 72 * HOUR_MS,
};

export function computeNextCheckAt(input: {
  tier: RefreshTier;
  consecutiveErrors: number;
  retryAfterSeconds?: number | null;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  let delayMs: number;

  if (input.consecutiveErrors > 0) {
    const expBackoff = 5 * MINUTE_MS * 2 ** Math.min(input.consecutiveErrors, 12);
    delayMs = Math.min(DAY_MS, expBackoff);
  } else {
    delayMs = TIER_INTERVAL_MS[input.tier];
  }

  if (input.retryAfterSeconds && input.retryAfterSeconds > 0) {
    delayMs = Math.max(delayMs, input.retryAfterSeconds * 1_000);
  }

  return new Date(now.getTime() + delayMs);
}

export function computeRefreshTier(input: {
  watched: boolean;
  changed: boolean;
  predicted12mGrowthPct: number | null;
  rankHint?: number;
}): RefreshTier {
  if (
    input.watched ||
    input.changed ||
    (input.predicted12mGrowthPct !== null && input.predicted12mGrowthPct >= 25)
  ) {
    return "hot";
  }
  if (
    (input.predicted12mGrowthPct !== null && input.predicted12mGrowthPct >= 10) ||
    (input.rankHint !== undefined && input.rankHint <= 25_000)
  ) {
    return "warm";
  }
  return "cold";
}
