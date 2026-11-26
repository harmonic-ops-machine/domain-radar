CREATE TABLE "domain_patterns" (
	"domain_id" bigint NOT NULL,
	"pattern_key" text NOT NULL,
	CONSTRAINT "domain_patterns_domain_id_pattern_key_pk" PRIMARY KEY("domain_id","pattern_key")
);
--> statement-breakpoint
CREATE TABLE "domain_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"domain_id" bigint NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"registrar" text,
	"expires_at" timestamp with time zone,
	"source" text NOT NULL,
	"change_reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fqdn" text NOT NULL,
	"sld" text NOT NULL,
	"tld" text NOT NULL,
	"length" integer NOT NULL,
	"has_hyphen" boolean DEFAULT false NOT NULL,
	"has_digit" boolean DEFAULT false NOT NULL,
	"tokens" text[] DEFAULT '{}' NOT NULL,
	"archetype" text DEFAULT 'COMPOUND_2WORD' NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"tier" text DEFAULT 'cold' NOT NULL,
	"registrar" text,
	"expires_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_rdap_at" timestamp with time zone,
	"next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"five_yr_tco_usd" double precision,
	"estimated_value_usd" double precision,
	"predicted_12m_growth_pct" double precision,
	"net_5yr_roi_multiple" double precision,
	"confidence" double precision,
	"watched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domains_fqdn_unique" UNIQUE("fqdn")
);
--> statement-breakpoint
CREATE TABLE "market_signals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"signal_type" text NOT NULL,
	"key" text NOT NULL,
	"tld" text,
	"numeric_value" double precision NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "patterns" (
	"pattern_key" text PRIMARY KEY NOT NULL,
	"pattern_type" text NOT NULL,
	"tld" text,
	"total_domains" integer DEFAULT 0 NOT NULL,
	"available_count" integer DEFAULT 0 NOT NULL,
	"registered_count" integer DEFAULT 0 NOT NULL,
	"absorption_7d" double precision DEFAULT 0 NOT NULL,
	"absorption_30d" double precision DEFAULT 0 NOT NULL,
	"shrunk_absorption_30d" double precision DEFAULT 0 NOT NULL,
	"drop_rate_30d" double precision DEFAULT 0 NOT NULL,
	"scarcity_ratio" double precision DEFAULT 0 NOT NULL,
	"comp_price_slope" double precision DEFAULT 0 NOT NULL,
	"trend_z_score" double precision DEFAULT 0 NOT NULL,
	"momentum_score" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tld_pricing" (
	"tld" text PRIMARY KEY NOT NULL,
	"cf_y1_usd" double precision NOT NULL,
	"cf_renew_usd" double precision NOT NULL,
	"pb_y1_usd" double precision NOT NULL,
	"pb_renew_usd" double precision NOT NULL,
	"nc_y1_usd" double precision NOT NULL,
	"nc_renew_usd" double precision NOT NULL,
	"min_billing_years" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "value_predictions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"domain_id" bigint NOT NULL,
	"model_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_fair_value_usd" double precision NOT NULL,
	"predicted_12m_value_usd" double precision NOT NULL,
	"predicted_12m_growth_pct" double precision NOT NULL,
	"five_yr_tco_usd" double precision NOT NULL,
	"net_5yr_roi_multiple" double precision NOT NULL,
	"confidence" double precision NOT NULL,
	"top_drivers" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"claimed_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"changed_count" integer DEFAULT 0 NOT NULL,
	"rate_limited_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"stopped_for_budget" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "domain_patterns" ADD CONSTRAINT "domain_patterns_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_patterns" ADD CONSTRAINT "domain_patterns_pattern_key_patterns_pattern_key_fk" FOREIGN KEY ("pattern_key") REFERENCES "public"."patterns"("pattern_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_snapshots" ADD CONSTRAINT "domain_snapshots_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_predictions" ADD CONSTRAINT "value_predictions_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_domain_patterns_key" ON "domain_patterns" USING btree ("pattern_key","domain_id");--> statement-breakpoint
CREATE INDEX "idx_snapshots_domain_obs" ON "domain_snapshots" USING btree ("domain_id","observed_at");--> statement-breakpoint
CREATE INDEX "idx_domains_due_claim" ON "domains" USING btree ("next_check_at","lease_until","tier");--> statement-breakpoint
CREATE INDEX "idx_domains_growth_cursor" ON "domains" USING btree ("predicted_12m_growth_pct","id");--> statement-breakpoint
CREATE INDEX "idx_domains_status_tld" ON "domains" USING btree ("status","tld","id");--> statement-breakpoint
CREATE INDEX "idx_market_signals_lookup" ON "market_signals" USING btree ("signal_type","key","observed_at");--> statement-breakpoint
CREATE INDEX "idx_patterns_momentum" ON "patterns" USING btree ("momentum_score");--> statement-breakpoint
CREATE INDEX "idx_value_predictions_domain_time" ON "value_predictions" USING btree ("domain_id","computed_at");