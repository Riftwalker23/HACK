/**
 * GET /api/jobs/:id — full detail for one job.
 *
 * This is the poll-fallback endpoint for a single job screen (PROJECT.md §3.4),
 * so it carries everything either side's UI needs: both price-confirmation
 * flags, every timestamp, and the message count for the chat badge.
 */

import { count, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { messages } from '@/db/schema';
import { ApiError, handle, ok, uuidParam } from '@/lib/http';
import { loadJobView, toJobDetail } from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    // Next.js 16: `params` is a promise.
    const { id } = await ctx.params;
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) throw new ApiError('BAD_REQUEST', 'Job id must be a UUID.');

    const database = await db();
    const row = await loadJobView(database, parsed.data);
    const [tally] = await database
      .select({ n: count() })
      .from(messages)
      .where(eq(messages.jobId, parsed.data));

    return ok(toJobDetail(row, Number(tally?.n ?? 0)), {
      serverTime: new Date().toISOString(),
    });
  },
);
