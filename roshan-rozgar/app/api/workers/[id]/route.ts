/**
 * GET   /api/workers/:id — the full public profile the customer reads before booking.
 * PATCH /api/workers/:id — availability + the fields the worker may edit himself.
 *
 * The PATCH guard is Outcome 4 ("the platform remains consistent about which
 * workers are free"): a worker holding an ACCEPTED / PRICE_AGREED / IN_PROGRESS
 * job cannot flip himself back to FREE (or disappear to OFF) and leave a
 * customer stranded mid-job. The database's partial unique index stops double
 * booking; this stops the other half of the same lie.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  ACTIVE_JOB_STATUSES,
  jobs,
  reviews,
  trades,
  trustSummaries,
  workPhotos,
  workerSkills,
  workers,
} from '@/db/schema';
import { ApiError, body, handle, ok, uuidParam } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Next.js 16: the route context's `params` is a promise. */
type Ctx = { params: Promise<{ id: string }> };

const RECENT_REVIEW_LIMIT = 10;

async function workerId(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  const parsed = uuidParam.safeParse(id);
  if (!parsed.success) throw new ApiError('BAD_REQUEST', 'Worker id must be a UUID.');
  return parsed.data;
}

/** The worker's currently active job, if any — the availability guard's input. */
async function activeJob(
  database: Awaited<ReturnType<typeof db>>,
  id: string,
): Promise<{ id: string; status: string } | null> {
  const [job] = await database
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.workerId, id), inArray(jobs.status, [...ACTIVE_JOB_STATUSES])))
    .limit(1);
  return job ?? null;
}

// ---------------------------------------------------------------------------
// GET — full public profile
// ---------------------------------------------------------------------------

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const id = await workerId(ctx);
  const database = await db();

  const [row] = await database
    .select({ worker: workers, trade: trades })
    .from(workers)
    .innerJoin(trades, eq(workers.tradeId, trades.id))
    .where(eq(workers.id, id))
    .limit(1);

  if (!row) throw new ApiError('NOT_FOUND', 'No worker with that id.');

  const [skills, photos, trust, recentReviews, active] = await Promise.all([
    database.select().from(workerSkills).where(eq(workerSkills.workerId, id)),
    database.select().from(workPhotos).where(eq(workPhotos.workerId, id)),
    database.select().from(trustSummaries).where(eq(trustSummaries.workerId, id)).limit(1),
    database
      .select({
        id: reviews.id,
        jobId: reviews.jobId,
        stars: reviews.stars,
        tags: reviews.tags,
        voiceUrl: reviews.voiceUrl,
        transcriptUr: reviews.transcriptUr,
        transcriptEn: reviews.transcriptEn,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.workerId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(RECENT_REVIEW_LIMIT),
    activeJob(database, id),
  ]);

  const { worker, trade } = row;

  return ok(
    {
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      area: worker.area,
      lat: worker.lat,
      lng: worker.lng,
      status: worker.status,
      rateMin: worker.rateMin,
      rateMax: worker.rateMax,
      rating: worker.rating,
      jobsCompleted: worker.jobsCompleted,
      yearsExperience: worker.yearsExperience,
      bioEn: worker.bioEn,
      bioUr: worker.bioUr,
      photoUrl: worker.photoUrl,
      onboardedVia: worker.onboardedVia,
      onboardingTranscript: worker.onboardingTranscript,
      createdAt: worker.createdAt,
      trade: {
        id: trade.id,
        slug: trade.slug,
        nameEn: trade.nameEn,
        nameUr: trade.nameUr,
        nameRoman: trade.nameRoman,
        color: trade.color,
        glyph: trade.glyph,
      },
      skills: skills.map((s) => ({
        id: s.id,
        labelEn: s.labelEn,
        labelUr: s.labelUr,
        source: s.source,
        confidence: s.confidence,
      })),
      workPhotos: photos.map((p) => ({
        id: p.id,
        url: p.url,
        aiTags: p.aiTags,
        aiProvider: p.aiProvider,
      })),
      trustSummary: trust[0]
        ? {
            summaryEn: trust[0].summaryEn,
            summaryUr: trust[0].summaryUr,
            sourceReviewCount: trust[0].sourceReviewCount,
            aiProvider: trust[0].aiProvider,
            generatedAt: trust[0].generatedAt,
          }
        : null,
      reviews: recentReviews,
      activeJob: active,
    },
    { reviewsReturned: recentReviews.length, reviewLimit: RECENT_REVIEW_LIMIT },
  );
});

