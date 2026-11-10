/**
 * POST /api/ai/transcribe — Urdu speech to text.
 *
 * The literacy barrier (PROJECT.md §2.1, row 1): without this the worker has
 * no input path at all. Accepts a recorded blob two ways, because the browser
 * recorder posts multipart while the pre-recorded demo fixtures post JSON.
 */

import { z } from 'zod';
import { transcribe } from '@/lib/ai';
import { ApiError, body, handle, ok } from '@/lib/http';
import { getLocalUpload } from '@/lib/storage';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const MAX_BYTES = 8 * 1024 * 1024;

const jsonSchema = z
  .object({
    audioBase64: z.string().optional(),
    mimeType: z.string().default('audio/webm').optional(),
    audioUrl: z.string().optional(),
    language: z.enum(['ur', 'en']).optional(),
  })
  .refine((v) => Boolean(v.audioBase64) || Boolean(v.audioUrl), {
    message: 'Provide `audioBase64` or `audioUrl`.',
  });

export const POST = handle(async (req: Request) => {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Audio must be 8MB or smaller.');
  }

  const contentType = req.headers.get('content-type') ?? '';
  let audio: Uint8Array;
  let mimeType: string;
  let language: 'ur' | 'en' | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('audio') ?? form.get('file');
    if (!(file instanceof Blob)) {
      throw new ApiError('BAD_REQUEST', 'Expected an `audio` or `file` field.');
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError('BAD_REQUEST', 'Audio must be 8MB or smaller.');
    }

    audio = new Uint8Array(await file.arrayBuffer());
    mimeType = file.type || 'audio/webm';

    const raw = form.get('language');
    const parsed = z.enum(['ur', 'en']).safeParse(raw);
    language = parsed.success ? parsed.data : undefined;
  } else {
    const input = await body(req, jsonSchema);

    if (input.audioUrl) {
      const url = input.audioUrl;
      let buf: Buffer;
      mimeType = input.mimeType ?? 'audio/webm';

      if (url.includes('/api/upload/')) {
        const name = url.split('/api/upload/')[1]?.split('?')[0];
        const local = name ? await getLocalUpload(name) : null;
        if (!local) throw new ApiError('NOT_FOUND', `Uploaded audio not found: ${name}`);
        buf = local.buffer;
        mimeType = local.mimeType;
      } else {
        const fetched = await fetch(url);
        if (!fetched.ok) throw new ApiError('BAD_REQUEST', `Could not fetch audio from ${url}`);
        buf = Buffer.from(await fetched.arrayBuffer());
        const headerType = fetched.headers.get('content-type');
        if (headerType) mimeType = headerType;
      }

      audio = new Uint8Array(buf);
    } else {
      // Buffer, not atob: base64 audio is binary and atob mangles it.
      audio = new Uint8Array(Buffer.from(input.audioBase64!, 'base64'));
      mimeType = input.mimeType ?? 'audio/webm';
    }
    language = input.language;
  }

  if (!audio.byteLength) throw new ApiError('BAD_REQUEST', 'The audio was empty.');
  if (audio.byteLength > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Audio must be 8MB or smaller.');
  }

  const { result, meta } = await transcribe({ audio, mimeType, language });
  return ok(result, { ai: meta });
});
