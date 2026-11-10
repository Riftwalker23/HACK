/**
 * POST /api/ai/extract-profile — spoken interview to structured profile.
 *
 * Without this the transcript is a wall of audio text and the worker is not
 * discoverable by trade, area or skill (PROJECT.md §2.1, row 2).
 */

import { z } from 'zod';
import { extractProfile } from '@/lib/ai';
import { body, handle, ok } from '@/lib/http';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const schema = z.object({
  // Four spoken answers concatenated; generous ceiling, but not unbounded.
  transcript: z.string().min(1).max(20_000),
});

export const POST = handle(async (req: Request) => {
  const { transcript } = await body(req, schema);

  const { result, meta } = await extractProfile(transcript);
  return ok(result, { ai: meta });
});
