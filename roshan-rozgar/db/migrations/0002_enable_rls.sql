-- Supabase exposes every table in the `public` schema through its auto-generated
-- REST API to anyone holding the public anon key. This app never uses that API:
-- all data access goes through the Next.js route handlers over a direct Postgres
-- connection, as the table owner (which bypasses row-level security).
--
-- Enabling RLS with NO policies therefore changes nothing for the app and denies
-- the anon/authenticated roles everything. Harmless on plain Postgres and PGlite.
ALTER TABLE "trades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "worker_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trust_summaries" ENABLE ROW LEVEL SECURITY;
