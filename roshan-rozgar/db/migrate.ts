/**
 * Applies the generated SQL migrations to whichever driver is active.
 * Idempotent — drizzle records applied migrations in __drizzle_migrations.
 *
 *   npm run db:migrate
 */

import { getDb } from './client';

async function main() {
  const { db, driver, close } = await getDb();
  const folder = './db/migrations';

  console.log(`[migrate] driver=${driver}`);

  if (driver === 'pglite') {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: folder });
  } else {
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: folder });
  }

  console.log('[migrate] done');
  await close();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
