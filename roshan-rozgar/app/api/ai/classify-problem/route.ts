/**
 * POST /api/ai/classify-problem — "what's broken" to trade + urgency + fix.
 *
 * Without this the customer must already know she needs a plumber rather than
 * an AC technician before she can ask for help (PROJECT.md §2.1, row 4).
 */

import { z } from 'zod';
import { classifyProblem } from '@/lib/ai';
import { ApiError, body, handle, ok } from '@/lib/http';
import { getLocalUpload } from '@/lib/storage';

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
    imageUrl: z.string().optional(),
  })
  // She may describe it, photograph it, or both — but not neither.
  .refine((v) => Boolean(v.text?.trim()) || Boolean(v.imageBase64) || Boolean(v.imageUrl), {
    message: 'Provide `text`, `imageBase64`, or `imageUrl`.',
  });

export const POST = handle(async (req: Request) => {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Request must be 8MB or smaller.');
  }

  const input = await body(req, schema);
  let imageBase64 = input.imageBase64;
  let imageMimeType = input.imageMimeType ?? 'image/jpeg';

  if (input.imageUrl) {
    const url = input.imageUrl;
    let buf: Buffer;

    if (url.includes('/api/upload/')) {
      const name = url.split('/api/upload/')[1]?.split('?')[0];
      const local = name ? await getLocalUpload(name) : null;
      if (!local) throw new ApiError('NOT_FOUND', `Uploaded image not found: ${name}`);
      buf = local.buffer;
      imageMimeType = local.mimeType;
    } else {
      const fetched = await fetch(url);
      if (!fetched.ok) throw new ApiError('BAD_REQUEST', `Could not fetch image from ${url}`);
      buf = Buffer.from(await fetched.arrayBuffer());
      const headerType = fetched.headers.get('content-type');
      if (headerType) imageMimeType = headerType;
    }

    imageBase64 = buf.toString('base64');
  }

  if (imageBase64 && imageBase64.length * 0.75 > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
  }

  const { result, meta } = await classifyProblem({
    text: input.text?.trim() || undefined,
    imageBase64,
    imageMimeType: imageBase64 ? imageMimeType : undefined,
  });

  // Carry `provider` inside the payload as well as in meta: POST /api/jobs
  // stores this object verbatim on the job, and a classification is only
  // worth storing if it records which model produced it.
  return ok({ ...result, provider: meta.provider }, { ai: meta });
});
