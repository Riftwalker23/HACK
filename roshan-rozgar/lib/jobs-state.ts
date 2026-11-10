/**
 * The booking state machine (Outcome 4).
 *
 * Two layers guard consistency, and it matters which does what:
 *
 *   1. THIS FILE decides whether a move is legal and who may make it. It is
 *      pure — no database, no request — so it can be reasoned about and tested
 *      on its own.
 *   2. THE DATABASE decides who wins a race. The partial unique index
 *      `one_active_job_per_worker` (db/schema.ts) makes a second active job for
 *      one worker physically impossible. No amount of application logic is
 *      trusted with that invariant, because application logic runs twice when
 *      two customers tap "Request" at the same millisecond.
 *
 * Routes therefore re-read the job INSIDE the transaction, call
 * `assertTransition`, and let the index raise 23505 if it still loses the race.
 *
 * The lower half of the file holds the shared job view (one join, one response
 * shape) so that all nine /api/jobs routes answer in the same format.
 */

import { eq, getTableColumns } from 'drizzle-orm';

import type { Db } from '@/db/client';
import {
  ACTIVE_JOB_STATUSES,
  customers,
  jobs,
  trades,
  workers,
  type Job,
  type JobStatus,
  type WorkerStatus,
} from '@/db/schema';
import { ApiError } from '@/lib/http';

// ---------------------------------------------------------------------------
// The machine
// ---------------------------------------------------------------------------

/**
 * Who is making the move. 'system' is the platform itself and exists for
 * exactly one edge: auto-declining the requests a worker did not pick.
 */
export type Actor = 'worker' | 'customer' | 'system';

export type TransitionRule = {
  readonly to: JobStatus;
  readonly actors: readonly Actor[];
  /** Plain English, reused by the README and the error details. */
  readonly why: string;
};

/**
 * Every legal edge, and the only roles allowed to travel it.
 *
 * A status with an empty list is terminal. `CANCELLED` is reachable before work
 * starts only: once a worker is at the house and working, the job is completed,
 * not un-booked. SCHEDULED is not an active status: a booked later slot does not
 * occupy the worker, so he can be busy now and still hold bookings.
 */
export const TRANSITIONS: Readonly<Record<JobStatus, readonly TransitionRule[]>> = {
  REQUESTED: [
    { to: 'ACCEPTED', actors: ['worker'], why: 'the worker takes a "now" request' },
    {
      to: 'SCHEDULED',
      actors: ['worker'],
      why: 'the worker accepts a request for a later time slot — allowed even while he is busy',
    },
    {
      to: 'DECLINED',
      actors: ['worker', 'system'],
      why: 'the worker turns it down, or the platform retires it because he accepted a competing request',
    },
    { to: 'CANCELLED', actors: ['customer'], why: 'the customer withdraws before anyone accepted' },
  ],
  SCHEDULED: [
    {
      to: 'ACCEPTED',
      actors: ['worker'],
      why: 'the slot has come and the worker takes the job on — it now occupies him',
    },
    { to: 'CANCELLED', actors: ['worker', 'customer'], why: 'either side cancels the booked slot' },
  ],
  ACCEPTED: [
    {
      to: 'PRICE_AGREED',
      actors: ['worker', 'customer'],
      why: 'both sides have confirmed the same quoted price',
    },
    {
      to: 'COMPLETED',
      actors: ['worker'],
      why: 'the worker marks the work done; an agreed price is optional',
    },
    { to: 'CANCELLED', actors: ['worker', 'customer'], why: 'either side backs out before work starts' },
  ],
  PRICE_AGREED: [
    { to: 'IN_PROGRESS', actors: ['worker'], why: 'the worker starts work' },
    { to: 'COMPLETED', actors: ['worker'], why: 'the worker marks the work done' },
    { to: 'CANCELLED', actors: ['worker', 'customer'], why: 'either side backs out before work starts' },
  ],
  IN_PROGRESS: [{ to: 'COMPLETED', actors: ['worker'], why: 'the worker marks the job done' }],
  COMPLETED: [],
  DECLINED: [],
  CANCELLED: [],
};

/** The statuses that occupy a worker — read straight off the schema constant
 *  the partial unique index is built from, so the two can never disagree. */
