/**
 * POST /api/jobs/:id/cancel — either side backs out before work starts.
 *
 * Allowed from REQUESTED (customer only — a worker turning down a request uses
 * /decline), ACCEPTED and PRICE_AGREED. NOT allowed from IN_PROGRESS: once the
 * worker is at the house and working, the job is completed, not un-booked.
 *
 * If the job was occupying the worker (an active status) the SAME transaction
 * frees him. Cancelling and forgetting to release him is exactly how a
 * marketplace ends up lying about who is available.
 */

import { and, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { ACTIVE_JOB_STATUSES, jobs, workers } from '@/db/schema';
import { ApiError, body, handle, ok, uuidParam } from '@/lib/http';
import { assertTransition, isActive, loadJobView, toJobSummary } from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  actor: z.enum(['worker', 'customer']),
  reason: z.string().trim().max(500).optional(),
});

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) throw new ApiError('BAD_REQUEST', 'Job id must be a UUID.');
    const jobId = parsed.data;

    const input = await body(req, schema);
    const database = await db();

    const result = await database.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: jobs.status, workerId: jobs.workerId })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
        .for('update');
      if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

      assertTransition(current.status, 'CANCELLED', input.actor);

      const wasOccupyingWorker = isActive(current.status);

      await tx
        .update(jobs)
        .set({
          status: 'CANCELLED',
          statusReason: input.reason ?? null,
          endedBy: input.actor,
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, current.status)));

      let freed = false;
      if (wasOccupyingWorker) {
        // Only free him if this was his last active job. It cannot be anything
        // else while the unique index holds, but the check costs one row and
        // keeps the write honest rather than merely probable.
        const [stillBusy] = await tx
          .select({ id: jobs.id })
          .from(jobs)
          .where(
            and(
              eq(jobs.workerId, current.workerId),
              inArray(jobs.status, [...ACTIVE_JOB_STATUSES]),
              ne(jobs.id, jobId),
            ),
          )
          .limit(1);

        if (!stillBusy) {
          await tx
            .update(workers)
            .set({ status: 'FREE' })
            .where(eq(workers.id, current.workerId));
          freed = true;
        }
      }

      return { view: await loadJobView(tx, jobId), freed, from: current.status };
    });

    return ok(
      {
        job: toJobSummary(result.view),
        cancelledFrom: result.from,
        reason: result.view.statusReason,
        workerAvailability: {
          status: result.view.workerStatus,
          freedByThisCancellation: result.freed,
        },
      },
      { serverTime: new Date().toISOString() },
    );
  },
);
