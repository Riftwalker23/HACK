/**
 * POST /api/jobs/:id/complete — the worker marks the job done.
 *
 * One transaction: ACCEPTED, PRICE_AGREED or IN_PROGRESS -> COMPLETED with
 * completed_at stamped, the worker set back to FREE, and his jobs_completed
 * incremented. A worker may mark the work done straight after accepting (price
 * agreement is optional); started_at then falls back to accepted_at so the
 * job's duration is still known. Half of that
 * applying would leave a worker who is permanently BUSY on a finished job —
 * precisely the inconsistency Outcome 4 is about.
 *
 * `rating` is untouched on purpose: reviews own reputation.
 */

import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { jobs, workers } from '@/db/schema';
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

    const result = await database.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: jobs.status, workerId: jobs.workerId })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
        .for('update');
      if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

      assertTransition(current.status, 'COMPLETED', 'worker');

      const now = new Date();
      await tx
        .update(jobs)
        .set({
          status: 'COMPLETED',
          completedAt: now,
          // Skipped "start"? Count the work from when he accepted.
          startedAt: sql`coalesce(${jobs.startedAt}, ${jobs.acceptedAt}, now())`,
          updatedAt: now,
        })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, current.status)));

      const [worker] = await tx
        .update(workers)
        .set({
          status: 'FREE',
          // Incremented in SQL rather than read-modify-write, so a concurrent
          // completion elsewhere cannot clobber the count.
          jobsCompleted: sql`${workers.jobsCompleted} + 1`,
        })
        .where(eq(workers.id, current.workerId))
        .returning({
          id: workers.id,
          status: workers.status,
          jobsCompleted: workers.jobsCompleted,
        });

      return { view: await loadJobView(tx, jobId), worker };
    });

    return ok(
      {
        job: toJobSummary(result.view),
        // So the customer's UI can show him free again without a second call.
        workerAvailability: {
          id: result.worker.id,
          status: result.worker.status,
          jobsCompleted: result.worker.jobsCompleted,
        },
      },
      { serverTime: new Date().toISOString() },
    );
  },
);
