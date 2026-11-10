/**
 * POST /api/jobs  — a customer requests a specific worker.
 * GET  /api/jobs  — the job list for one side of the marketplace.
 *
 * A REQUESTED job deliberately does NOT occupy the worker. Several customers
 * may request the same free worker and he picks one; the losers are
 * auto-declined when he accepts (see ./[id]/accept).
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { ACTIVE_JOB_STATUSES, jobStatus, jobs, trades, workers, customers } from '@/db/schema';
import { ApiError, body, handle, ok, uuidParam } from '@/lib/http';
import { jobViewColumns, loadJobView, toJobSummary, type JobViewRow } from '@/lib/jobs-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST — create a request
// ---------------------------------------------------------------------------

const createSchema = z.object({
  customerId: uuidParam,
  workerId: uuidParam,
  descriptionRaw: z.string().trim().min(3).max(2000),
  descriptionSource: z.enum(['text', 'voice', 'photo']).default('text'),
  /** May be a storage URL or a local blob path, so it is not URL-validated. */
  photoUrl: z.string().min(1).max(2000).optional(),
  /**
   * Classifier output, passed through from the AI layer by the caller. This
   * route never calls a model itself — all AI-derived values arrive as input.
   */
  aiClassification: z
    .object({
      tradeSlug: z.string().min(1),
      urgency: z.enum(['low', 'normal', 'urgent']),
      likelyFix: z.string().max(500),
      keywords: z.array(z.string().max(80)).max(20),
      confidence: z.number().min(0).max(1),
      /**
       * Which model produced this classification. /api/ai/classify-problem
       * reports it in `meta.ai`, not inside the classification object, so a
       * client that forwards `data` verbatim legitimately omits it. Default
       * rather than reject — losing the job request over a provenance label
       * would be the wrong trade — but never claim a provider we weren't told.
       */
      provider: z.string().min(1).max(60).default('unreported'),
    })
    .optional(),
});

export const POST = handle(async (req: Request) => {
  const input = await body(req, createSchema);
  const database = await db();

  const created = await database.transaction(async (tx) => {
    const [worker] = await tx
      .select({ id: workers.id, tradeId: workers.tradeId, status: workers.status })
      .from(workers)
      .where(eq(workers.id, input.workerId))
      .limit(1);
    if (!worker) throw new ApiError('NOT_FOUND', 'No such worker.');

    const [customer] = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);
    if (!customer) throw new ApiError('NOT_FOUND', 'No such customer.');

    // Both of these are UX guards, not the consistency guarantee: they stop a
    // customer wasting a tap on someone who cannot come. The guarantee is the
    // partial unique index, and it only bites at accept time.
    if (worker.status !== 'FREE') {
      throw new ApiError('WORKER_BUSY', 'That worker is not available right now.', {
        workerStatus: worker.status,
      });
    }

    const [held] = await tx
      .select({ id: jobs.id, status: jobs.status })
      .from(jobs)
      .where(
        and(eq(jobs.workerId, input.workerId), inArray(jobs.status, [...ACTIVE_JOB_STATUSES])),
      )
      .limit(1);
    if (held) {
      throw new ApiError('WORKER_BUSY', 'That worker is already on a job.', {
        activeJobId: held.id,
        activeJobStatus: held.status,
      });
    }

    const [row] = await tx
      .insert(jobs)
      .values({
        customerId: input.customerId,
        workerId: input.workerId,
        // Resolved server-side: the client does not get to say what trade this is.
        tradeId: worker.tradeId,
        status: 'REQUESTED',
        descriptionRaw: input.descriptionRaw,
        descriptionSource: input.descriptionSource,
        photoUrl: input.photoUrl ?? null,
        aiClassification: input.aiClassification ?? null,
      })
      .returning({ id: jobs.id });

    return loadJobView(tx, row.id);
  });

  return ok(toJobSummary(created), { serverTime: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// GET — list jobs (also the polling endpoint used as the realtime fallback)
// ---------------------------------------------------------------------------

const statusValues = z.enum(jobStatus.enumValues);

export const GET = handle(async (req: Request) => {
  const params = new URL(req.url).searchParams;

  const workerId = params.get('workerId');
  const customerId = params.get('customerId');
  if (!workerId && !customerId) {
    throw new ApiError('BAD_REQUEST', 'Pass workerId or customerId (or both).');
  }

  const filters = [];
  if (workerId) filters.push(eq(jobs.workerId, uuidParse(workerId, 'workerId')));
  if (customerId) filters.push(eq(jobs.customerId, uuidParse(customerId, 'customerId')));

  // `status` is repeatable and also accepts a comma-separated list, because a
  // polling client builds its query string by hand.
  const requested = params
    .getAll('status')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const parsedStatuses = z.array(statusValues).safeParse(requested);
  if (!parsedStatuses.success) {
    throw new ApiError('BAD_REQUEST', 'Unknown status filter.', {
      allowed: jobStatus.enumValues,
      received: requested,
    });
  }

  const wantActive = params.get('active') === 'true';
  const statuses = wantActive
    ? parsedStatuses.data.length
      ? parsedStatuses.data.filter((s) => (ACTIVE_JOB_STATUSES as readonly string[]).includes(s))
      : [...ACTIVE_JOB_STATUSES]
    : parsedStatuses.data;

  if (wantActive && statuses.length === 0) {
    // `active=true` plus a terminal status filter can only ever be empty.
    return ok([], { count: 0, serverTime: new Date().toISOString() });
  }
  if (statuses.length) filters.push(inArray(jobs.status, statuses));

  const limit = Math.min(Math.max(Number(params.get('limit') ?? 50) || 50, 1), 200);

  const database = await db();
  const rows = (await database
    .select(jobViewColumns)
    .from(jobs)
    .innerJoin(workers, eq(workers.id, jobs.workerId))
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .innerJoin(trades, eq(trades.id, jobs.tradeId))
    .where(and(...filters))
    .orderBy(desc(jobs.requestedAt), desc(jobs.id))
    .limit(limit)) as JobViewRow[];

  return ok(rows.map(toJobSummary), {
    count: rows.length,
    limit,
    // Lets a polling client reason about clock skew without a second request.
    serverTime: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuidParse(value: string, field: string): string {
  const parsed = uuidParam.safeParse(value);
  if (!parsed.success) throw new ApiError('BAD_REQUEST', `${field} must be a UUID.`);
  return parsed.data;
}