// ---------------------------------------------------------------------------
// PATCH — availability and editable profile fields
// ---------------------------------------------------------------------------

const patchBody = z
  .object({
    status: z.enum(['FREE', 'BUSY', 'OFF']).optional(),
    rateMin: z.coerce.number().int().min(0).max(10_000_000).optional(),
    rateMax: z.coerce.number().int().min(0).max(10_000_000).optional(),
    bioUr: z.string().trim().max(2000).nullable().optional(),
    bioEn: z.string().trim().max(2000).nullable().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    area: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => Object.values(v).some((field) => field !== undefined), {
    message: 'Provide at least one field to update.',
  })
  // Latitude without longitude would silently move him onto a different street.
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'lat and lng must be updated together.',
    path: ['lng'],
  });

const ON_JOB_MESSAGE: Record<string, string> = {
  ACCEPTED: 'has accepted a job',
  PRICE_AGREED: 'has agreed a price on a job',
  IN_PROGRESS: 'is in the middle of a job',
};

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const id = await workerId(ctx);
  const input = await body(req, patchBody);
  const database = await db();

  const [current] = await database.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!current) throw new ApiError('NOT_FOUND', 'No worker with that id.');

  // Availability must stay honest: only BUSY is a legal self-report while a job
  // is live. FREE would offer him to a second customer; OFF would hide him from
  // the one he is already working for.
  if (input.status === 'FREE' || input.status === 'OFF') {
    const active = await activeJob(database, id);
    if (active) {
      throw new ApiError(
        'CONFLICT',
        `${current.name} ${ON_JOB_MESSAGE[active.status] ?? 'is on an active job'} and cannot be marked ${input.status} until it is completed or cancelled.`,
        { jobId: active.id, jobStatus: active.status, requestedStatus: input.status },
      );
    }
  }

  const nextMin = input.rateMin ?? current.rateMin;
  const nextMax = input.rateMax ?? current.rateMax;
  if (nextMax < nextMin) {
    throw new ApiError('BAD_REQUEST', 'rateMax must be greater than or equal to rateMin.', {
      rateMin: nextMin,
      rateMax: nextMax,
    });
  }

  const [updated] = await database
    .update(workers)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.rateMin !== undefined ? { rateMin: input.rateMin } : {}),
      ...(input.rateMax !== undefined ? { rateMax: input.rateMax } : {}),
      ...(input.bioUr !== undefined ? { bioUr: input.bioUr } : {}),
      ...(input.bioEn !== undefined ? { bioEn: input.bioEn } : {}),
      ...(input.lat !== undefined ? { lat: input.lat } : {}),
      ...(input.lng !== undefined ? { lng: input.lng } : {}),
      ...(input.area !== undefined ? { area: input.area } : {}),
    })
    .where(eq(workers.id, id))
    .returning();

  const [trade] = await database
    .select()
    .from(trades)
    .where(eq(trades.id, updated.tradeId))
    .limit(1);

  return ok(
    {
      id: updated.id,
      name: updated.name,
      area: updated.area,
      lat: updated.lat,
      lng: updated.lng,
      status: updated.status,
      rateMin: updated.rateMin,
      rateMax: updated.rateMax,
      rating: updated.rating,
      jobsCompleted: updated.jobsCompleted,
      yearsExperience: updated.yearsExperience,
      bioEn: updated.bioEn,
      bioUr: updated.bioUr,
      photoUrl: updated.photoUrl,
      onboardedVia: updated.onboardedVia,
      createdAt: updated.createdAt,
      trade: trade
        ? {
            id: trade.id,
            slug: trade.slug,
            nameEn: trade.nameEn,
            nameUr: trade.nameUr,
            nameRoman: trade.nameRoman,
            color: trade.color,
            glyph: trade.glyph,
          }
        : null,
    },
    { statusChanged: input.status !== undefined && input.status !== current.status },
  );
});
