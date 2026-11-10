/**
 * POST /api/ai/extract-price — a spoken quote becomes a confirmable record.
 *
 * Without this there is nothing for the two sides to tap "agree" on, and no
 * record of what was agreed when they later disagree (PROJECT.md §2.1, row 6).
 */

import { z } from 'zod';
import { extractPrice } from '@/lib/ai';
import { body, handle, ok } from '@/lib/http';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const schema = z.object({
  transcript: z.string().min(1).max(4_000),
});

export const POST = handle(async (req: Request) => {
  const { transcript } = await body(req, schema);

  const { result, meta } = await extractPrice(transcript);
  return ok(result, { ai: meta });
});
