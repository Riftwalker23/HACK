CREATE TYPE "public"."ai_source" AS ENUM('speech', 'photo', 'manual', 'stub');--> statement-breakpoint
CREATE TYPE "public"."description_source" AS ENUM('text', 'voice', 'photo');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('REQUESTED', 'ACCEPTED', 'PRICE_AGREED', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('voice', 'text', 'chip');--> statement-breakpoint
CREATE TYPE "public"."sender_role" AS ENUM('worker', 'customer');--> statement-breakpoint
CREATE TYPE "public"."worker_status" AS ENUM('FREE', 'BUSY', 'OFF');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"pin" text DEFAULT '0000' NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"address_label" text NOT NULL,
	"rating" real DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"trade_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'REQUESTED' NOT NULL,
	"description_raw" text NOT NULL,
	"description_source" "description_source" DEFAULT 'text' NOT NULL,
	"photo_url" text,
	"ai_classification" jsonb,
	"agreed_price_amount" integer,
	"agreed_price_unit" text,
	"agreed_price_includes" jsonb,
	"price_confirmed_by_worker" boolean DEFAULT false NOT NULL,
	"price_confirmed_by_customer" boolean DEFAULT false NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"sender" "sender_role" NOT NULL,
	"kind" "message_kind" DEFAULT 'voice' NOT NULL,
	"audio_url" text,
	"duration_ms" integer,
	"transcript_ur" text,
	"transcript_en" text,
	"ai_provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voice_url" text,
	"transcript_ur" text,
	"transcript_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_ur" text NOT NULL,
	"name_roman" text NOT NULL,
	"color" text NOT NULL,
	"glyph" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trades_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "trust_summaries" (
	"worker_id" uuid PRIMARY KEY NOT NULL,
	"summary_en" text NOT NULL,
	"summary_ur" text,
	"source_review_count" integer DEFAULT 0 NOT NULL,
	"ai_provider" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"url" text NOT NULL,
	"ai_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_provider" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"label_en" text NOT NULL,
	"label_ur" text,
	"source" "ai_source" DEFAULT 'speech' NOT NULL,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"pin" text DEFAULT '0000' NOT NULL,
	"trade_id" uuid NOT NULL,
	"years_experience" integer DEFAULT 0 NOT NULL,
	"area" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"status" "worker_status" DEFAULT 'OFF' NOT NULL,
	"rate_min" integer DEFAULT 0 NOT NULL,
	"rate_max" integer DEFAULT 0 NOT NULL,
	"rating" real DEFAULT 0 NOT NULL,
	"jobs_completed" integer DEFAULT 0 NOT NULL,
	"bio_ur" text,
	"bio_en" text,
	"photo_url" text,
	"onboarded_via" text DEFAULT 'voice' NOT NULL,
	"onboarding_transcript" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_summaries" ADD CONSTRAINT "trust_summaries_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_photos" ADD CONSTRAINT "work_photos_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_skills" ADD CONSTRAINT "worker_skills_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_job_per_worker" ON "jobs" USING btree ("worker_id") WHERE "jobs"."status" in ('ACCEPTED', 'PRICE_AGREED', 'IN_PROGRESS');--> statement-breakpoint
CREATE INDEX "jobs_worker_status_idx" ON "jobs" USING btree ("worker_id","status");--> statement-breakpoint
CREATE INDEX "jobs_customer_idx" ON "jobs" USING btree ("customer_id","requested_at");--> statement-breakpoint
CREATE INDEX "messages_job_idx" ON "messages" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_worker_idx" ON "reviews" USING btree ("worker_id","created_at");--> statement-breakpoint
CREATE INDEX "work_photos_worker_idx" ON "work_photos" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "worker_skills_worker_idx" ON "worker_skills" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "workers_trade_status_idx" ON "workers" USING btree ("trade_id","status");--> statement-breakpoint
CREATE INDEX "workers_geo_idx" ON "workers" USING btree ("lat","lng");