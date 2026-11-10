/**
 * POST /api/jobs/:id/start — the worker begins work.
 *
 * PRICE_AGREED -> IN_PROGRESS, stamping started_at. Worker only: the customer
 * cannot declare that someone else has started working.
 *
 * The worker is already BUSY here (PRICE_AGREED is an active status), so his
 * availability does not change and no cross-table write is needed.
 */

import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { jobs } from '@/db/schema';
import { ApiError, handle, ok, uuidParam } from '@/lib/http';
import { assertTransition, loadJobView, toJobSummary } from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) throw new ApiError('BAD_REQUEST', 'Job id must be a UUID.');
    const jobId = parsed.data;

    const database = await db();

    const view = await database.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
        .for('update');
      if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

      assertTransition(current.status, 'IN_PROGRESS', 'worker');

      const now = new Date();
      await tx
        .update(jobs)
        .set({ status: 'IN_PROGRESS', startedAt: now, updatedAt: now })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'PRICE_AGREED')));

      return loadJobView(tx, jobId);
    });

    return ok({ job: toJobSummary(view) }, { serverTime: new Date().toISOString() });
  },
);
