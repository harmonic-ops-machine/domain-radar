import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { domains, domainSnapshots, workerRuns } from "@/db/schema";
import { probeDomain, type ProbeOutcome } from "@/lib/prober/probe-domain";
import { RegistryRateGuard } from "@/lib/prober/rdap";
import type { DomainStatus, RefreshTier, TldCode } from "@/lib/types";
import { computeNextCheckAt, computeRefreshTier } from "./scheduler";

const DEFAULT_BUDGET_MS = 240_000;
const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_LEASE_MS = 360_000;
const HEARTBEAT_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ClaimedDomain {
  id: number;
  fqdn: string;
  tld: TldCode;
  status: DomainStatus;
  tier: RefreshTier;
  consecutiveErrors: number;
  lastRdapAt: Date | null;
  watched?: boolean;
  predicted12mGrowthPct?: number | null;
}

export interface ProbedDomainRecord {
  domain: ClaimedDomain;
  outcome: ProbeOutcome;
}

export interface WorkerTickOptions {
  budgetMs?: number;
  batchSize?: number;
  leaseMs?: number;
  nowFn?: () => number;
  guard?: RegistryRateGuard;
  claimBatchFn?: (limit: number, leaseMs: number) => Promise<ClaimedDomain[]>;
  probeFn?: (domain: ClaimedDomain) => Promise<ProbeOutcome>;
  commitBatchFn?: (records: ProbedDomainRecord[]) => Promise<void>;
  recordRunFn?: (summary: WorkerTickResult) => Promise<string>;
}

export interface WorkerTickResult {
  runId: string;
  claimed: number;
  updated: number;
  changed: number;
  rateLimited: number;
  errors: number;
  stoppedForBudget: boolean;
  elapsedMs: number;
}

export function buildClaimBatchSql(limit: number, leaseMs: number): string {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 500));
  const safeLease = Math.max(30_000, Math.floor(leaseMs));
  return `
WITH due AS (
  SELECT id FROM domains
  WHERE next_check_at <= NOW()
    AND (lease_until IS NULL OR lease_until < NOW())
  ORDER BY CASE tier WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 ELSE 2 END, next_check_at ASC
  LIMIT ${safeLimit}
  FOR UPDATE SKIP LOCKED
)
UPDATE domains d
SET lease_until = NOW() + interval '${safeLease} milliseconds'
FROM due
WHERE d.id = due.id
RETURNING d.id, d.fqdn, d.tld, d.status, d.tier, d.consecutive_errors, d.last_rdap_at, d.watched, d.predicted_12m_growth_pct;
`.trim();
}

