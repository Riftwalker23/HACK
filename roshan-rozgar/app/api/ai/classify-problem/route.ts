/**
 * POST /api/ai/classify-problem — "what's broken" to trade + urgency + fix.
 *
 * Without this the customer must already know she needs a plumber rather than
 * an AC technician before she can ask for help (PROJECT.md §2.1, row 4).
 */

import { z } from 'zod';
import { classifyProblem } from '@/lib/ai';
import { ApiError, body, handle, ok } from '@/lib/http';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const MAX_BYTES = 8 * 1024 * 1024;

const schema = z
  .object({
    text: z.string().max(4_000).optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.string().optional(),
  })
  // She may describe it, photograph it, or both — but not neither.
  .refine((v) => Boolean(v.text?.trim()) || Boolean(v.imageBase64), {
    message: 'Provide `text`, `imageBase64`, or both.',
  })
  .refine((v) => !v.imageBase64 || Boolean(v.imageMimeType), {
    message: '`imageMimeType` is required when sending `imageBase64`.',
  });

export const POST = handle(async (req: Request) => {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Request must be 8MB or smaller.');
  }

  const input = await body(req, schema);

  if (input.imageBase64 && input.imageBase64.length * 0.75 > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
  }

  const { result, meta } = await classifyProblem({
    text: input.text?.trim() || undefined,
    imageBase64: input.imageBase64,
    imageMimeType: input.imageMimeType,
  });

  return ok(result, { ai: meta });
});
