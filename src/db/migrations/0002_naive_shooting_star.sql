CREATE TABLE "ai_rivalry_regimes" (
	"regime_slug" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"reality_mult" double precision NOT NULL,
	"justice_mult" double precision NOT NULL,
	"composability_mult" double precision NOT NULL,
	"active_probability" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexical_cluster_seeds" (
	"morpheme" text PRIMARY KEY NOT NULL,
	"cluster" text NOT NULL,
	"pattern_rule" text NOT NULL,
	"prior_weight" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tld_rate_benchmarks" (
	"tld" text NOT NULL,
	"registrar" text NOT NULL,
	"reg_year1_usd" double precision NOT NULL,
	"renew_annual_usd" double precision NOT NULL,
	"min_term_years" integer DEFAULT 1 NOT NULL,
	"restore_fee_usd" double precision DEFAULT 40 NOT NULL,
	"verified_at" text DEFAULT '2026-11-26' NOT NULL,
	CONSTRAINT "tld_rate_benchmarks_tld_registrar_pk" PRIMARY KEY("tld","registrar")
);
