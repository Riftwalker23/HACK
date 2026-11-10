/**
 * POST /api/jobs/:id/decline — the worker turns a request down.
 *
 * REQUESTED -> DECLINED, and the worker's availability is deliberately left
 * alone: a mere request never occupied him, so declining one cannot free him.
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { jobs } from '@/db/schema';
import { ApiError, handle, ok, uuidParam } from '@/lib/http';
import { assertTransition, loadJobView, toJobSummary } from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ reason: z.string().trim().max(500).optional() });

export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const parsed = uuidParam.safeParse(id);
    if (!parsed.success) throw new ApiError('BAD_REQUEST', 'Job id must be a UUID.');
    const jobId = parsed.data;

    // A declining tap may legitimately carry no body at all.
    const raw = (await req.text()).trim();
    let payload: unknown = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new ApiError('BAD_REQUEST', 'Body must be valid JSON.');
      }
    }
    const input = schema.safeParse(payload);
    if (!input.success) throw new ApiError('BAD_REQUEST', 'Invalid request body.');

    const database = await db();

    const view = await database.transaction(async (tx) => {
      const [current] = await tx
        .select({ status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
        .for('update');
      if (!current) throw new ApiError('NOT_FOUND', 'No such job.');

      assertTransition(current.status, 'DECLINED', 'worker');

      await tx
        .update(jobs)
        .set({ status: 'DECLINED', updatedAt: new Date() })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, 'REQUESTED')));

      return loadJobView(tx, jobId);
    });

    return ok(
      {
        job: toJobSummary(view),
        // Echoed, not stored: the schema has no decline-reason column and this
        // route does not own the schema.
        reason: input.data.reason ?? null,
        workerAvailability: { status: view.workerStatus, changed: false },
      },
      { serverTime: new Date().toISOString() },
    );
  },
);
