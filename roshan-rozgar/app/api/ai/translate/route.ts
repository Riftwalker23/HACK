/**
 * POST /api/ai/translate — the live voice-note translation in the chat.
 *
 * He speaks Urdu, she reads English. Without this the two users literally
 * cannot negotiate (PROJECT.md §2.1, row 5).
 */

import { z } from 'zod';
import { translate } from '@/lib/ai';
import { body, handle, ok } from '@/lib/http';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const schema = z.object({
  text: z.string().min(1).max(4_000),
  from: z.enum(['ur', 'en', 'roman', 'ur-roman']),
  to: z.enum(['ur', 'en', 'roman', 'ur-roman']),
});

export const POST = handle(async (req: Request) => {
  const input = await body(req, schema);

  const { result, meta } = await translate(input);
  return ok(result, { ai: meta });
});
