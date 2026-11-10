/**
 * GET /api/trades — the trade-selection icon grid.
 *
 * A worker who cannot read picks his trade by recognising his own tool, so this
 * endpoint must return the whole quadruple (colour + glyph + Urdu + Roman) for
 * every trade, and it must never be partial — a missing trade is a worker who
 * cannot onboard. One query, one group-by; the FREE count is live so the
 * customer-side grid can show "6 electricians free now".
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { trades, workers } from '@/db/schema';
import { TRADE_SLUGS } from '@/data/trades';
import { handle, ok } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request) => {
  const database = await db();

  const rows = await database
    .select({
      trade: trades,
      // cast(... as int) because count() comes back as a bigint string.
      totalWorkers: sql<number>`cast(count(${workers.id}) as int)`,
      freeWorkers: sql<number>`cast(count(${workers.id}) filter (where ${workers.status} = 'FREE') as int)`,
    })
    .from(trades)
    .leftJoin(workers, eq(workers.tradeId, trades.id))
    .groupBy(trades.id);

  // Display order is the canonical order from data/trades.ts (the design grid),
  // not insertion order; anything unseeded falls to the end alphabetically.
  const rank = (slug: string) => {
    const i = TRADE_SLUGS.indexOf(slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const data = rows
    .sort((a, b) => {
      const byRank = rank(a.trade.slug) - rank(b.trade.slug);
      return byRank !== 0 ? byRank : a.trade.slug.localeCompare(b.trade.slug);
    })
    .map(({ trade, totalWorkers, freeWorkers }) => ({
      id: trade.id,
      slug: trade.slug,
      nameEn: trade.nameEn,
      nameUr: trade.nameUr,
      nameRoman: trade.nameRoman,
      color: trade.color,
      glyph: trade.glyph,
      keywords: trade.keywords,
      totalWorkers: Number(totalWorkers),
      freeWorkers: Number(freeWorkers),
    }));

  return ok(data, {
    count: data.length,
    freeWorkers: data.reduce((sum, t) => sum + t.freeWorkers, 0),
    totalWorkers: data.reduce((sum, t) => sum + t.totalWorkers, 0),
  });
});
