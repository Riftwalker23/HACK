/**
 * POST /api/ai/summarise-reviews — synthesise a worker's reviews into trust.
 *
 * Without this the next customer is back to asking a neighbour
 * (PROJECT.md §2.1, row 7).
 *
 * The result is cached in `trust_summaries` rather than recomputed per profile
 * view: the worker's profile is the single most-read page in the demo, and the
 * row also records WHICH provider produced the summary so the UI can label it.
 */

import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { reviews, trades, trustSummaries, workers } from '@/db/schema';
import { summariseReviews } from '@/lib/ai';
import { ApiError, body, handle, ok, uuidParam } from '@/lib/http';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const schema = z.object({ workerId: uuidParam });

export const POST = handle(async (req: Request) => {
  const { workerId } = await body(req, schema);
  const database = await db();

  const [worker] = await database
    .select({ id: workers.id, tradeNameEn: trades.nameEn })
    .from(workers)
    .innerJoin(trades, eq(trades.id, workers.tradeId))
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) throw new ApiError('NOT_FOUND', 'No such worker.');

  const rows = await database
    .select({
      stars: reviews.stars,
      tags: reviews.tags,
      // The spoken review, already transcribed and translated on the way in.
      text: reviews.transcriptEn,
    })
    .from(reviews)
    .where(eq(reviews.workerId, workerId))
    .orderBy(desc(reviews.createdAt));

  const { result, meta } = await summariseReviews({
    reviews: rows.map((r) => ({ stars: r.stars, tags: r.tags ?? [], text: r.text })),
    tradeNameEn: worker.tradeNameEn,
  });

  await database
    .insert(trustSummaries)
    .values({
      workerId,
      summaryEn: result.summaryEn,
      summaryUr: result.summaryUr,
      sourceReviewCount: result.sourceReviewCount,
      aiProvider: meta.provider,
      generatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: trustSummaries.workerId,
      set: {
        summaryEn: result.summaryEn,
        summaryUr: result.summaryUr,
        sourceReviewCount: result.sourceReviewCount,
        aiProvider: meta.provider,
        generatedAt: new Date(),
      },
    });

  return ok(result, { ai: meta });
});
