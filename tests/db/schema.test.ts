import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  domains,
  domainSnapshots,
  patterns,
  domainPatterns,
  marketSignals,
  valuePredictions,
  workerRuns,
  tldPricing,
} from "@/db/schema";
import { resolveDriver } from "@/db/index";

describe("Drizzle schema & dual-driver factory", () => {
  it("defines all 8 core tables with required composite indexes", () => {
    const domainCfg = getTableConfig(domains);
    const indexNames = domainCfg.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_domains_due_claim");
    expect(indexNames).toContain("idx_domains_growth_cursor");
    expect(indexNames).toContain("idx_domains_status_tld");
    expect(indexNames).toContain("idx_domains_status_tld_growth");
    expect(domainCfg.columns.map((c) => c.name)).toContain("top_drivers");

    const snapCfg = getTableConfig(domainSnapshots);
    expect(snapCfg.indexes.map((i) => i.config.name)).toContain("idx_snapshots_domain_obs");

    expect(getTableConfig(patterns).name).toBe("patterns");
    expect(getTableConfig(domainPatterns).name).toBe("domain_patterns");
    expect(getTableConfig(marketSignals).name).toBe("market_signals");
    expect(getTableConfig(valuePredictions).name).toBe("value_predictions");
    expect(getTableConfig(workerRuns).name).toBe("worker_runs");
    expect(getTableConfig(tldPricing).name).toBe("tld_pricing");
  });

  it("selects neon driver for neon.tech URLs and pg driver for localhost", () => {
    expect(resolveDriver("postgres://user:pw@ep-cool-pooler.us-east-2.aws.neon.tech/neondb")).toBe("neon");
    expect(resolveDriver("postgresql://postgres:postgres@localhost:5432/domain_radar")).toBe("pg");
  });
});
