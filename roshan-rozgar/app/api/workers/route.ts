/**
 * GET  /api/workers — "who is near me, free right now, and good at THIS?"
 * POST /api/workers — create a worker from an ALREADY-EXTRACTED voice profile.
 *
 * Search is two-stage on purpose (PROJECT.md §3.4): a bounding-box prefilter in
 * SQL that rides the (lat,lng) index, then exact haversine + the published
 * ranking formula in JS. No PostGIS, nothing to install, and the whole ordering
 * is explainable — every card carries its score breakdown and one sentence.
 *
 * POST never touches the AI layer. Extraction happens upstream at
 * /api/ai/extract-profile; this endpoint persists what the worker confirmed.
 */

import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  trades,
  trustSummaries,
  workPhotos,
  workerSkills,
  workers,
  type Trade,
  type TrustSummary,
  type Worker,
  type WorkPhoto,
  type WorkerSkill,
} from '@/db/schema';
import { env } from '@/lib/env';
import { boundingBox, formatDistance, haversineKm } from '@/lib/geo';
import { ApiError, body, handle, ok, query } from '@/lib/http';
import {
  RANKING_FORMULA,
  RANKING_WEIGHTS,
  rankWorkers,
  type RankCandidate,
} from '@/lib/ranking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Shared serialisation
// ---------------------------------------------------------------------------

const tradeCard = (t: Trade) => ({
  id: t.id,
  slug: t.slug,
  nameEn: t.nameEn,
  nameUr: t.nameUr,
  nameRoman: t.nameRoman,
  color: t.color,
  glyph: t.glyph,
});

const skillCard = (s: WorkerSkill) => ({
  id: s.id,
  labelEn: s.labelEn,
  labelUr: s.labelUr,
  source: s.source,
  confidence: s.confidence,
});

const photoCard = (p: WorkPhoto) => ({
  id: p.id,
  url: p.url,
  aiTags: p.aiTags,
  aiProvider: p.aiProvider,
});

const trustCard = (t: TrustSummary) => ({
  summaryEn: t.summaryEn,
  summaryUr: t.summaryUr,
  sourceReviewCount: t.sourceReviewCount,
  aiProvider: t.aiProvider,
  generatedAt: t.generatedAt,
});

/** Phone is withheld in the list view; it is on the profile, behind one tap. */
const workerCore = (w: Worker) => ({
  id: w.id,
  name: w.name,
  area: w.area,
  lat: w.lat,
  lng: w.lng,
  status: w.status,
  rateMin: w.rateMin,
  rateMax: w.rateMax,
  rating: w.rating,
  jobsCompleted: w.jobsCompleted,
  yearsExperience: w.yearsExperience,
  bioEn: w.bioEn,
  bioUr: w.bioUr,
  photoUrl: w.photoUrl,
  onboardedVia: w.onboardedVia,
  createdAt: w.createdAt,
});

const tagLabels = (photos: WorkPhoto[]) =>
  photos.flatMap((p) => p.aiTags.map((t) => t.label));

const skillTextLabels = (skills: WorkerSkill[]) =>
  skills.flatMap((s) => (s.labelUr ? [s.labelEn, s.labelUr] : [s.labelEn]));

// ---------------------------------------------------------------------------
// GET — ranked search
// ---------------------------------------------------------------------------

const searchQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  trade: z.string().trim().min(1).optional(),
  available: z.enum(['true', 'false', '1', '0']).optional(),
  radiusKm: z.coerce.number().positive().max(100).optional(),
  keywords: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const GET = handle(async (req: Request) => {
  const params = query(req, searchQuery);

  const centre = { lat: params.lat, lng: params.lng };
  const radiusKm = params.radiusKm ?? env.SEARCH_DEFAULT_RADIUS_KM;
  // The env cap is a ceiling, not a default — a caller can ask for fewer.
  const limit = Math.min(params.limit ?? env.SEARCH_MAX_RESULTS, env.SEARCH_MAX_RESULTS);
  const freeOnly = params.available === 'true' || params.available === '1';
  const keywords = (params.keywords ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  const box = boundingBox(centre, radiusKm);
  const database = await db();

  const where = [
    gte(workers.lat, box.minLat),
    lte(workers.lat, box.maxLat),
    gte(workers.lng, box.minLng),
    lte(workers.lng, box.maxLng),
  ];
  if (params.trade) where.push(eq(trades.slug, params.trade));
  if (freeOnly) where.push(eq(workers.status, 'FREE'));

  const rows = await database
    .select({ worker: workers, trade: trades })
    .from(workers)
    .innerJoin(trades, eq(workers.tradeId, trades.id))
    .where(and(...where));

  const meta = {
    centre,
    radiusKm,
    trade: params.trade ?? null,
    availableOnly: freeOnly,
    keywords,
    boundingBoxCandidates: rows.length,
    candidateCount: 0,
    returned: 0,
    weights: RANKING_WEIGHTS,
    formula: RANKING_FORMULA,
  };

  if (rows.length === 0) return ok([], meta);

  const ids = rows.map((r) => r.worker.id);
  const [skillRows, photoRows, trustRows] = await Promise.all([
    database.select().from(workerSkills).where(inArray(workerSkills.workerId, ids)),
    database.select().from(workPhotos).where(inArray(workPhotos.workerId, ids)),
    database.select().from(trustSummaries).where(inArray(trustSummaries.workerId, ids)),
  ]);

  const byWorker = <T extends { workerId: string }>(list: T[]) => {
    const map = new Map<string, T[]>();
    for (const item of list) {
      const bucket = map.get(item.workerId);
      if (bucket) bucket.push(item);
      else map.set(item.workerId, [item]);
    }
    return map;
  };

  const skillsOf = byWorker(skillRows);
  const photosOf = byWorker(photoRows);
  const trustOf = new Map(trustRows.map((t) => [t.workerId, t]));

  type Candidate = RankCandidate & {
    row: Worker;
    trade: Trade;
    skills: WorkerSkill[];
    photos: WorkPhoto[];
    trust: TrustSummary | null;
  };

  const candidates: Candidate[] = [];
  for (const { worker, trade } of rows) {
    // Exact distance; the bounding box is a square, so its corners overshoot.
    const distanceKm = haversineKm(centre, { lat: worker.lat, lng: worker.lng });
    if (distanceKm > radiusKm) continue;

    const skills = skillsOf.get(worker.id) ?? [];
    const photos = photosOf.get(worker.id) ?? [];

    candidates.push({
      id: worker.id,
      name: worker.name,
      area: worker.area,
      status: worker.status,
      rating: worker.rating,
      jobsCompleted: worker.jobsCompleted,
      distanceKm,
      tradeSlug: trade.slug,
      tradeNameEn: trade.nameEn,
      tradeKeywords: trade.keywords,
      skillLabels: skillTextLabels(skills),
      photoTags: tagLabels(photos),
      row: worker,
      trade,
      skills,
      photos,
      trust: trustOf.get(worker.id) ?? null,
    });
  }

  const ranked = rankWorkers(candidates, {
    keywords,
    tradeSlug: params.trade ?? null,
  }).slice(0, limit);

  const data = ranked.map(({ worker, score, breakdown, reason }) => ({
    ...workerCore(worker.row),
    trade: tradeCard(worker.trade),
    skills: worker.skills.map(skillCard),
    workPhotos: worker.photos.map(photoCard),
    trustSummary: worker.trust ? trustCard(worker.trust) : null,
    distanceKm: Number(worker.distanceKm.toFixed(2)),
    distance: {
      km: Number(worker.distanceKm.toFixed(2)),
      en: formatDistance(worker.distanceKm, 'en'),
      ur: formatDistance(worker.distanceKm, 'ur'),
    },
    ranking: { score, reason, breakdown },
  }));

  return ok(data, { ...meta, candidateCount: candidates.length, returned: data.length });
});

// ---------------------------------------------------------------------------
// POST — create from an extracted voice profile
// ---------------------------------------------------------------------------

const createWorkerBody = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(20),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be four digits.').optional(),
    tradeSlug: z.string().trim().min(1),
    yearsExperience: z.coerce.number().int().min(0).max(70),
    area: z.string().trim().min(1).max(120),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    rateMin: z.coerce.number().int().min(0).max(10_000_000),
    rateMax: z.coerce.number().int().min(0).max(10_000_000),
    bioUr: z.string().trim().max(2000).optional(),
    bioEn: z.string().trim().max(2000).optional(),
    skills: z
      .array(
        z.object({
          labelEn: z.string().trim().min(1).max(120),
          labelUr: z.string().trim().min(1).max(120).optional(),
          source: z.enum(['speech', 'photo', 'manual', 'stub']).optional(),
          confidence: z.coerce.number().min(0).max(1).optional(),
        }),
      )
      .max(40)
      .default([]),
    photos: z
      .array(
        z.object({
          url: z.string().trim().min(1).max(2000),
          aiTags: z
            .array(
              z.object({
                label: z.string().trim().min(1).max(120),
                // An unlabelled confidence is recorded as 0.5 rather than
                // dropped, so the tag's provenance stays visible in the UI.
                confidence: z.coerce.number().min(0).max(1).default(0.5),
              }),
            )
            .max(20)
            .default([]),
          aiProvider: z.string().trim().min(1).max(60).optional(),
        }),
      )
      .max(12)
      .default([]),
    onboardingTranscript: z.string().max(20_000).optional(),
    onboardedVia: z.enum(['voice', 'form']).optional(),
  })
  .refine((v) => v.rateMax >= v.rateMin, {
    message: 'rateMax must be greater than or equal to rateMin.',
    path: ['rateMax'],
  });

