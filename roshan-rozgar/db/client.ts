/**
 * Database client with a zero-credential fallback.
 *
 * Why: a hackathon demo must not depend on a cloud Postgres being reachable
 * from venue wifi. So:
 *
 *   DATABASE_URL set   -> real Postgres (Supabase / Neon) via postgres-js
 *   DATABASE_URL unset -> PGlite, an embedded Postgres (WASM) persisted to
 *                         ./.data/pglite
 *
 * PGlite is real Postgres, not SQLite, so partial unique indexes, enums and
 * jsonb all behave identically to production. `npm run db:migrate && npm run
 * seed && npm run dev` works on a fresh clone with no credentials at all.
 */

import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Driver = 'postgres' | 'pglite';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema, any>;

type Handle = { db: Db; driver: Driver; close: () => Promise<void> };

// Next.js hot-reloads route modules; without this cache PGlite would be
// re-instantiated per reload and lock its data directory.
const globalForDb = globalThis as unknown as { __roshanDb?: Handle };

export const PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR ?? './.data/pglite';

async function create(): Promise<Handle> {
  const url = process.env.DATABASE_URL?.trim();

  if (url) {
    const { default: postgres } = await import('postgres');
    // max:1 keeps the hackathon well under free-tier connection caps.
    // prepare:false is required by Supabase's transaction pooler (port 6543).
    // Supabase only accepts TLS; require it unless the URL already says otherwise.
    const needsSsl = /supabase\.(co|com)/.test(url) && !/sslmode=/.test(url);
    const sql = postgres(url, { max: 1, prepare: false, ...(needsSsl ? { ssl: 'require' as const } : {}) });
    return {
      db: drizzlePg(sql, { schema }) as unknown as Db,
      driver: 'postgres',
      close: async () => {
        await sql.end({ timeout: 5 });
      },
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  // PGlite's node filesystem backend does not create parent directories.
  const { mkdir } = await import('node:fs/promises');
  await mkdir(PGLITE_DATA_DIR, { recursive: true });
  const client = await PGlite.create({ dataDir: PGLITE_DATA_DIR });
  return {
    db: drizzlePglite(client, { schema }) as unknown as Db,
    driver: 'pglite',
    close: async () => {
      await client.close();
    },
  };
}

/** Process-wide singleton. Safe to call from every route handler. */
export async function getDb(): Promise<Handle> {
  if (!globalForDb.__roshanDb) {
    globalForDb.__roshanDb = await create();
  }
  return globalForDb.__roshanDb;
}

/** Convenience for call sites that only need the query builder. */
export async function db(): Promise<Db> {
  return (await getDb()).db;
}

export { schema };
