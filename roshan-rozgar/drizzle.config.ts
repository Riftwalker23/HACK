import { defineConfig } from 'drizzle-kit';

/**
 * Generation never needs a live database, so `npm run db:generate` works
 * offline. The placeholder URL only satisfies drizzle-kit's config shape; the
 * actual connection is chosen at runtime in db/client.ts (Postgres if
 * DATABASE_URL is set, otherwise embedded PGlite).
 */
export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/roshan_rozgar',
  },
  strict: true,
  verbose: true,
});