export const POST = handle(async (req: Request) => {
  const input = await body(req, createWorkerBody);
  const database = await db();

  const [trade] = await database
    .select()
    .from(trades)
    .where(eq(trades.slug, input.tradeSlug))
    .limit(1);

  if (!trade) {
    throw new ApiError('NOT_FOUND', `Unknown trade "${input.tradeSlug}".`, {
      tradeSlug: input.tradeSlug,
    });
  }

  // Friendly 409 for the common case; the unique index still guards the race,
  // which `handle()` turns into a CONFLICT of its own.
  const [existing] = await database
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.phone, input.phone))
    .limit(1);

  if (existing) {
    throw new ApiError('CONFLICT', 'A worker is already registered with that phone number.', {
      phone: input.phone,
    });
  }

  const created = await database.transaction(async (tx) => {
    const [worker] = await tx
      .insert(workers)
      .values({
        name: input.name,
        phone: input.phone,
        ...(input.pin ? { pin: input.pin } : {}),
        tradeId: trade.id,
        yearsExperience: input.yearsExperience,
        area: input.area,
        lat: input.lat,
        lng: input.lng,
        // He finished onboarding and is standing there — start him findable.
        status: 'FREE',
        rateMin: input.rateMin,
        rateMax: input.rateMax,
        bioUr: input.bioUr ?? null,
        bioEn: input.bioEn ?? null,
        onboardedVia: input.onboardedVia ?? 'voice',
        onboardingTranscript: input.onboardingTranscript ?? null,
      })
      .returning();

    const skills = input.skills.length
      ? await tx
          .insert(workerSkills)
          .values(
            input.skills.map((s) => ({
              workerId: worker.id,
              labelEn: s.labelEn,
              labelUr: s.labelUr ?? null,
              source: s.source ?? 'speech',
              confidence: s.confidence ?? null,
            })),
          )
          .returning()
      : [];

    const photos = input.photos.length
      ? await tx
          .insert(workPhotos)
          .values(
            input.photos.map((p) => ({
              workerId: worker.id,
              url: p.url,
              aiTags: p.aiTags,
              aiProvider: p.aiProvider ?? null,
            })),
          )
          .returning()
      : [];

    return { worker, skills, photos };
  });

  return ok(
    {
      ...workerCore(created.worker),
      phone: created.worker.phone,
      onboardingTranscript: created.worker.onboardingTranscript,
      trade: tradeCard(trade),
      skills: created.skills.map(skillCard),
      workPhotos: created.photos.map(photoCard),
      trustSummary: null,
      reviews: [],
    },
    { created: true, skills: created.skills.length, workPhotos: created.photos.length },
  );
});
