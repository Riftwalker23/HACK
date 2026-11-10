/**
 * POST /api/workers/:id/photos
 *
 * Attaches one or more work photos (e.g. uploaded via /api/upload) to a worker.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { workPhotos, workers } from '@/db/schema';
import { ApiError, body, handle, ok, uuidParam } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const photoItem = z.object({
  url: z.string().trim().min(1).max(2000),
  aiTags: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        confidence: z.coerce.number().min(0).max(1).default(0.5),
      }),
    )
    .max(20)
    .default([]),
  aiProvider: z.string().trim().min(1).max(60).optional(),
});

const postBody = z.union([
  photoItem,
  z.object({
    photos: z.array(photoItem).min(1).max(12),
  }),
]);

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const parsedId = uuidParam.safeParse(id);
  if (!parsedId.success) throw new ApiError('BAD_REQUEST', 'Worker id must be a UUID.');
  const workerId = parsedId.data;

  const database = await db();
  const [worker] = await database
    .select({ id: workers.id })
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);

  if (!worker) throw new ApiError('NOT_FOUND', 'No worker with that id.');

  const input = await body(req, postBody);
  const items = 'photos' in input ? input.photos : [input];

  const inserted = await database
    .insert(workPhotos)
    .values(
      items.map((p) => ({
        workerId,
        url: p.url,
        aiTags: p.aiTags,
        aiProvider: p.aiProvider ?? null,
      })),
    )
    .returning();

  return ok(inserted, { count: inserted.length });
});