export async function claimNextBatch(
  db: Database,
  limit: number = DEFAULT_BATCH_SIZE,
  leaseMs: number = DEFAULT_LEASE_MS
): Promise<ClaimedDomain[]> {
  const query = buildClaimBatchSql(limit, leaseMs);
  const res = await db.execute(sql.raw(query));
  const rows = (res as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.map((row) => ({
    id: Number(row.id),
    fqdn: String(row.fqdn),
    tld: String(row.tld) as TldCode,
    status: String(row.status) as DomainStatus,
    tier: String(row.tier) as RefreshTier,
    consecutiveErrors: Number(row.consecutive_errors ?? 0),
    lastRdapAt: row.last_rdap_at ? new Date(String(row.last_rdap_at)) : null,
    watched: Boolean(row.watched),
    predicted12mGrowthPct:
      row.predicted_12m_growth_pct !== null && row.predicted_12m_growth_pct !== undefined
        ? Number(row.predicted_12m_growth_pct)
        : null,
  }));
}

async function defaultCommitBatch(
  db: Database,
  records: ProbedDomainRecord[],
  now: Date
): Promise<void> {
  const snapshotsToInsert: Array<{
    domainId: number;
    observedAt: Date;
    status: string;
    registrar: string | null;
    expiresAt: Date | null;
    source: string;
    changeReason: string;
  }> = [];

  for (const { domain, outcome } of records) {
    const isError = outcome.source === "error_preserved";
    const consecutiveErrors = isError ? domain.consecutiveErrors + 1 : 0;
    const nextTier = computeRefreshTier({
      watched: Boolean(domain.watched),
      changed: outcome.changed,
      predicted12mGrowthPct: domain.predicted12mGrowthPct ?? null,
    });
    const nextCheckAt = computeNextCheckAt({
      tier: nextTier,
      consecutiveErrors,
      retryAfterSeconds: outcome.retryAfterSeconds,
      now,
    });

    await db
      .update(domains)
      .set({
        status: outcome.status,
        tier: nextTier,
        registrar: outcome.registrar ?? undefined,
        expiresAt: outcome.expiresAt ?? undefined,
        lastCheckedAt: now,
        lastRdapAt: outcome.source === "rdap" ? now : domain.lastRdapAt,
        nextCheckAt,
        leaseUntil: null,
        consecutiveErrors,
        lastError: outcome.errorCode,
        updatedAt: now,
      })
      .where(eq(domains.id, domain.id));

    const needsHeartbeat =
      !isError &&
      (domain.lastRdapAt === null ||
        now.getTime() - domain.lastRdapAt.getTime() >= HEARTBEAT_DAYS_MS);

    if (outcome.changed || needsHeartbeat) {
      snapshotsToInsert.push({
        domainId: domain.id,
        observedAt: now,
        status: outcome.status,
        registrar: outcome.registrar,
        expiresAt: outcome.expiresAt,
        source: outcome.source,
        changeReason: outcome.changed ? "status_change" : "heartbeat_7d",
      });
    }
  }

  if (snapshotsToInsert.length > 0) {
    await db.insert(domainSnapshots).values(snapshotsToInsert);
  }
}

export async function processWorkerTick(
  db: Database,
  opts?: WorkerTickOptions
): Promise<WorkerTickResult> {
  const budgetMs = opts?.budgetMs ?? DEFAULT_BUDGET_MS;
  const batchSize = opts?.batchSize ?? DEFAULT_BATCH_SIZE;
  const leaseMs = opts?.leaseMs ?? DEFAULT_LEASE_MS;
  const nowFn = opts?.nowFn ?? (() => Date.now());
  const guard = opts?.guard ?? new RegistryRateGuard();

  const startedAt = nowFn();
  let claimed = 0;
  let updated = 0;
  let changed = 0;
  let rateLimited = 0;
  let errors = 0;
  let stoppedForBudget = false;

  const claimFn =
    opts?.claimBatchFn ?? ((lim: number, lease: number) => claimNextBatch(db, lim, lease));
  const probeFn =
    opts?.probeFn ??
    ((d: ClaimedDomain) =>
      probeDomain(
        {
          fqdn: d.fqdn,
          tld: d.tld,
          previousStatus: d.status,
          lastRdapAt: d.lastRdapAt,
        },
        { guard, nowFn: () => new Date(nowFn()) }
      ));
  const commitFn =
    opts?.commitBatchFn ??
    ((recs: ProbedDomainRecord[]) => defaultCommitBatch(db, recs, new Date(nowFn())));

  while (true) {
    if (nowFn() - startedAt >= budgetMs) {
      stoppedForBudget = true;
      break;
    }

    const batch = await claimFn(batchSize, leaseMs);
    if (batch.length === 0) break;

    claimed += batch.length;

    const records: ProbedDomainRecord[] = [];
    for (const domain of batch) {
      const outcome = await probeFn(domain);
      records.push({ domain, outcome });
      updated += 1;
      if (outcome.changed) changed += 1;
      if (outcome.httpStatus === 429 || outcome.errorCode === "CIRCUIT_OPEN") {
        rateLimited += 1;
      } else if (outcome.source === "error_preserved") {
        errors += 1;
      }
    }

    await commitFn(records);

    if (nowFn() - startedAt >= budgetMs) {
      stoppedForBudget = true;
      break;
    }
  }

  const elapsedMs = nowFn() - startedAt;
  const summary: WorkerTickResult = {
    runId: "",
    claimed,
    updated,
    changed,
    rateLimited,
    errors,
    stoppedForBudget,
    elapsedMs,
  };

  if (opts?.recordRunFn) {
    summary.runId = await opts.recordRunFn(summary);
  } else {
    const [inserted] = await db
      .insert(workerRuns)
      .values({
        jobType: "probe",
        startedAt: new Date(startedAt),
        finishedAt: new Date(nowFn()),
        claimedCount: claimed,
        updatedCount: updated,
        changedCount: changed,
        rateLimitedCount: rateLimited,
        errorCount: errors,
        stoppedForBudget,
        status: "completed",
      })
      .returning({ id: workerRuns.id });
    summary.runId = inserted?.id ?? "";
  }

  return summary;
}
