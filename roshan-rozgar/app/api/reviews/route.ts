/**
 * Reviews (Outcome 5) — what the next customer gets instead of asking a neighbour.
 *
 * Three rules this route enforces, in this order:
 *
 *  1. A review belongs to a COMPLETED job, and a job has exactly one review.
 *     Both are checked inside the transaction, and `reviews.job_id` is UNIQUE,
 *     so a double-tap races into a clean 409 instead of two reviews.
 *  2. `workerId` / `customerId` come FROM THE JOB. A client cannot review a
 *     worker it never hired.
 *  3. `workers.rating` is recomputed as the true average inside the same
 *     transaction — never incremented, so it cannot drift.
 *
 * The trust summary is regenerated AFTER the commit: a model call that fails
 * must not throw away a review the customer already spoke.
 */

import { desc, eq } from 'drizzle-orm';
import { connection } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { jobs, reviews, trustSummaries } from '@/db/schema';
import { ApiError, body, handle, ok, query, uuidParam } from '@/lib/http';
import {
  averageStars,
  countTags,
  fillBothLanguages,
  recomputeWorkerRating,
  regenerateTrustSummary,
  starDistribution,
  type TrustSummaryRow,
} from '@/lib/trust';

// No `runtime` / `dynamic` exports: next.config.ts sets `cacheComponents: true`,
// and Next 16 rejects both route segment configs outright under it ("Route
// segment config ... is not compatible with nextConfig.cacheComponents").
// `connection()` on GET is the replacement for `dynamic = 'force-dynamic'`.

const postBody = z.object({
  jobId: uuidParam,
  stars: z.coerce.number().int().min(1).max(5),
  /** Tappable chip ids from GET /api/reviews/tags — the review a non-reader leaves. */
  tags: z.array(z.string().min(1).max(64)).max(12).optional(),
  voiceUrl: z.string().min(1).optional(),
  transcriptUr: z.string().optional(),
  transcriptEn: z.string().optional(),
  /** Which language was actually spoken, when the client only has one field. */
  language: z.enum(['ur', 'en']).optional(),
});

const getQuery = z
  .object({
    workerId: uuidParam.optional(),
    jobId: uuidParam.optional(),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine((q) => Boolean(q.workerId ?? q.jobId), {
    message: 'Pass workerId or jobId.',
  });

export const POST = handle(async (req: Request) => {
  const input = await body(req, postBody);
  const database = await db();

  // Fail fast before spending an AI call on a job that cannot be reviewed.
  // The transaction below re-checks authoritatively.
  const [preflight] = await database
    .select({ status: jobs.status, workerId: jobs.workerId })
    .from(jobs)
    .where(eq(jobs.id, input.jobId))
    .limit(1);

  if (!preflight) throw new ApiError('NOT_FOUND', 'No such job.');
  if (preflight.status !== 'COMPLETED') {
    throw new ApiError(
      'INVALID_TRANSITION',
      'You can only review a job that is completed.',
      { status: preflight.status },
    );
  }

  // A client with one transcript field may label it by habit rather than by
  // language. `language` is the speaker's own answer, so it decides which side
  // a single supplied transcript belongs on.
  let ur = input.transcriptUr;
  let en = input.transcriptEn;
  if (input.language && Boolean(ur) !== Boolean(en)) {
    const only = ur ?? en;
    ur = input.language === 'ur' ? only : undefined;
    en = input.language === 'en' ? only : undefined;
  }

  // So a spoken Urdu review is readable by the next English-reading customer.
  const bilingual = await fillBothLanguages({ ur, en });

  const tags = [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))];

  const committed = await database.transaction(async (tx) => {
    const [job] = await tx
      .select({ status: jobs.status, workerId: jobs.workerId, customerId: jobs.customerId })
      .from(jobs)
      .where(eq(jobs.id, input.jobId))
      .limit(1)
      .for('update');

    if (!job) throw new ApiError('NOT_FOUND', 'No such job.');
    if (job.status !== 'COMPLETED') {
      throw new ApiError('INVALID_TRANSITION', 'You can only review a job that is completed.', {
        status: job.status,
      });
    }

    const [existing] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.jobId, input.jobId))
      .limit(1);

    if (existing) {
      throw new ApiError('CONFLICT', 'This job has already been reviewed.', {
        reviewId: existing.id,
      });
    }

    const [review] = await tx
      .insert(reviews)
      .values({
        jobId: input.jobId,
        // Derived from the job, never from the client.
        workerId: job.workerId,
        customerId: job.customerId,
        stars: input.stars,
        tags,
        voiceUrl: input.voiceUrl ?? null,
        transcriptUr: bilingual.ur,
        transcriptEn: bilingual.en,
      })
      .returning();

    const { rating, reviewCount } = await recomputeWorkerRating(job.workerId, tx);

    return { review, workerId: job.workerId, rating, reviewCount };
  });

  // Outside the transaction on purpose. A failed summary must not lose a review.
  let summary: TrustSummaryRow | null = null;
  let summaryError: string | undefined;
  try {
    summary = await regenerateTrustSummary(committed.workerId);
  } catch (err) {
    summaryError = (err as Error)?.message ?? 'trust summary could not be regenerated';
    console.warn('[reviews] trust summary regeneration failed', err);
  }

  return ok(
    {
      review: committed.review,
      worker: {
        id: committed.workerId,
        rating: committed.rating,
        reviewCount: committed.reviewCount,
      },
      summary,
      ...(summaryError ? { summaryError } : {}),
    },
    {
      translateProvider: bilingual.provider,
      translated: bilingual.translated,
      ...(bilingual.error ? { translationError: bilingual.error } : {}),
      summaryProvider: summary?.aiProvider ?? null,
      sourceReviewCount: summary?.sourceReviewCount ?? committed.reviewCount,
      serverTime: new Date().toISOString(),
    },
  );
});

const getReviews = handle(async (req: Request) => {
  const { workerId, jobId, limit } = query(req, getQuery);
  const database = await db();

  const scope = workerId ? eq(reviews.workerId, workerId) : eq(reviews.jobId, jobId as string);

  const page = await database
    .select()
    .from(reviews)
    .where(scope)
    .orderBy(desc(reviews.createdAt))
    .limit(limit);

  // Aggregates cover ALL of the worker's reviews, not just this page — the UI
  // shows "4.6 from 23 reviews", which a page-local average would misstate.
  const all = await database
    .select({ stars: reviews.stars, tags: reviews.tags })
    .from(reviews)
    .where(scope);

  const summary = workerId
    ? (
        await database
          .select()
          .from(trustSummaries)
          .where(eq(trustSummaries.workerId, workerId))
          .limit(1)
      )[0] ?? null
    : null;

  const stars = all.map((r) => r.stars);

  return ok(
    {
      reviews: page,
      aggregate: {
        count: all.length,
        average: averageStars(stars),
        stars: starDistribution(stars),
        tags: countTags(all.map((r) => r.tags)),
      },
      summary,
    },
    {
      summaryProvider: summary?.aiProvider ?? null,
      sourceReviewCount: summary?.sourceReviewCount ?? all.length,
      serverTime: new Date().toISOString(),
    },
  );
});

export async function GET(req: Request) {
  // Called OUTSIDE handle() on purpose: under cacheComponents the prerender
  // bail-out is thrown, and handle()'s catch-all would prerender it as a 500.
  await connection();
  return getReviews(req);
}
