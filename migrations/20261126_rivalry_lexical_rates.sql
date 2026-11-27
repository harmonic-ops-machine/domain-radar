-- 1. Verified Nov 2026 Registrar & TLD Benchmark Rates
CREATE TABLE IF NOT EXISTS tld_rate_benchmarks (
  tld TEXT NOT NULL,
  registrar TEXT NOT NULL,
  reg_year1_usd NUMERIC(8,2) NOT NULL,
  renew_annual_usd NUMERIC(8,2) NOT NULL,
  min_term_years INT NOT NULL DEFAULT 1,
  restore_fee_usd NUMERIC(8,2) NOT NULL DEFAULT 40.00,
  verified_at DATE NOT NULL DEFAULT '2026-11-26',
  PRIMARY KEY (tld, registrar)
);

INSERT INTO tld_rate_benchmarks (tld, registrar, reg_year1_usd, renew_annual_usd, min_term_years, restore_fee_usd) VALUES
  ('.com', 'cloudflare', 11.17, 11.17, 1, 40.00),
  ('.com', 'porkbun',    11.81, 11.81, 1, 40.00),
  ('.com', 'namecheap',  12.08, 18.48, 1, 40.00),
  ('.ai',  'cloudflare', 80.00, 80.00, 2, 160.00),
  ('.ai',  'porkbun',    82.70, 82.70, 2, 460.00),
  ('.ai',  'namecheap',  89.98, 114.98, 2, 460.00),
  ('.app', 'cloudflare',  8.20, 14.20, 1, 50.00),
  ('.dev', 'cloudflare',  8.20, 12.20, 1, 50.00),
  ('.io',  'porkbun',    28.12, 51.80, 1, 60.00),
  ('.io',  'cloudflare', 50.00, 50.00, 1, 60.00)
ON CONFLICT (tld, registrar) DO UPDATE SET
  reg_year1_usd = EXCLUDED.reg_year1_usd,
  renew_annual_usd = EXCLUDED.renew_annual_usd,
  verified_at = EXCLUDED.verified_at;

-- 2. AI Rivalry Regime Shock Matrix
CREATE TABLE IF NOT EXISTS ai_rivalry_regimes (
  regime_slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  reality_mult NUMERIC(4,2) NOT NULL,
  justice_mult NUMERIC(4,2) NOT NULL,
  composability_mult NUMERIC(4,2) NOT NULL,
  active_probability NUMERIC(4,3) NOT NULL
);

INSERT INTO ai_rivalry_regimes VALUES
  ('protocol_war',      'Anthropic vs OpenAI Agentic Protocol War', 1.35, 1.55, 1.85, 0.400),
  ('open_weight_shock', 'DeepSeek V4 / GLM Cost-Deflation Surge',   1.25, 1.30, 2.20, 0.250),
  ('world_model_pivot', 'Google / xAI Embodied & Spatial Pivot',    2.30, 1.25, 1.45, 0.200),
  ('regulatory_audit',  'Global Provenance & Liability Clampdown',  1.90, 2.45, 1.40, 0.150)
ON CONFLICT (regime_slug) DO NOTHING;

-- 3. Lexical Seeds: REALITY, JUSTICE, COMPOSABILITY
CREATE TABLE IF NOT EXISTS lexical_cluster_seeds (
  morpheme TEXT PRIMARY KEY,
  cluster TEXT NOT NULL CHECK (cluster IN ('REALITY', 'JUSTICE', 'COMPOSABILITY')),
  pattern_rule TEXT NOT NULL,
  prior_weight NUMERIC(4,2) NOT NULL
);

INSERT INTO lexical_cluster_seeds VALUES
  ('reality',     'REALITY',       'prefix:reality',     1.42),
  ('verity',      'REALITY',       'prefix:verity',      1.38),
  ('provenance',  'REALITY',       'suffix:provenance',  1.34),
  ('groundtruth', 'REALITY',       'prefix:groundtruth', 1.45),
  ('justice',     'JUSTICE',       'prefix:justice',     1.40),
  ('tribunal',    'JUSTICE',       'suffix:tribunal',    1.36),
  ('fiduciary',   'JUSTICE',       'prefix:fiduciary',   1.44),
  ('redress',     'JUSTICE',       'suffix:redress',     1.29),
  ('composable',  'COMPOSABILITY', 'prefix:composable',  1.52),
  ('functor',     'COMPOSABILITY', 'suffix:functor',     1.46),
  ('manifold',    'COMPOSABILITY', 'suffix:manifold',    1.39),
  ('interop',     'COMPOSABILITY', 'prefix:interop',     1.48)
ON CONFLICT (morpheme) DO NOTHING;
