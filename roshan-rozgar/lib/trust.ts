/**
 * The trust layer (Outcome 5) — and the bilingual guarantee that Outcomes 3
 * and 5 both depend on.
 *
 * Three things live here because chat and reviews need exactly the same
 * behaviour and must never drift apart:
 *
 *  1. `fillBothLanguages` — every row that holds human speech ends up with an
 *     Urdu side AND an English side. The worker reads Urdu off the same row the
 *     customer reads English off. Without it the two users cannot negotiate and
 *     a spoken Urdu review is invisible to the next customer.
 *  2. `combineProviders` — one honest provenance label per row.
 *  3. `regenerateTrustSummary` / `trustSnapshot` — the synthesised trust view,
 *     always carrying its source count.
 *
 * A summary with no source count is not trust, and a stubbed summary presented
 * as a model summary is worse than no summary, so `aiProvider` is persisted on
 * every row and returned to the UI.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { db as getDb, type Db } from '@/db/client';
import { jobs, reviews, trades, trustSummaries, workers } from '@/db/schema';
import { summariseReviews, translate } from '@/lib/ai';
import { ApiError } from '@/lib/http';

export type TrustSummaryRow = typeof trustSummaries.$inferSelect;

/**
 * `PgTransaction` extends `PgDatabase`, so the `tx` handed out by
 * `database.transaction()` is assignable to `Db`. One type serves both, and
 * every helper here can be called inside or outside a transaction.
 */
export type DbOrTx = Db;

/** Nothing was produced by a model. Distinct from 'stub', which IS model-shaped output. */
export const NO_PROVIDER = 'none';

// ---------------------------------------------------------------------------
// Bilingual guarantee
// ---------------------------------------------------------------------------

