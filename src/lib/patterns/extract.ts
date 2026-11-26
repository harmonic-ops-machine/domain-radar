import type { PatternArchetype, TldCode } from "@/lib/types";

const MORPHEME_LEXICON = [
  "anchored", "archive", "attested", "bedrock", "caliper", "chronicle",
  "compass", "factual", "foundry", "granite", "grounded", "horizon",
  "literal", "meridian", "network", "provable", "quantum", "receipts",
  "receipt", "stamped", "strictly", "tangible", "verified", "verdict",
  "witness", "anchor", "attest", "beacon", "bridge", "carved", "cipher",
  "common", "direct", "docket", "etched", "filter", "harbor", "hearth",
  "ledger", "logged", "mapped", "marrow", "metric", "neural", "notary",
  "pillar", "plainly", "public", "purely", "record", "sealed", "shield",
  "signal", "signed", "steady", "strict", "studio", "summit", "traced",
  "unbent", "unspun", "vector", "verify", "verity", "agent", "alpha",
  "anvil", "assay", "atlas", "audit", "bench", "brief", "canon", "chain",
  "check", "chord", "civic", "clean", "clear", "cloud", "craft", "crest",
  "crisp", "cyber", "daily", "datum", "delta", "depot", "draft", "exact",
  "field", "first", "flint", "folio", "forge", "frame", "gauge", "glass",
  "glint", "grain", "graph", "guard", "guild", "hedge", "house", "hyper",
  "index", "layer", "level", "local", "lunar", "media", "metal", "money",
  "nexus", "omega", "orbit", "panel", "pilot", "plain", "plumb", "press",
  "prime", "print", "prism", "proof", "prose", "pulse", "quill", "quiet",
  "radar", "rapid", "rigid", "scale", "scope", "score", "scout", "sense",
  "shard", "sharp", "shift", "shore", "sight", "slate", "smart", "solar",
  "solid", "spark", "spire", "stack", "stamp", "stark", "steel", "stone",
  "swift", "sworn", "tally", "terra", "trace", "trust", "truth", "vault",
  "verge", "verse", "vivid", "watch", "works", "world", "zenith",
  "aero", "bank", "bare", "base", "beam", "bold", "bond", "born", "cast",
  "cert", "code", "coin", "cold", "core", "crew", "data", "deep", "desk",
  "dock", "edge", "even", "fact", "fast", "feed", "file", "firm", "flow",
  "free", "full", "fund", "gate", "gold", "grid", "hall", "hard", "held",
  "hewn", "high", "hold", "iron", "just", "keep", "kept", "kiln", "labs",
  "last", "lens", "line", "link", "live", "lock", "loom", "made", "mark",
  "memo", "mesh", "meta", "mind", "mint", "news", "next", "node", "note",
  "omni", "only", "open", "play", "port", "post", "pure", "real", "room",
  "root", "safe", "seal", "seen", "sign", "site", "sole", "spun", "stay",
  "sync", "tech", "time", "told", "true", "ward", "wave", "well", "wide",
  "wire", "wise", "word", "zero", "zone",
  "app", "art", "bio", "bot", "box", "dev", "doc", "fin", "geo", "hub",
  "key", "kit", "lab", "law", "log", "map", "max", "net", "new", "now",
  "one", "ops", "pay", "pro", "raw", "red", "run", "set", "top", "web",
  "ai", "co", "hq", "io", "ml", "os",
].sort((a, b) => b.length - a.length);

export interface ExtractedPatterns {
  tokens: string[];
  archetype: PatternArchetype;
  lengthBucket: string;
  keys: string[];
}

function tokenizeSegment(segment: string): string[] {
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < segment.length) {
    let matched = false;
    for (const word of MORPHEME_LEXICON) {
      if (segment.startsWith(word, cursor)) {
        tokens.push(word);
        cursor += word.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      let end = cursor + 1;
      while (end < segment.length) {
        const nextHit = MORPHEME_LEXICON.some((w) => segment.startsWith(w, end));
        if (nextHit) break;
        end += 1;
      }
      tokens.push(segment.slice(cursor, end));
      cursor = end;
    }
  }
  return tokens;
}

export function classifyLengthBucket(len: number): string {
  if (len <= 6) return "1-6";
  if (len <= 10) return "7-10";
  if (len <= 15) return "11-15";
  return "16+";
}

export function extractDomainPatterns(
  sld: string,
  tld: TldCode
): ExtractedPatterns {
  const clean = sld.toLowerCase();
  const hasHyphen = clean.includes("-");
  const hasDigit = /\d/.test(clean);

  const rawParts = clean
    .split(/[-]+/)
    .flatMap((part) => part.match(/[a-z]+|\d+/g) ?? [])
    .filter(Boolean);

  const tokens = rawParts.flatMap((part) =>
    /^\d+$/.test(part) ? [part] : tokenizeSegment(part)
  );

  let archetype: PatternArchetype;
  if (hasHyphen) {
    archetype = "HYPHENATED";
  } else if (hasDigit) {
    archetype = "NUMERIC";
  } else if (clean.length <= 6 && tokens.length <= 1) {
    archetype = "SHORT_BRAND_LE6";
  } else if (tokens.length <= 1) {
    archetype = "SINGLE_WORD";
  } else if (tokens.length === 2) {
    archetype = "COMPOUND_2WORD";
  } else {
    archetype = "COMPOUND_3PLUS";
  }

  const lengthBucket = classifyLengthBucket(clean.length);
  const keySet = new Set<string>([
    `tld:${tld}`,
    `archetype:${archetype}:${tld}`,
    `len_bucket:${lengthBucket}:${tld}`,
  ]);

  if (tokens.length >= 1) {
    keySet.add(`prefix:${tokens[0]}`);
    keySet.add(`prefix:${tokens[0]}:${tld}`);
  }
  if (tokens.length >= 2) {
    const last = tokens[tokens.length - 1];
    keySet.add(`suffix:${last}`);
    keySet.add(`suffix:${last}:${tld}`);
  }

  return {
    tokens,
    archetype,
    lengthBucket,
    keys: Array.from(keySet),
  };
}
