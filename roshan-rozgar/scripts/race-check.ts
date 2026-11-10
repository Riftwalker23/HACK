/**
 * Concurrent double-accept check — the Outcome 4 consistency proof.
 *
 *   npx tsx scripts/race-check.ts [--verbose]
 *
 * PROJECT.md §3.3 makes one headline architectural claim: "the platform stays
 * consistent about which workers are free", enforced by a PARTIAL UNIQUE INDEX
 * rather than by a UI check:
 *
 *   CREATE UNIQUE INDEX one_active_job_per_worker ON jobs (worker_id)
 *     WHERE status IN ('ACCEPTED','PRICE_AGREED','IN_PROGRESS');
 *
 * This script proves that claim at three different levels, because exactly one
 * of them depends on the driver and the other two do not:
 *
 *   A. THE RACE (driver-dependent). Two accepts on the same worker, fired with
 *      Promise.allSettled against the real route handler. Exactly one wins and
 *      exactly one gets a 409. WHICH guard produces the 409 depends on where
 *      the database is:
 *        - real Postgres (DATABASE_URL set): the two transactions genuinely
 *          interleave, the loser's write reaches the index and Postgres raises
 *          23505 -> 409 WORKER_BUSY.
 *        - embedded PGlite (DATABASE_URL unset): PGlite has ONE connection and
 *          serialises transactions through a mutex, so the calls queue. The
 *          winner's transaction (which auto-DECLINEs the worker's other
 *          REQUESTED jobs) has already committed by the time the loser reads
 *          its row, so the state machine rejects it from a terminal status
 *          first -> 409 INVALID_TRANSITION. The index is never reached.
 *      Both are correct outcomes; only one of them is the index. So this script
 *      accepts either and SAYS WHICH ONE HAPPENED instead of pretending the
 *      stronger result was proven.
 *
 *   B. THE INDEX ITSELF (driver-independent). Raw SQL, no application code: with
 *      the worker already holding one active job, UPDATE a second of his jobs to
 *      'ACCEPTED'. Postgres must raise SQLSTATE 23505 naming
 *      one_active_job_per_worker. This is the assertion that proves the
 *      guarantee lives in the database and not in the UI, and it holds on PGlite
 *      too, because PGlite is Postgres.
 *
 *   C. THE CLEAN 409 END TO END (driver-independent). Reconstruct exactly the
 *      state a racing transaction sees on concurrent Postgres — a REQUESTED job
 *      for a worker who already holds an active job — then call the real accept
 *      route. It must return HTTP 409, code WORKER_BUSY, and
 *      details.constraint === 'one_active_job_per_worker'. B proves the database
 *      rejects it; C proves the rejection is translated into a clean API error
 *      rather than a 500, over the genuine transaction path.
 *
 * Everything is built on its own throwaway fixtures (marked rows, see MARK
 * below) and torn down in a finally block, including on failure.
 */

import { sql } from 'drizzle-orm';

import { getDb, type Driver } from '../db/client';
import { customers, jobs, trades, workers, type JobStatus } from '../db/schema';
import { isActive, isTerminal, ONE_ACTIVE_JOB_INDEX } from '../lib/jobs-state';
import { POST as acceptPost } from '../app/api/jobs/[id]/accept/route';

const VERBOSE = process.argv.includes('--verbose');

// ---------------------------------------------------------------------------
// Fixture markers. Fixed (not random) so a crashed earlier run can be cleaned
// up by the next one — see preClean().
// ---------------------------------------------------------------------------

