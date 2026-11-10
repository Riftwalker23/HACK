/**
 * POST /api/ai/tag-photo — vision tagging of a worker's photo of his own work.
 *
 * He has no CV. Without these tags the photo is decoration rather than
 * evidence of a specific skill (PROJECT.md §2.1, row 3).
 */

import { z } from 'zod';
import { tagPhoto } from '@/lib/ai';
import { ApiError, body, handle, ok } from '@/lib/http';
import { getLocalUpload } from '@/lib/storage';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const MAX_BYTES = 8 * 1024 * 1024;

const jsonSchema = z
  .object({
    imageBase64: z.string().optional(),
    imageMimeType: z.string().default('image/jpeg').optional(),
    imageUrl: z.string().optional(),
  })
  .refine((v) => Boolean(v.imageBase64) || Boolean(v.imageUrl), {
    message: 'Provide `imageBase64` or `imageUrl`.',
  });

/** Claude vision accepts these four only; reject anything else up front. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function assertImageType(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(base)) {
    throw new ApiError(
      'BAD_REQUEST',
      `Unsupported image type "${base}". Use JPEG, PNG, GIF or WebP.`,
    );
  }
  return base;
}

export const POST = handle(async (req: Request) => {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
  }

  const contentType = req.headers.get('content-type') ?? '';
  let imageBase64: string;
  let imageMimeType: string;

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('image') ?? form.get('file');
    if (!(file instanceof Blob)) {
      throw new ApiError('BAD_REQUEST', 'Expected an `image` or `file` field.');
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
    }

    imageMimeType = assertImageType(file.type || 'image/jpeg');
    imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  } else {
    const input = await body(req, jsonSchema);

    if (input.imageUrl) {
      const url = input.imageUrl;
      let buf: Buffer;
      let mime = input.imageMimeType ?? 'image/jpeg';

      if (url.includes('/api/upload/')) {
        const name = url.split('/api/upload/')[1]?.split('?')[0];
        const local = name ? await getLocalUpload(name) : null;
        if (!local) throw new ApiError('NOT_FOUND', `Uploaded image not found: ${name}`);
        buf = local.buffer;
        mime = local.mimeType;
      } else {
        const fetched = await fetch(url);
        if (!fetched.ok) throw new ApiError('BAD_REQUEST', `Could not fetch image from ${url}`);
        buf = Buffer.from(await fetched.arrayBuffer());
        const headerType = fetched.headers.get('content-type');
        if (headerType) mime = headerType;
      }

      imageMimeType = assertImageType(mime);
      imageBase64 = buf.toString('base64');
    } else {
      imageMimeType = assertImageType(input.imageMimeType ?? 'image/jpeg');
      imageBase64 = input.imageBase64!;
    }

    // base64 is ~4/3 of the bytes it encodes.
    if (imageBase64.length * 0.75 > MAX_BYTES) {
      throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
    }
  }

  const { result, meta } = await tagPhoto({ imageBase64, imageMimeType });
  return ok(result, { ai: meta });
});
