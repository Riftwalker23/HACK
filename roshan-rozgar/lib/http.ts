/**
 * One response envelope for the whole API, so the frontend has exactly one
 * shape to handle and the demo never shows a raw stack trace.
 *
 *   success -> { ok: true,  data: T,  meta?: {...} }
 *   failure -> { ok: false, error: { code, message, details? } }
 */

import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';

export type ApiOk<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type ApiErr = {
  ok: false;
  error: { code: ErrorCode; message: string; details?: unknown };
};
export type ApiResult<T> = ApiOk<T> | ApiErr;

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TRANSITION'
  | 'WORKER_BUSY'
  | 'UPSTREAM_AI_ERROR'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  WORKER_BUSY: 409,
  UPSTREAM_AI_ERROR: 502,
  INTERNAL: 500,
};

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiOk<T>>({ ok: true, data, ...(meta ? { meta } : {}) });
}

export function fail(code: ErrorCode, message: string, details?: unknown) {
  return NextResponse.json<ApiErr>(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}

/** Shape of a Postgres driver error, whichever driver raised it. */
type PgError = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  detail?: string;
  message?: string;
};

/**
 * Walk an error's `cause` chain looking for the underlying driver error.
 *
 * Drizzle 0.45 wraps every query failure in DrizzleQueryError and hangs the
 * real Postgres error off `.cause`, so checking `err.code` on the thrown value
 * silently misses every constraint violation.
 */
function findPgError(err: unknown, depth = 0): PgError | null {
  if (!err || typeof err !== 'object' || depth > 5) return null;
  const candidate = err as PgError & { cause?: unknown };
  if (typeof candidate.code === 'string') return candidate;
  return findPgError(candidate.cause, depth + 1);
}

/**
 * Unique constraints mapped to the message the user should actually see.
 * Matched as substrings, so a constraint rename does not silently fall back to
 * a generic 409.
 */
const UNIQUE_CONSTRAINTS: Array<{ name: string; code: ErrorCode; message: string }> = [
  {
    name: 'one_active_job_per_worker',
    code: 'WORKER_BUSY',
    message: 'That worker just took another job.',
  },
  { name: 'workers_phone', code: 'CONFLICT', message: 'A worker with that phone number already exists.' },
  { name: 'customers_phone', code: 'CONFLICT', message: 'A customer with that phone number already exists.' },
  { name: 'reviews_job_id', code: 'CONFLICT', message: 'That job has already been reviewed.' },
  { name: 'trades_slug', code: 'CONFLICT', message: 'That trade already exists.' },
];

/** Thrown by domain code; converted to a response by `handle`. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wraps a route handler: turns ApiError into its envelope, Postgres unique
 * violations into 409s, and anything else into a logged 500.
 */
export function handle<A extends unknown[]>(
  fn: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.code, err.message, err.details);

      // 23505 = unique_violation.
      //
      // Drizzle 0.45 wraps every driver error in DrizzleQueryError and hangs the
      // real Postgres error off `.cause`, so a top-level `err.code` check misses
      // it entirely and the race would 500 instead of 409. Walk the chain.
      const pg = findPgError(err);
      if (pg?.code === '23505') {
        const constraint = pg.constraint_name ?? pg.constraint ?? '';
        const text = `${constraint} ${pg.detail ?? ''} ${pg.message ?? ''}`;
        const mapped = UNIQUE_CONSTRAINTS.find((c) => text.includes(c.name));
        return fail(
          mapped?.code ?? 'CONFLICT',
          mapped?.message ?? 'That record already exists.',
          { constraint: constraint || undefined, enforcedBy: 'database' },
        );
      }

      console.error('[api] unhandled', err);
      return fail('INTERNAL', 'Something went wrong on our side.');
    }
  };
}

/** Parse + validate a JSON body, or throw a 400 with field-level details. */
export async function body<T>(req: Request, shape: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError('BAD_REQUEST', 'Body must be valid JSON.');
  }
  const parsed = shape.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('BAD_REQUEST', 'Invalid request body.', z.treeifyError(parsed.error));
  }
  return parsed.data;
}

/** Parse + validate search params. */
export function query<T>(req: Request, shape: ZodType<T>): T {
  const url = new URL(req.url);
  const parsed = shape.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    throw new ApiError('BAD_REQUEST', 'Invalid query parameters.', z.treeifyError(parsed.error));
  }
  return parsed.data;
}

export const uuidParam = z.string().uuid();
