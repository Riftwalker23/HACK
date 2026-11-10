/**
 * GET /api/health — is this demo environment real or stubbed?
 *
 * The brief penalises presenting mocked functionality as working, so the one
 * endpoint the team hits before going on stage answers three questions at once:
 * which database driver is live, which AI providers are reachable, and whether
 * the row counts mean the seed actually ran.
 */

import { count } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { customers, jobs, reviews, trades, workers } from '@/db/schema';
import { isFullyStubbed } from '@/lib/env';
import { handle, ok } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProviderStatus = { name: string; available: boolean };

export const GET = handle(async (_req: Request) => {
  const { db: database, driver } = await getDb();

  const [tradeRows, workerRows, customerRows, jobRows, reviewRows] = await Promise.all([
    database.select({ n: count() }).from(trades),
    database.select({ n: count() }).from(workers),
    database.select({ n: count() }).from(customers),
    database.select({ n: count() }).from(jobs),
    database.select({ n: count() }).from(reviews),
  ]);

  // Loaded lazily and defensively: health is the endpoint that must still
  // answer when the AI layer is the thing that is broken.
  let providers: ProviderStatus[] = [];
  let providerError: string | null = null;
  try {
    const { providerStatus } = await import('@/lib/ai');
    providers = await providerStatus();
  } catch (err) {
    providerError = (err as Error)?.message ?? 'AI provider status unavailable.';
  }

  const counts = {
    trades: Number(tradeRows[0]?.n ?? 0),
    workers: Number(workerRows[0]?.n ?? 0),
    customers: Number(customerRows[0]?.n ?? 0),
    jobs: Number(jobRows[0]?.n ?? 0),
    reviews: Number(reviewRows[0]?.n ?? 0),
  };

  return ok({
    ok: counts.trades > 0,
    driver,
    providers,
    ...(providerError ? { providerError } : {}),
    counts,
    stubbed: isFullyStubbed(),
  });
});
