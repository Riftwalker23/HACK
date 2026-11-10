/**
 * POST /api/jobs/:id/accept — the critical endpoint (Outcome 4).
 *
 * Three cases, each one transaction that applies completely or not at all:
 *
 *   1. A "now" request (scheduled_for is null)        REQUESTED -> ACCEPTED
 *        - the worker -> BUSY
 *        - every OTHER "now" request for him -> DECLINED (he has one pair of
 *          hands, so they can never be filled). His bookings for later slots
 *          are left alone.
 *        - the partial unique index one_active_job_per_worker makes a second
 *          active job impossible: a race yields one winner and one 409.
 *
 *   2. A request for a later hour slot                REQUESTED -> SCHEDULED
 *        - allowed even while he is BUSY: it does not occupy him now
 *        - every OTHER request for the SAME hour -> DECLINED
 *        - the partial unique index one_booking_per_slot stops two accepted
 *          bookings sharing one worker and one hour
 *
 *   3. Taking on a booked slot (the time has come)    SCHEDULED -> ACCEPTED
 *        - the worker -> BUSY, other "now" requests -> DECLINED, exactly as in 1
 *        - one_active_job_per_worker still decides: if he is mid-job, 409
 *
 * We never pre-check "is he free" and hope it stays true a microsecond later:
 * the database is what rejects the loser.
 */

import { and, eq, isNull, ne } from 'drizzle-orm';

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

type Mode = 'accepted' | 'scheduled' | 'activated';

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
        // same request cannot both pass the checks below.
        const [current] = await tx
          .select({
            id: jobs.id,
            status: jobs.status,
            workerId: jobs.workerId,
            scheduledFor: jobs.scheduledFor,
          })
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .limit(1)
          .for('update');
        if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

        const now = new Date();
        let mode: Mode;
        let declined: Array<{ id: string }> = [];

        if (current.status === 'REQUESTED' && current.scheduledFor) {
          // ---- 2. accept a booking for a later slot ----------------------
          assertTransition('REQUESTED', 'SCHEDULED', 'worker');
          mode = 'scheduled';

          const updated = await tx
            .update(jobs)
            .set({ status: 'SCHEDULED', acceptedAt: now, updatedAt: now })
            .where(and(eq(jobs.id, jobId), eq(jobs.status, 'REQUESTED')))
            .returning({ id: jobs.id });
          if (updated.length === 0) throw new ApiError('CONFLICT', 'That request was answered a moment ago.');

          declined = await tx
            .update(jobs)
            .set({
              status: 'DECLINED',
              endedBy: 'system',
              statusReason: 'Worker accepted another booking for this time slot.',
              updatedAt: now,
            })
            .where(
              and(
                eq(jobs.workerId, current.workerId),
                eq(jobs.status, 'REQUESTED'),
                eq(jobs.scheduledFor, current.scheduledFor),
                ne(jobs.id, jobId),
              ),
            )
            .returning({ id: jobs.id });
        } else {
          // ---- 1. a "now" request, or 3. taking on a booked slot ----------
          const from = current.status;
          // Throws a precise, readable 409 for anything but REQUESTED / SCHEDULED.
          assertTransition(from, 'ACCEPTED', 'worker');
          mode = from === 'SCHEDULED' ? 'activated' : 'accepted';

          const updated = await tx
            .update(jobs)
            .set({
              status: 'ACCEPTED',
              // A booked slot keeps the time he originally said yes.
              ...(from === 'REQUESTED' ? { acceptedAt: now } : {}),
              updatedAt: now,
            })
            // The status is repeated in SQL so the write itself is conditional.
            .where(and(eq(jobs.id, jobId), eq(jobs.status, from)))
            .returning({ id: jobs.id });
          if (updated.length === 0) throw new ApiError('CONFLICT', 'That request was answered a moment ago.');

          await tx.update(workers).set({ status: 'BUSY' }).where(eq(workers.id, current.workerId));

          declined = await tx
            .update(jobs)
            .set({
              status: 'DECLINED',
              endedBy: 'system',
              statusReason: 'Worker took on another job first.',
              updatedAt: now,
            })
            .where(
              and(
                eq(jobs.workerId, current.workerId),
                eq(jobs.status, 'REQUESTED'),
                isNull(jobs.scheduledFor), // later-slot bookings survive
                ne(jobs.id, jobId),
              ),
            )
            .returning({ id: jobs.id });
        }

        return { view: await loadJobView(tx, jobId), declined: declined.map((d) => d.id), mode };
      });

      return ok(
        {
          job: toJobSummary(result.view),
          mode: result.mode,
          autoDeclined: { count: result.declined.length, jobIds: result.declined },
        },
        { serverTime: new Date().toISOString() },
      );
    } catch (err) {
      // Drizzle hides the Postgres error behind DrizzleQueryError.cause; this
      // turns the one-active-job violation back into the 409 the UI expects.
      // A one_booking_per_slot violation is rethrown and mapped by handle().
      rethrowAsWorkerBusy(err);
    }
  },
);