export function isActive(status: JobStatus): boolean {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

export function isTerminal(status: JobStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function allowedTransitions(from: JobStatus): readonly TransitionRule[] {
  return TRANSITIONS[from];
}

export function canTransition(from: JobStatus, to: JobStatus, actor: Actor): boolean {
  const rule = TRANSITIONS[from].find((r) => r.to === to);
  return Boolean(rule && rule.actors.includes(actor));
}

/**
 * Throws unless `actor` may move a job from `from` to `to`.
 *
 * Messages name both states on purpose: this error reaches the UI as a 409 and
 * a demo audience should be able to read it off the screen.
 */
export function assertTransition(from: JobStatus, to: JobStatus, actor: Actor): TransitionRule {
  const details = {
    from,
    to,
    actor,
    allowed: TRANSITIONS[from].map((r) => ({ to: r.to, actors: r.actors })),
  };

  if (from === to) {
    throw new ApiError('INVALID_TRANSITION', `This job is already ${from}.`, details);
  }

  if (isTerminal(from)) {
    throw new ApiError(
      'INVALID_TRANSITION',
      `${from} is a final state — this job cannot move from ${from} to ${to}.`,
      details,
    );
  }

  const rule = TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) {
    throw new ApiError(
      'INVALID_TRANSITION',
      `A job cannot move from ${from} to ${to}.`,
      details,
    );
  }

  if (!rule.actors.includes(actor)) {
    throw new ApiError(
      'INVALID_TRANSITION',
      `Only the ${rule.actors.join(' or the ')} may move a job from ${from} to ${to} — not the ${actor}.`,
      details,
    );
  }

  return rule;
}

/** The timestamp column a target status stamps, or null if it stamps none. */
export type JobTimestampColumn = 'acceptedAt' | 'startedAt' | 'completedAt';

export function timestampFor(to: JobStatus): JobTimestampColumn | null {
  switch (to) {
    case 'ACCEPTED':
    case 'SCHEDULED':
      return 'acceptedAt';
    case 'IN_PROGRESS':
      return 'startedAt';
    case 'COMPLETED':
      return 'completedAt';
    default:
      // DECLINED / CANCELLED / PRICE_AGREED have no dedicated column in the
      // schema; `updatedAt` carries when they happened.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Price agreement
// ---------------------------------------------------------------------------

/**
 * 'awaiting_x' means x has not confirmed the number currently on the job. A new
 * proposal always clears the other side's flag, so agreement is always about
 * one specific amount rather than about "a price" in general.
 */
export type PriceState = 'none' | 'awaiting_worker' | 'awaiting_customer' | 'agreed';

export function priceStateOf(job: {
  status: JobStatus;
  agreedPriceAmount: number | null;
  priceConfirmedByWorker: boolean;
  priceConfirmedByCustomer: boolean;
}): PriceState {
  if (job.agreedPriceAmount === null) return 'none';
  if (job.priceConfirmedByWorker && job.priceConfirmedByCustomer) return 'agreed';
  if (!job.priceConfirmedByWorker) return 'awaiting_worker';
  return 'awaiting_customer';
}

// ---------------------------------------------------------------------------
// Unique-violation detection
// ---------------------------------------------------------------------------

/**
 * Drizzle wraps driver errors in `DrizzleQueryError` and hangs the real
 * Postgres error off `.cause`, so `lib/http.ts`'s top-level 23505 check cannot
 * see it. Unwrapping here keeps the race a clean 409 WORKER_BUSY instead of a
 * 500 — note we still never *pre-check*; the database is what rejected the row.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  let cursor: unknown = err;
  for (let depth = 0; cursor && depth < 6; depth += 1) {
    const e = cursor as { code?: string; constraint?: string; constraint_name?: string; message?: string; cause?: unknown };
    if (e.code === '23505') {
      if (!constraint) return true;
      const named = e.constraint ?? e.constraint_name ?? '';
      if (named === constraint || (e.message ?? '').includes(constraint)) return true;
    }
    cursor = e.cause;
  }
  return false;
}

export const ONE_ACTIVE_JOB_INDEX = 'one_active_job_per_worker';

/** Rethrows a `one_active_job_per_worker` violation as the 409 the UI expects. */
export function rethrowAsWorkerBusy(err: unknown): never {
  if (isUniqueViolation(err, ONE_ACTIVE_JOB_INDEX)) {
    throw new ApiError(
      'WORKER_BUSY',
      'That worker just took another job.',
      { constraint: ONE_ACTIVE_JOB_INDEX, enforcedBy: 'database' },
    );
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Serialisation — shared by every /api/jobs route so the frontend sees one shape
// ---------------------------------------------------------------------------

/** Column set for the standard four-table job join. */
export const jobViewColumns = {
  ...getTableColumns(jobs),
  workerName: workers.name,
  workerPhone: workers.phone,
  workerStatus: workers.status,
  workerRating: workers.rating,
  workerJobsCompleted: workers.jobsCompleted,
  workerArea: workers.area,
  workerPhotoUrl: workers.photoUrl,
  customerName: customers.name,
  customerPhone: customers.phone,
  customerAddressLabel: customers.addressLabel,
  tradeSlug: trades.slug,
  tradeNameEn: trades.nameEn,
  tradeNameUr: trades.nameUr,
  tradeColor: trades.color,
  tradeGlyph: trades.glyph,
};

export type JobViewRow = Job & {
  workerName: string;
  workerPhone: string;
  workerStatus: WorkerStatus;
  workerRating: number;
  workerJobsCompleted: number;
  workerArea: string;
  workerPhotoUrl: string | null;
  customerName: string;
  customerPhone: string;
  customerAddressLabel: string;
  tradeSlug: string;
  tradeNameEn: string;
  tradeNameUr: string;
  tradeColor: string;
  tradeGlyph: string;
};

export type JobSummary = {
  id: string;
  status: JobStatus;
  /** Whether this job currently occupies its worker. */
  isActive: boolean;
  /** ISO start of the booked hour slot, or null for a "now" job. */
  scheduledFor: string | null;
  worker: {
    id: string;
    name: string;
    phone: string;
    status: WorkerStatus;
    rating: number;
    jobsCompleted: number;
    area: string;
    photoUrl: string | null;
  };
  customer: { id: string; name: string; phone: string; addressLabel: string };
  trade: { id: string; slug: string; nameEn: string; nameUr: string; color: string; glyph: string };
  description: { raw: string; source: Job['descriptionSource']; photoUrl: string | null };
  /** Populated only for DECLINED / CANCELLED jobs. */
  ended: { by: string | null; reason: string | null } | null;
  price: {
    amount: number | null;
    unit: string | null;
    includes: string[] | null;
    confirmedByWorker: boolean;
    confirmedByCustomer: boolean;
    state: PriceState;
  };
  timestamps: {
    requestedAt: string;
    acceptedAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    updatedAt: string;
  };
};

export type JobDetail = JobSummary & {
  aiClassification: Job['aiClassification'];
  messageCount: number;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toJobSummary(row: JobViewRow): JobSummary {
  return {
    id: row.id,
    status: row.status,
    isActive: isActive(row.status),
    scheduledFor: iso(row.scheduledFor),
    worker: {
      id: row.workerId,
      name: row.workerName,
      phone: row.workerPhone,
      status: row.workerStatus,
      rating: row.workerRating,
      jobsCompleted: row.workerJobsCompleted,
      area: row.workerArea,
      photoUrl: row.workerPhotoUrl,
    },
    customer: {
      id: row.customerId,
      name: row.customerName,
      phone: row.customerPhone,
      addressLabel: row.customerAddressLabel,
    },
    trade: {
      id: row.tradeId,
      slug: row.tradeSlug,
      nameEn: row.tradeNameEn,
      nameUr: row.tradeNameUr,
      color: row.tradeColor,
      glyph: row.tradeGlyph,
    },
    description: {
      raw: row.descriptionRaw,
      source: row.descriptionSource,
      photoUrl: row.photoUrl,
    },
    ended:
      row.status === 'DECLINED' || row.status === 'CANCELLED'
        ? { by: row.endedBy, reason: row.statusReason }
        : null,
    price: {
      amount: row.agreedPriceAmount,
      unit: row.agreedPriceUnit,
      includes: row.agreedPriceIncludes ?? null,
      confirmedByWorker: row.priceConfirmedByWorker,
      confirmedByCustomer: row.priceConfirmedByCustomer,
      state: priceStateOf(row),
    },
    timestamps: {
      requestedAt: row.requestedAt.toISOString(),
      acceptedAt: iso(row.acceptedAt),
      startedAt: iso(row.startedAt),
      completedAt: iso(row.completedAt),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export function toJobDetail(row: JobViewRow, messageCount: number): JobDetail {
  return { ...toJobSummary(row), aiClassification: row.aiClassification, messageCount };
}

/**
 * The standard four-table job join, by id. `Db` also accepts a transaction
 * handle (`PgTransaction` extends `PgDatabase`), which is how every mutating
 * route reads its result back without leaving the transaction.
 */
export async function loadJobView(tx: Db, id: string): Promise<JobViewRow> {
  const [row] = await tx
    .select(jobViewColumns)
    .from(jobs)
    .innerJoin(workers, eq(workers.id, jobs.workerId))
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .innerJoin(trades, eq(trades.id, jobs.tradeId))
    .where(eq(jobs.id, id))
    .limit(1);
  if (!row) throw new ApiError('NOT_FOUND', 'No such job.');
  return row as JobViewRow;
}

// ---------------------------------------------------------------------------
// Documentation — exported so the README and the demo say the same thing
// ---------------------------------------------------------------------------

/** One row per legal edge, for generating the README table. */
export function transitionTable(): Array<{ from: JobStatus; to: JobStatus; who: string; why: string }> {
  return (Object.keys(TRANSITIONS) as JobStatus[]).flatMap((from) =>
    TRANSITIONS[from].map((rule) => ({
      from,
      to: rule.to,
      who: rule.actors.join(' / '),
      why: rule.why,
    })),
  );
}

export const STATE_MACHINE_DESCRIPTION = `
Booking state machine — Roshan Rozgar

A job starts as REQUESTED. A request does NOT occupy the worker: several
customers may request the same worker at once, and he picks one. That is why
"requested" is deliberately absent from the active set.

The worker ACCEPTS one request. In a single transaction the job becomes
ACCEPTED, the worker flips to BUSY, and every other REQUESTED job for that
worker is auto-DECLINED — he has one pair of hands, so the competing requests
are dead and the platform says so immediately rather than leaving customers
waiting on a request that can never be filled.

A request can also be for a LATER hour slot (scheduled_for). The worker may
accept that even while he is busy: the job becomes SCHEDULED, which does not
occupy him, and a second unique index (one_booking_per_slot) stops two accepted
bookings sharing one worker and one hour. When the slot comes he takes it on
(SCHEDULED -> ACCEPTED), and only then does the one-active-job index apply.

ACCEPTED, PRICE_AGREED and IN_PROGRESS are the three "active" statuses, and a
partial unique index on jobs(worker_id) covering exactly those three makes a
second active job for one worker impossible. Two customers accepted at the same
instant produce one winner and one HTTP 409 WORKER_BUSY raised by Postgres —
not a UI check that hoped for the best.

Price is negotiated while ACCEPTED. A proposal (amount + unit + what it
includes, extracted from the worker's spoken quote) sets the proposer's
confirmation flag and clears the other side's: agreement is always about one
specific number. When both flags are true the job moves to PRICE_AGREED. There
is no edge back from PRICE_AGREED to ACCEPTED — to change an agreed price you
cancel and re-request, so an agreed figure cannot be quietly rewritten.

The worker STARTS the job (PRICE_AGREED -> IN_PROGRESS, stamping started_at) and
COMPLETES it (-> COMPLETED, stamping completed_at). He may also mark the work done
straight from ACCEPTED or PRICE_AGREED: price agreement is optional, and started_at
then falls back to accepted_at so the duration is still known. Completion, in one
transaction, also sets the worker back to FREE and increments his
jobs_completed, so the customer's "available now" list is correct the moment the
response lands. Ratings are not touched here — reviews own that.

CANCELLED is reachable from REQUESTED (customer), ACCEPTED and PRICE_AGREED
(either side). It is NOT reachable from IN_PROGRESS: once the worker is at the
house and working, the job finishes, it is not un-booked. If the cancelled job
was occupying the worker, the same transaction frees him.

COMPLETED, DECLINED and CANCELLED are final.
`.trim();
