/**
 * POST /api/jobs/:id/price — the two-tap price agreement (Outcome 3 -> 4).
 *
 * Two modes:
 *   propose  { actor, amount, unit, includes? }  write the number; the proposer
 *            is counted as agreeing to it and the OTHER side's flag is cleared,
 *            because agreement is always about one specific figure.
 *   confirm  { actor, confirm: true }            the other side taps yes.
 *
 * When both flags are true the job moves ACCEPTED -> PRICE_AGREED. There is no
 * edge back, so an agreed figure cannot be quietly rewritten — renegotiating
 * means cancelling.
 *
 * `amount`/`unit`/`includes` arrive already structured. The AI layer extracted
 * them from the worker's spoken quote; this route never calls a model.
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { jobs } from '@/db/schema';
import { ApiError, body, handle, ok, uuidParam } from '@/lib/http';
import {
  assertTransition,
  loadJobView,
  priceStateOf,
  toJobSummary,
  type Actor,
} from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actorSchema = z.enum(['worker', 'customer']);

const proposeSchema = z.object({
  mode: z.literal('propose').optional(),
  actor: actorSchema,
  /** Whole PKR. */
  amount: z.number().int().positive().max(10_000_000),
  /** e.g. "per visit", "per hour", "fixed" — the worker's own words, normalised. */
  unit: z.string().trim().min(1).max(40),
  includes: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
});

const confirmSchema = z.object({
  mode: z.literal('confirm').optional(),
  actor: actorSchema,
  confirm: z.literal(true),
});

const schema = z.union([proposeSchema, confirmSchema]);

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const parsedId = uuidParam.safeParse(id);
    if (!parsedId.success) throw new ApiError('BAD_REQUEST', 'Job id must be a UUID.');
    const jobId = parsedId.data;

    const input = await body(req, schema);
    const actor: Actor = input.actor;
    // Narrow once so the propose-only fields stay typed below.
    const proposal = 'amount' in input ? input : null;

    const database = await db();

    const view = await database.transaction(async (tx) => {
      const [current] = await tx
        .select({
          status: jobs.status,
          agreedPriceAmount: jobs.agreedPriceAmount,
          priceConfirmedByWorker: jobs.priceConfirmedByWorker,
          priceConfirmedByCustomer: jobs.priceConfirmedByCustomer,
        })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
        .for('update');
      if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

      if (current.status !== 'ACCEPTED' && current.status !== 'PRICE_AGREED') {
        throw new ApiError(
          'INVALID_TRANSITION',
          `A price can only be negotiated on an ACCEPTED job — this one is ${current.status}.`,
          { from: current.status },
        );
      }

      if (current.status === 'PRICE_AGREED') {
        if (proposal) {
          throw new ApiError(
            'INVALID_TRANSITION',
            'This price is already agreed — cancel the job to renegotiate.',
            { from: 'PRICE_AGREED' },
          );
        }
        // Confirming an already-agreed price is a no-op, not an error: the tap
        // may simply have been sent twice on a flaky connection.
        return loadJobView(tx, jobId);
      }

      const next = {
        worker: current.priceConfirmedByWorker,
        customer: current.priceConfirmedByCustomer,
      };
      if (proposal) {
        next.worker = actor === 'worker';
        next.customer = actor === 'customer';
      } else if (actor === 'worker') {
        next.worker = true;
      } else {
        next.customer = true;
      }

      if (!proposal && current.agreedPriceAmount === null) {
        throw new ApiError('BAD_REQUEST', 'There is no price on this job to confirm yet.');
      }

      const agreed = next.worker && next.customer;
      if (agreed) assertTransition('ACCEPTED', 'PRICE_AGREED', actor);

      await tx
        .update(jobs)
        .set({
          ...(proposal
            ? {
                agreedPriceAmount: proposal.amount,
                agreedPriceUnit: proposal.unit,
                agreedPriceIncludes: proposal.includes ?? [],
              }
            : {}),
          priceConfirmedByWorker: next.worker,
          priceConfirmedByCustomer: next.customer,
          ...(agreed ? { status: 'PRICE_AGREED' as const } : {}),
          updatedAt: new Date(),
        })
        // Re-stated in SQL so the write cannot land on a job that moved on.
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'ACCEPTED')));

      return loadJobView(tx, jobId);
    });

    return ok(
      {
        job: toJobSummary(view),
        /** 'none' | 'awaiting_worker' | 'awaiting_customer' | 'agreed' */
        priceState: priceStateOf(view),
      },
      { serverTime: new Date().toISOString() },
    );
  },
);