const MARK = 'zz-race-check';
const TRADE_SLUG = MARK;
const WORKER_PHONE = '+92RACECHK0001';
const CUSTOMER_A_PHONE = '+92RACECHK0002';
const CUSTOMER_B_PHONE = '+92RACECHK0003';
const RACE_PHONE_PREFIX = '+92RACECHK%';

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail?: unknown): boolean {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail).slice(0, 400)}`);
  }
  return condition;
}

function note(line: string): void {
  notes.push(line);
  console.log(`  NOTE  ${line}`);
}

function section(title: string): void {
  console.log(`\n${title}\n${'-'.repeat(Math.max(title.length, 10))}`);
}

// ---------------------------------------------------------------------------
// Error inspection
//
// Drizzle 0.45 wraps driver errors in DrizzleQueryError and hangs the real
// Postgres error off `.cause`, so a top-level `err.code` check sees nothing.
// lib/jobs-state.ts walks the chain for the app; this walks it for the test, so
// the test does not depend on the thing it is testing to report the SQLSTATE.
// ---------------------------------------------------------------------------

type PgErrorish = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  detail?: string;
  message?: string;
  cause?: unknown;
};

function pgErrorOf(err: unknown, depth = 0): PgErrorish | null {
  if (!err || typeof err !== 'object' || depth > 6) return null;
  const candidate = err as PgErrorish;
  if (typeof candidate.code === 'string') return candidate;
  return pgErrorOf(candidate.cause, depth + 1);
}

/** Every message in the cause chain, joined — PGlite does not always set
 *  `constraint`, but it always names the index in the message text. */
function errorText(err: unknown): string {
  const parts: string[] = [];
  let cursor: unknown = err;
  for (let depth = 0; cursor && depth < 7; depth += 1) {
    const e = cursor as PgErrorish;
    parts.push(e.constraint ?? '', e.constraint_name ?? '', e.detail ?? '', e.message ?? '');
    cursor = e.cause;
  }
  return parts.filter(Boolean).join(' | ');
}

// ---------------------------------------------------------------------------
// Calling the real route handler
// ---------------------------------------------------------------------------

type Envelope =
  | { ok: true; data: { job: { id: string; status: string }; autoDeclined: { count: number; jobIds: string[] } } }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

type Call = { status: number; body: Envelope };

/**
 * Invoke POST /api/jobs/:id/accept in-process, so the test exercises the genuine
 * transaction rather than a reimplementation of it.
 *
 * The handler takes (Request, { params }) and uses neither headers() nor
 * cookies(), so it needs no Next.js request scope. If a future edit introduces
 * one, the call throws here and the surrounding check reports it as a failure
 * with the real error instead of silently skipping.
 */
async function callAccept(jobId: string): Promise<Call> {
  const req = new Request(`http://race-check.local/api/jobs/${jobId}/accept`, { method: 'POST' });
  const res = await acceptPost(req, { params: Promise.resolve({ id: jobId }) });
  return { status: res.status, body: (await res.json()) as Envelope };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type Fixtures = {
  tradeId: string;
  workerId: string;
  customerAId: string;
  customerBId: string;
  jobAId: string;
  jobBId: string;
};

