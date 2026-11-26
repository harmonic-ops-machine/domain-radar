import { createDb } from "@/db";
import { tldPricing } from "@/db/schema";
import { bulkUpsertDomains, MAX_CHUNK_SIZE } from "@/lib/domains/bulk-upsert";
import { DEFAULT_TLD_PRICING } from "@/lib/pricing/tco";
import { SUPPORTED_TLDS } from "@/lib/types";

const VERIFIED_TRUTH_REAL_100 = [
  "truthcipher.com", "truthslate.com", "truthcrest.com", "truthflint.com",
  "truthverge.com", "truthmeridian.com", "truthdocket.com", "truthreceipt.com",
  "truthbedrock.com", "truthdatum.com", "truthattest.com", "truthglint.com",
  "truthprose.com", "truthassay.com", "truthsealed.com", "truthsigned.com",
  "truthtraced.com", "truthgrounded.com", "truthunspun.com", "truthplain.com",
  "crisptruth.com", "sworntruth.com", "attestedtruth.com", "sealedtruth.com",
  "loggedtruth.com", "tracedtruth.com", "mappedtruth.com", "stricttruth.com",
  "etchedtruth.com", "granitetruth.com", "provabletruth.com", "tangibletruth.com",
  "meridiantruth.com", "ciphertruth.com", "slatetruth.com",
  "realcanon.com", "realanvil.com", "realshard.com", "realkiln.com",
  "realmarrow.com", "realhewn.com", "realcarved.com", "realstamped.com",
  "realsealed.com", "realsworn.com", "realattested.com", "reallogged.com",
  "realtraced.com", "realgrounded.com", "realanchored.com", "realunspun.com",
  "realliteral.com", "crispreal.com", "steadyreal.com", "anchoredreal.com",
  "truthreal.ai", "truthreal.io", "truthreal.org", "realtruthdesk.com",
  "realtruthcanon.com", "realtrutharchive.com", "realtruthwitness.com", "realtruthverdict.com",
  "truthrealindex.com", "truthrealwire.com", "truthrealpress.com", "truthrealcheck.com",
  "truthrealproof.com", "truthrealaudit.com", "truthrealsignal.com", "truthrealforge.com",
  "truthrealrecord.com", "truthrealledger.com", "truthrealbrief.com", "truthrealwatch.com",
  "truthledger.ai", "truthrecord.ai", "truthnotary.ai", "truthcanon.ai",
  "starktruth.ai", "baretruth.ai", "groundedtruth.ai", "realledger.ai",
  "realproof.ai", "realaudit.ai", "realbeacon.ai", "strictlyreal.ai",
  "verifiedreal.ai", "purelyreal.ai", "plaintruth.io", "truthproof.io",
  "truthaudit.io", "truthbeacon.io", "truthverify.io", "realrecord.io",
  "realtrace.io", "reallayer.io", "truthsignal.app", "truthproof.app",
  "truthvault.dev",
];

const STEMS = [
  "truth", "real", "verity", "fact", "proof", "ledger", "vault", "signal",
  "audit", "notary", "canon", "agent", "neural", "vector", "pulse", "spark",
  "nexus", "prism", "forge", "loom", "beacon", "cipher", "anchor", "atlas",
  "meridian", "shield", "guard", "watch", "trace", "chain", "index", "stack",
  "layer", "mesh", "node", "core", "prime", "clear", "plain", "stark",
  "solid", "iron", "flint", "slate", "granite", "bedrock", "summit", "crest",
  "harbor", "bridge", "horizon", "compass", "metric", "datum", "docket", "brief",
  "press", "wire", "desk", "bench", "guild", "foundry", "studio", "craft",
  "works", "labs", "cloud", "grid", "flow", "sync", "shift", "scale",
  "scope", "sense", "sight", "lens", "gauge", "caliper", "assay", "mint",
  "coin", "pay", "bank", "fund", "trust", "bond", "hedge", "alpha",
  "delta", "sigma", "omega", "apex", "zenith", "nova", "orbit", "solar",
  "lunar", "terra", "aero", "cyber", "quantum", "hyper", "meta", "omni",
  "civic", "public", "common", "open", "free", "direct", "strict", "exact",
  "steady", "vivid", "crisp", "sharp", "clean", "pure", "raw", "bold",
  "swift", "rapid", "smart", "bright", "deep", "high",
];

const SUFFIXES = [
  "ledger", "proof", "audit", "signal", "vault", "index", "record", "canon",
  "notary", "docket", "brief", "wire", "press", "desk", "bench", "forge",
  "loom", "prism", "beacon", "cipher", "anchor", "atlas", "shield", "guard",
  "watch", "trace", "chain", "stack", "layer", "mesh", "node", "core",
  "base", "hub", "lab", "labs", "works", "foundry", "studio", "craft",
  "cloud", "grid", "flow", "sync", "scale", "scope", "lens", "gauge",
  "metric", "datum", "mint", "pay", "trust", "bond", "alpha", "pulse",
  "spark", "nexus", "crest", "harbor", "bridge", "verge", "slate", "flint",
  "kiln", "anvil", "shard", "grain", "marrow", "hearth", "spire", "quill",
  "folio", "prose", "draft", "memo", "check", "verify", "attest", "seal",
  "stamp", "receipt", "tally", "score", "rank", "radar", "scout", "pilot",
  "engine", "os", "hq", "ai", "ops", "net", "box", "kit", "pro", "one",
  "now", "next", "plus", "max",
];

export function generateCombinatorialDomains(targetCount: number): string[] {
  const out = new Set<string>(VERIFIED_TRUTH_REAL_100);
  outer: for (const tld of SUPPORTED_TLDS) {
    for (const stem of STEMS) {
      for (const suffix of SUFFIXES) {
        if (stem === suffix) continue;
        out.add(`${stem}${suffix}${tld}`);
        if (out.size >= targetCount) break outer;
      }
    }
  }
  return Array.from(out).slice(0, targetCount);
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL) to run seed-100k");
  }
  const db = createDb({ url, driver: "pg" });

  console.log("Seeding TLD pricing table...");
  await db
    .insert(tldPricing)
    .values(Object.values(DEFAULT_TLD_PRICING))
    .onConflictDoNothing();

  console.log("Seeding 100 verified Truth & Real hot/watched domains...");
  await bulkUpsertDomains(db, VERIFIED_TRUTH_REAL_100, {
    chunkSize: MAX_CHUNK_SIZE,
    tier: "hot",
    watched: true,
  });

  const target = Number(process.env.SEED_COUNT ?? 100_000);
  console.log(`Generating and upserting ${target.toLocaleString()} domains...`);
  const all = generateCombinatorialDomains(target).filter(
    (d) => !VERIFIED_TRUTH_REAL_100.includes(d)
  );
  const res = await bulkUpsertDomains(db, all, {
    chunkSize: MAX_CHUNK_SIZE,
    tier: "cold",
    watched: false,
  });
  console.log("Seed complete:", res);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
