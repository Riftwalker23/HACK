/**
 * POST /api/jobs/:id/accept — the critical endpoint (Outcome 4).
 *
 * One transaction does all four things or none of them:
 *   1. job        REQUESTED -> ACCEPTED, stamping accepted_at
 *   2. worker     -> BUSY
 *   3. every OTHER REQUESTED job for that worker -> DECLINED
 *   4. read the result back
 *
 * Step 1 is also where the partial unique index `one_active_job_per_worker`
 * fires. We do NOT pre-check "is this worker free" and hope the answer is still
 * true a microsecond later: two customers racing produce exactly one winner and
 * one 409 WORKER_BUSY, raised by Postgres.
 *
 * Step 3 is part of staying consistent, not a courtesy: he has one pair of
 * hands, so the requests he did not pick can never be filled and the platform
 * says so immediately.
 */

import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db/client';
import { jobs, workers } from '@/db/schema';
import { ApiError, handle, ok, uuidParam } from '@/lib/http';
import {
  assertTransition,
  loadJobView,
  rethrowAsWorkerBusy,
  toJobSummary,
} from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) throw new ApiError('BAD_REQUEST', 'Job id must be a UUID.');
    const jobId = parsed.data;

    const database = await db();

    try {
      const result = await database.transaction(async (tx) => {
        // Re-read inside the transaction and lock the row, so two taps on the
        // same request cannot both pass the check below.
        const [current] = await tx
          .select({ id: jobs.id, status: jobs.status, workerId: jobs.workerId })
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .limit(1)
          .for('update');
        if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

        assertTransition(current.status, 'ACCEPTED', 'worker');

        const now = new Date();

        const accepted = await tx
          .update(jobs)
          .set({ status: 'ACCEPTED', acceptedAt: now, updatedAt: now })
          // The status is repeated in SQL so the write itself is conditional —
          // cheap insurance if the lock above is ever dropped.
          .where(and(eq(jobs.id, jobId), eq(jobs.status, 'REQUESTED')))
          .returning({ id: jobs.id });
        if (accepted.length === 0) {
          throw new ApiError('CONFLICT', 'That request was answered a moment ago.');
        }

        await tx.update(workers).set({ status: 'BUSY' }).where(eq(workers.id, current.workerId));

        const declined = await tx
          .update(jobs)
          .set({ status: 'DECLINED', updatedAt: now })
          .where(
            and(
              eq(jobs.workerId, current.workerId),
              eq(jobs.status, 'REQUESTED'),
              ne(jobs.id, jobId),
            ),
          )
          .returning({ id: jobs.id });

        return { view: await loadJobView(tx, jobId), declined: declined.map((d) => d.id) };
      });

      return ok(
        {
          job: toJobSummary(result.view),
          autoDeclined: { count: result.declined.length, jobIds: result.declined },
        },
        { serverTime: new Date().toISOString() },
      );
    } catch (err) {
      // Drizzle hides the Postgres error behind DrizzleQueryError.cause; this
      // turns the index violation back into the 409 the UI expects.
      rethrowAsWorkerBusy(err);
    }
  },
);