export type Bilingual = {
  ur: string | null;
  en: string | null;
  /** Provider that produced the filled-in side, or 'none' if nothing was translated. */
  provider: string;
  /** Which side the translator produced, so the UI can mark it as machine-translated. */
  translated: 'ur' | 'en' | null;
  /** Set when translation failed; the row is still saved with the side we had. */
  error?: string;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Guarantees both transcript sides for one row.
 *
 * Deliberately never throws: losing a voice note or a spoken review because a
 * translation call failed would be a worse failure than showing one language
 * and labelling it. The caller persists whatever comes back and surfaces
 * `provider` / `error` in the response meta.
 */
export async function fillBothLanguages(input: {
  ur?: string | null;
  en?: string | null;
}): Promise<Bilingual> {
  const ur = clean(input.ur);
  const en = clean(input.en);

  if (ur && en) return { ur, en, provider: NO_PROVIDER, translated: null };
  if (!ur && !en) return { ur: null, en: null, provider: NO_PROVIDER, translated: null };

  const from = ur ? 'ur' : 'en';
  const to = ur ? 'en' : 'ur';
  const text = (ur ?? en) as string;

  try {
    const { result, meta } = await translate({ text, from, to });
    const filled = clean(result.text) ?? text;
    return {
      ur: to === 'ur' ? filled : ur,
      en: to === 'en' ? filled : en,
      provider: meta.provider,
      translated: to,
    };
  } catch (err) {
    console.warn('[trust] translation failed; saving one-sided text', err);
    return {
      ur,
      en,
      provider: NO_PROVIDER,
      translated: null,
      error: (err as Error)?.message ?? 'translation failed',
    };
  }
}

/**
 * One provenance label for a row that several AI steps touched.
 *
 * If ANY step fell back to the deterministic stub the row is partly demo data,
 * so the stored label is 'stub'. The UI's `provider === 'stub'` check then
 * cannot overstate what a model actually did — understating is the safe
 * direction, and the per-step detail is still returned in `meta`.
 */
export function combineProviders(...labels: Array<string | null | undefined>): string {
  const used = labels.filter((l): l is string => Boolean(l) && l !== NO_PROVIDER);
  if (used.length === 0) return NO_PROVIDER;
  if (used.includes('stub')) return 'stub';
  return [...new Set(used)].join('+');
}

// ---------------------------------------------------------------------------
// Aggregates the UI shows
// ---------------------------------------------------------------------------

export type TagCount = { tag: string; count: number };

/** Tag-frequency aggregate, most-tapped first. Chips are the review a non-reader leaves. */
export function countTags(tagLists: Array<string[] | null | undefined>, top?: number): TagCount[] {
  const counts = new Map<string, number>();
  for (const list of tagLists) {
    for (const raw of list ?? []) {
      const tag = raw.trim();
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return top ? sorted.slice(0, top) : sorted;
}

export type StarDistribution = Record<'1' | '2' | '3' | '4' | '5', number>;

export function starDistribution(stars: number[]): StarDistribution {
  const dist: StarDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const s of stars) {
    const key = String(Math.min(5, Math.max(1, Math.round(s)))) as keyof StarDistribution;
    dist[key] += 1;
  }
  return dist;
}

/** Average stars to 2 decimals — the same rounding `workers.rating` is stored with. */
export function averageStars(stars: number[]): number {
  if (stars.length === 0) return 0;
  const total = stars.reduce((sum, s) => sum + s, 0);
  return Math.round((total / stars.length) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Trust summary
// ---------------------------------------------------------------------------

/** Honest placeholder. A worker with no reviews gets no invented praise. */
const NO_REVIEWS_EN =
  'No reviews yet. No customer has rated this worker on Roshan Rozgar, so there is nothing to summarise — this is not a judgement either way.';
const NO_REVIEWS_UR =
  'ابھی کوئی رائے موجود نہیں۔ کسی گاہک نے اس کاریگر کے بارے میں رائے نہیں دی، اس لیے خلاصہ ممکن نہیں — یہ اچھی یا بری رائے نہیں ہے۔';

/**
 * Rebuilds a worker's trust summary from ALL of their reviews and upserts it.
 *
 * Pass `tx` to run inside a caller's transaction. Callers that are inserting a
 * review should instead call this AFTER their transaction commits: a failed
 * model call must never roll back a review the customer already spoke.
 */
export async function regenerateTrustSummary(
  workerId: string,
  tx?: DbOrTx,
): Promise<TrustSummaryRow> {
  const database = tx ?? (await getDb());

  const [worker] = await database
    .select({ id: workers.id, tradeNameEn: trades.nameEn })
    .from(workers)
    .innerJoin(trades, eq(workers.tradeId, trades.id))
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) throw new ApiError('NOT_FOUND', 'No such worker.');

  const rows = await database
    .select({
      stars: reviews.stars,
      tags: reviews.tags,
      transcriptEn: reviews.transcriptEn,
      transcriptUr: reviews.transcriptUr,
    })
    .from(reviews)
    .where(eq(reviews.workerId, workerId))
    .orderBy(desc(reviews.createdAt));

  let summaryEn = NO_REVIEWS_EN;
  let summaryUr: string | null = NO_REVIEWS_UR;
  // 'none' rather than 'stub': no model was asked, so no model should be credited.
  let provider = NO_PROVIDER;

  if (rows.length > 0) {
    const { result, meta } = await summariseReviews({
      tradeNameEn: worker.tradeNameEn,
      reviews: rows.map((r) => ({
        stars: r.stars,
        tags: r.tags ?? [],
        // English first so a single-language model still reads something sane.
        text: r.transcriptEn ?? r.transcriptUr,
      })),
    });
    summaryEn = result.summaryEn;
    summaryUr = result.summaryUr;
    provider = meta.provider;
  }

  const generatedAt = new Date();
  // Count comes from the rows we actually read, never from the model's claim.
  const sourceReviewCount = rows.length;

  const [saved] = await database
    .insert(trustSummaries)
    .values({ workerId, summaryEn, summaryUr, sourceReviewCount, aiProvider: provider, generatedAt })
    .onConflictDoUpdate({
      target: trustSummaries.workerId,
      set: { summaryEn, summaryUr, sourceReviewCount, aiProvider: provider, generatedAt },
    })
    .returning();

  return saved;
}

// ---------------------------------------------------------------------------
// Snapshot for the customer-facing TrustBlock
// ---------------------------------------------------------------------------

export type TrustSnapshot = {
  rating: number;
  jobsCompleted: number;
  reviewCount: number;
  lastJobAt: Date | null;
  topTags: TagCount[];
  summary: TrustSummaryRow | null;
};

/** Exactly the bundle the TrustBlock renders — one call, no N+1 from the UI. */
export async function trustSnapshot(workerId: string, tx?: DbOrTx): Promise<TrustSnapshot> {
  const database = tx ?? (await getDb());

  const [worker] = await database
    .select({ rating: workers.rating, jobsCompleted: workers.jobsCompleted })
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) throw new ApiError('NOT_FOUND', 'No such worker.');

  const [reviewRows, lastJobRows, summaryRows] = await Promise.all([
    database.select({ tags: reviews.tags }).from(reviews).where(eq(reviews.workerId, workerId)),
    database
      .select({ completedAt: jobs.completedAt })
      .from(jobs)
      .where(and(eq(jobs.workerId, workerId), eq(jobs.status, 'COMPLETED')))
      .orderBy(desc(jobs.completedAt))
      .limit(1),
    database.select().from(trustSummaries).where(eq(trustSummaries.workerId, workerId)).limit(1),
  ]);

  return {
    rating: worker.rating,
    jobsCompleted: worker.jobsCompleted,
    reviewCount: reviewRows.length,
    lastJobAt: lastJobRows[0]?.completedAt ?? null,
    topTags: countTags(reviewRows.map((r) => r.tags), 5),
    summary: summaryRows[0] ?? null,
  };
}

/**
 * Recomputes `workers.rating` as the true average of that worker's review
 * stars. Must be called with the transaction that inserted the review so the
 * new review is included and two concurrent reviews cannot interleave.
 */
export async function recomputeWorkerRating(workerId: string, tx: DbOrTx): Promise<{
  rating: number;
  reviewCount: number;
}> {
  const [agg] = await tx
    .select({
      avg: sql<string | null>`avg(${reviews.stars})`,
      count: sql<string>`count(*)`,
    })
    .from(reviews)
    .where(eq(reviews.workerId, workerId));

  const reviewCount = Number(agg?.count ?? 0);
  const rating = reviewCount === 0 ? 0 : Math.round(Number(agg?.avg ?? 0) * 100) / 100;

  await tx.update(workers).set({ rating }).where(eq(workers.id, workerId));

  return { rating, reviewCount };
}