async function main(): Promise<void> {
  const { db, driver, close } = await getDb();

  const rows = async <T>(q: ReturnType<typeof sql>): Promise<T[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = await db.execute(q);
    return (out?.rows ?? out ?? []) as T[];
  };

  const driverLabel: Record<Driver, string> = {
    postgres: 'real Postgres via DATABASE_URL (transactions can genuinely interleave)',
    pglite: 'embedded PGlite, no DATABASE_URL (ONE connection, transactions serialised)',
  };

  console.log(`Roshan Rozgar — concurrent double-accept check`);
  console.log('='.repeat(72));
  console.log(`driver      : ${driver}`);
  console.log(`description : ${driverLabel[driver]}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'not set'}`);

  async function preClean(): Promise<void> {
    // Order matters: jobs reference workers/customers/trades without ON DELETE.
    await db.execute(sql`
      delete from jobs where worker_id in (select id from workers where phone like ${RACE_PHONE_PREFIX})
         or customer_id in (select id from customers where phone like ${RACE_PHONE_PREFIX})
    `);
    await db.execute(sql`delete from workers where phone like ${RACE_PHONE_PREFIX}`);
    await db.execute(sql`delete from customers where phone like ${RACE_PHONE_PREFIX}`);
    await db.execute(sql`delete from trades where slug = ${TRADE_SLUG}`);
  }

  let fixtures: Fixtures | null = null;

  try {
    await preClean();

    // -- fixtures ---------------------------------------------------------
    section('Fixtures (isolated, removed again at the end)');

    const [trade] = await db
      .insert(trades)
      .values({
        slug: TRADE_SLUG,
        nameEn: 'Race Check',
        nameUr: 'ریس چیک',
        nameRoman: 'race check',
        color: '#000000',
        glyph: 'wrench',
        keywords: ['race', 'check'],
      })
      .returning({ id: trades.id });

    const [worker] = await db
      .insert(workers)
      .values({
        name: 'Race Check Worker',
        phone: WORKER_PHONE,
        tradeId: trade.id,
        yearsExperience: 1,
        area: 'G-9',
        lat: 33.6844,
        lng: 73.0479,
        status: 'FREE',
      })
      .returning({ id: workers.id });

    const inserted = await db
      .insert(customers)
      .values([
        { name: 'Race Check Customer A', phone: CUSTOMER_A_PHONE, lat: 33.68, lng: 73.04, addressLabel: 'G-9/1' },
        { name: 'Race Check Customer B', phone: CUSTOMER_B_PHONE, lat: 33.69, lng: 73.05, addressLabel: 'G-9/2' },
      ])
      .returning({ id: customers.id, phone: customers.phone });

    const customerA = inserted.find((c) => c.phone === CUSTOMER_A_PHONE);
    const customerB = inserted.find((c) => c.phone === CUSTOMER_B_PHONE);
    if (!customerA || !customerB) throw new Error('fixture customers were not created');

    const jobRows = await db
      .insert(jobs)
      .values([
        {
          customerId: customerA.id,
          workerId: worker.id,
          tradeId: trade.id,
          descriptionRaw: 'race-check job A',
          descriptionSource: 'text' as const,
        },
        {
          customerId: customerB.id,
          workerId: worker.id,
          tradeId: trade.id,
          descriptionRaw: 'race-check job B',
          descriptionSource: 'text' as const,
        },
      ])
      .returning({ id: jobs.id, descriptionRaw: jobs.descriptionRaw });

    const jobA = jobRows.find((j) => j.descriptionRaw.endsWith('job A'));
    const jobB = jobRows.find((j) => j.descriptionRaw.endsWith('job B'));
    if (!jobA || !jobB) throw new Error('fixture jobs were not created');

    fixtures = {
      tradeId: trade.id,
      workerId: worker.id,
      customerAId: customerA.id,
      customerBId: customerB.id,
      jobAId: jobA.id,
      jobBId: jobB.id,
    };

    check('one FREE worker and two REQUESTED jobs for him exist', true, {
      worker: fixtures.workerId,
      jobA: fixtures.jobAId,
      jobB: fixtures.jobBId,
    });

    // -- the index exists in the LIVE database ----------------------------
    section('0. The index is actually in this database (pg_indexes)');

    const idxRows = await rows<{ indexdef: string }>(sql`
      select indexdef from pg_indexes where indexname = ${ONE_ACTIVE_JOB_INDEX}
    `);
    const indexDef = idxRows[0]?.indexdef ?? '';
    check(`index ${ONE_ACTIVE_JOB_INDEX} exists in the live database`, idxRows.length === 1, idxRows);
    check(
      'its definition covers all three active statuses (ACCEPTED, PRICE_AGREED, IN_PROGRESS)',
      /ACCEPTED/.test(indexDef) && /PRICE_AGREED/.test(indexDef) && /IN_PROGRESS/.test(indexDef),
      indexDef || '(no definition returned)',
    );
    check('it is a UNIQUE index on jobs(worker_id)', /UNIQUE INDEX/i.test(indexDef) && /worker_id/.test(indexDef), indexDef);
    if (VERBOSE) console.log(`\n  indexdef: ${indexDef}\n`);

    // -- A. the race ------------------------------------------------------
    section('A. The race: two accepts fired simultaneously (Promise.allSettled)');

    const settled = await Promise.allSettled([callAccept(fixtures.jobAId), callAccept(fixtures.jobBId)]);

    if (VERBOSE) {
      console.log('\n  raw settled results:');
      console.log(`${JSON.stringify(settled, null, 2).replace(/^/gm, '    ')}\n`);
    }

    // A rejected promise means the handler threw outside its own error
    // envelope — e.g. a missing Next.js request scope. Report it, do not hide it.
    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    for (const r of rejected) {
      note(`an accept call REJECTED instead of returning a response: ${String(r.reason)}`);
      if (/headers|cookies|request scope|dynamic/i.test(String(r.reason))) {
        note('that looks like a Next.js request-scope requirement — the handler cannot run outside a server request.');
      }
    }

    const calls = settled.map((s) => (s.status === 'fulfilled' ? s.value : null));
    const successes = calls.filter((c) => c !== null && c.body.ok === true);
    const losers = calls.filter((c) => c !== null && c.body.ok === false);

    check('exactly ONE accept succeeded', successes.length === 1, {
      successes: successes.length,
      statuses: calls.map((c) => c?.status ?? 'rejected'),
    });
    check('exactly ONE accept failed', losers.length === 1 && rejected.length === 0, {
      failedWithEnvelope: losers.length,
      rejectedOutright: rejected.length,
    });

    const loser = losers[0];
    const loserError = loser && loser.body.ok === false ? loser.body.error : null;

    check('the loser got HTTP 409 (a conflict, not a 500)', loser?.status === 409, {
      status: loser?.status ?? null,
      error: loserError,
    });

    const GUARDS = {
      WORKER_BUSY: {
        guard: 'the PARTIAL UNIQUE INDEX one_active_job_per_worker (Postgres raised SQLSTATE 23505)',
        path: 'the real-concurrent-Postgres path: the two transactions interleaved and the database rejected the second active job',
      },
      INVALID_TRANSITION: {
        guard: 'the STATE MACHINE in lib/jobs-state.ts (assertTransition, before any write reached the index)',
        path: 'the PGlite path: one connection, transactions serialised, so the winner had already committed (and auto-DECLINEd the loser) before the loser read its row',
      },
    } as const;

    const loserCode = loserError?.code ?? '(none)';
    const known = loserCode === 'WORKER_BUSY' || loserCode === 'INVALID_TRANSITION';
    check(
      'the loser failed with WORKER_BUSY (index fired) or INVALID_TRANSITION (state machine fired first)',
      known,
      loserError,
    );

    if (known) {
      const g = GUARDS[loserCode as keyof typeof GUARDS];
      console.log('');
      console.log(`  >>> THE LOSER WAS REJECTED BY: ${g.guard}`);
      console.log(`  >>> THAT IS ${g.path}.`);
      console.log(`  >>> loser response: HTTP ${loser?.status} ${loserCode} — "${loserError?.message ?? ''}"`);
      console.log('');
      if (loserCode === 'INVALID_TRANSITION' && driver === 'pglite') {
        note('expected on this driver. The index is proven separately in sections B and C below.');
      }
      if (loserCode === 'INVALID_TRANSITION' && driver === 'postgres') {
        note('on real Postgres this means the calls did NOT overlap in time; the race was won before the loser started.');
      }
    }

    // -- post-race state --------------------------------------------------
    section('A2. The state the race left behind');

    const [workerAfter] = await rows<{ status: string }>(
      sql`select status from workers where id = ${fixtures.workerId}`,
    );
    check('the worker ends BUSY', workerAfter?.status === 'BUSY', workerAfter);

    const [activeCount] = await rows<{ n: string }>(sql`
      select count(*) as n from jobs
      where worker_id = ${fixtures.workerId}
        and status in ('ACCEPTED','PRICE_AGREED','IN_PROGRESS')
    `);
    check('the worker holds EXACTLY ONE active job', Number(activeCount?.n ?? -1) === 1, activeCount);

    const jobStates = await rows<{ id: string; status: string; accepted_at: string | null }>(sql`
      select id, status, accepted_at from jobs where worker_id = ${fixtures.workerId} order by description_raw
    `);
    const winnerId = successes[0] && successes[0].body.ok === true ? successes[0].body.data.job.id : null;
    const loserJob = jobStates.find((j) => j.id !== winnerId);
    const winnerJob = jobStates.find((j) => j.id === winnerId);

    check(
      'the losing job is in a terminal, non-active state',
      Boolean(
        loserJob &&
          isTerminal(loserJob.status as JobStatus) &&
          !isActive(loserJob.status as JobStatus),
      ),
      loserJob,
    );

    check(
      'the losing transaction rolled back completely — no half-applied state',
      Boolean(
        loserJob &&
          loserJob.accepted_at === null && // never stamped accepted
          winnerJob &&
          winnerJob.accepted_at !== null && // the winner was
          jobStates.length === 2 && // no extra rows written
          Number(activeCount?.n ?? -1) === 1,
      ),
      { loserJob, winnerJob, totalJobsForWorker: jobStates.length },
    );

    if (VERBOSE) console.log(`\n  job rows: ${JSON.stringify(jobStates)}\n`);

    // -- B. the index itself, with no application code involved -----------
    section('B. ***THE INDEX ITSELF***: raw SQL, no application code');
    console.log('  The worker already holds one active job. Raw UPDATE of a SECOND of his');
    console.log('  jobs to ACCEPTED must be refused by Postgres, not by our code.');
    console.log('');

    const loserJobId = loserJob?.id ?? fixtures.jobBId;
    const loserJobStatusBefore: JobStatus = (loserJob?.status as JobStatus | undefined) ?? 'DECLINED';

    let rawSucceeded = false;
    let rawErr: unknown = null;
    try {
      await db.execute(sql`update jobs set status = 'ACCEPTED' where id = ${loserJobId}`);
      rawSucceeded = true;
    } catch (err) {
      rawErr = err;
    }

    if (rawSucceeded) {
      // Should be unreachable. Undo it so the remaining checks and the teardown
      // are not operating on corrupt state.
      await db.execute(
        sql`update jobs set status = ${loserJobStatusBefore}::job_status where id = ${loserJobId}`,
      );
    }

    const pg = pgErrorOf(rawErr);
    const text = errorText(rawErr);

    check(
      'raw UPDATE to a second active job was REFUSED by the database',
      !rawSucceeded && rawErr !== null,
      rawSucceeded ? 'the UPDATE succeeded — the index is NOT enforcing the invariant' : undefined,
    );
    check('the SQLSTATE is 23505 (unique_violation)', pg?.code === '23505', {
      code: pg?.code ?? null,
      text: text.slice(0, 300),
    });
    check(
      `the violated constraint is named ${ONE_ACTIVE_JOB_INDEX}`,
      text.includes(ONE_ACTIVE_JOB_INDEX),
      text.slice(0, 300),
    );

    if (!rawSucceeded && pg?.code === '23505') {
      console.log('');
      console.log(`  >>> PROVEN ON ${driver.toUpperCase()}: the guarantee is in the DATABASE, not the UI.`);
      console.log(`  >>> SQLSTATE 23505 · constraint ${ONE_ACTIVE_JOB_INDEX}`);
      console.log(`  >>> ${(pg.message ?? '').split('\n')[0]}`);
      console.log('');
    }

    // -- C. the clean 409, end to end, through the real route -------------
    section('C. The clean 409 end to end, through the real accept route');
    console.log('  Reconstructing exactly what a racing transaction sees on concurrent Postgres:');
    console.log('  a REQUESTED job for a worker who ALREADY holds an active job. Then the real');
    console.log('  POST /api/jobs/:id/accept runs against it.');
    console.log('');

    await db.execute(
      sql`update jobs set status = 'REQUESTED', accepted_at = null where id = ${loserJobId}`,
    );

    let e2e: Call | null = null;
    let e2eErr: unknown = null;
    try {
      e2e = await callAccept(loserJobId);
    } catch (err) {
      e2eErr = err;
    }

    if (e2eErr !== null) {
      note(`the accept handler THREW instead of returning a response: ${String(e2eErr)}`);
      note('it could not run outside a Next.js request scope — this assertion is NOT proven, not skipped.');
    }

    const e2eError = e2e && e2e.body.ok === false ? e2e.body.error : null;
    const e2eDetails = (e2eError?.details ?? null) as { constraint?: string; enforcedBy?: string } | null;

    check('the real route returned a response (no request scope needed)', e2e !== null, String(e2eErr ?? ''));
    check('HTTP status is 409', e2e?.status === 409, { status: e2e?.status ?? null, body: e2e?.body ?? null });
    check('error code is WORKER_BUSY', e2eError?.code === 'WORKER_BUSY', e2eError);
    check(
      `details.constraint === '${ONE_ACTIVE_JOB_INDEX}'`,
      e2eDetails?.constraint === ONE_ACTIVE_JOB_INDEX,
      e2eDetails,
    );
    check(
      "details.enforcedBy === 'database'",
      e2eDetails?.enforcedBy === 'database',
      e2eDetails,
    );

    if (e2e?.status === 409 && e2eError?.code === 'WORKER_BUSY') {
      console.log('');
      console.log(`  >>> HTTP 409 WORKER_BUSY — "${e2eError.message}"`);
      console.log(`  >>> details: ${JSON.stringify(e2eDetails)}`);
      console.log('  >>> The 23505 from section B becomes a clean, typed 409 over the genuine');
      console.log('  >>> transaction path (not a 500, and not a pre-check that guessed).');
      console.log('');
    }

    // The rejected attempt must not have disturbed anything.
    const [afterE2e] = await rows<{ n: string }>(sql`
      select count(*) as n from jobs
      where worker_id = ${fixtures.workerId}
        and status in ('ACCEPTED','PRICE_AGREED','IN_PROGRESS')
    `);
    check(
      'after the rejected accept the worker STILL holds exactly one active job',
      Number(afterE2e?.n ?? -1) === 1,
      afterE2e,
    );

    // -- summary ----------------------------------------------------------
    section('What this run actually proved');

    const loserCodeFinal = loserError?.code ?? null;

    const provenHere = [
      `The index ${ONE_ACTIVE_JOB_INDEX} is present in this ${driver} database and covers exactly the three active statuses.`,
      'Raw SQL cannot give one worker a second active job: Postgres raises SQLSTATE 23505 naming that index. The invariant is enforced by the database, with no application code in the path.',
      'When a transaction hits that violation, the real accept route turns it into HTTP 409 WORKER_BUSY with details.constraint naming the index — not a 500, and not a pre-check.',
      'Two simultaneous accepts on one worker produce exactly one winner. The worker ends BUSY holding exactly one active job, and the loser left no half-applied state behind.',
    ];

    const onlyOnRealPg = [
      'That two accept transactions genuinely OVERLAP IN TIME and that the index — rather than the state machine — is what rejects the loser.',
      'PGlite runs on a single connection and serialises transactions through a mutex, so no Promise.all can interleave them here. The winner commits first and the loser is refused by assertTransition from a terminal status.',
      'Set DATABASE_URL to a real Postgres and re-run to see section A report WORKER_BUSY instead of INVALID_TRANSITION.',
    ];

    console.log('\nPROVEN ON THIS DRIVER (' + driver + '):');
    provenHere.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));

    if (driver === 'pglite') {
      console.log('\nNOT PROVABLE HERE — needs a real concurrent Postgres:');
      onlyOnRealPg.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));
      console.log('\nIn one sentence: on PGlite the double-book is stopped twice over — the state');
      console.log('machine stops the racing call and the database refuses the row outright — but');
      console.log('only a real Postgres can show the two transactions colliding inside the index.');
    } else {
      console.log('\nOn this driver section A exercised real concurrency.');
      if (loserCodeFinal === 'WORKER_BUSY') {
        console.log('The loser was rejected by the INDEX, which is the full headline claim: two');
        console.log('overlapping transactions, one winner, one database-raised 409.');
      } else {
        console.log(`The loser was rejected by ${loserCodeFinal ?? 'an unexpected guard'}, which means the two calls did not`);
        console.log('overlap this time. Sections B and C still proved the index and the 409; re-run');
        console.log('to try for an interleaved pair.');
      }
    }
  } finally {
    // -- teardown ---------------------------------------------------------
    section('Teardown');
    try {
      await preClean();
      const [left] = await rows<{ jobs: string; workers: string; customers: string; trades: string }>(sql`
        select
          (select count(*) from jobs j join workers w on w.id = j.worker_id where w.phone like ${RACE_PHONE_PREFIX}) as jobs,
          (select count(*) from workers where phone like ${RACE_PHONE_PREFIX}) as workers,
          (select count(*) from customers where phone like ${RACE_PHONE_PREFIX}) as customers,
          (select count(*) from trades where slug = ${TRADE_SLUG}) as trades
      `);
      const residue =
        Number(left?.jobs ?? 0) + Number(left?.workers ?? 0) + Number(left?.customers ?? 0) + Number(left?.trades ?? 0);
      check('every fixture row was removed (no residue for the next run)', residue === 0, left);
    } catch (err) {
      check('every fixture row was removed (no residue for the next run)', false, String(err));
    }
    await close();
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${passed} passed, ${failed} failed${notes.length ? `, ${notes.length} note(s)` : ''}`);
  if (failed) console.log(`\nFailed:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nrace-check crashed:', err);
  process.exit(1);
});
