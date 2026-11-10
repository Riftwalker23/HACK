/**
 * POST /api/ai/tag-photo — vision tagging of a worker's photo of his own work.
 *
 * He has no CV. Without these tags the photo is decoration rather than
 * evidence of a specific skill (PROJECT.md §2.1, row 3).
 */

import { z } from 'zod';
import { tagPhoto } from '@/lib/ai';
import { ApiError, body, handle, ok } from '@/lib/http';

// No `runtime` / `dynamic` segment config: next.config.ts enables
// `cacheComponents`, and Next 16 fails the build on both. Node is already the
// default runtime (PGlite and node:crypto work) and a POST handler is always
// request-time, so nothing is lost.

const MAX_BYTES = 8 * 1024 * 1024;

const jsonSchema = z.object({
  imageBase64: z.string().min(1),
  imageMimeType: z.string().min(1).default('image/jpeg'),
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
    const file = form.get('image');
    if (!(file instanceof Blob)) {
      throw new ApiError('BAD_REQUEST', 'Expected an `image` file field.');
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
    }

    imageMimeType = assertImageType(file.type || 'image/jpeg');
    imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  } else {
    const input = await body(req, jsonSchema);
    imageMimeType = assertImageType(input.imageMimeType);
    imageBase64 = input.imageBase64;
    // base64 is ~4/3 of the bytes it encodes.
    if (imageBase64.length * 0.75 > MAX_BYTES) {
      throw new ApiError('BAD_REQUEST', 'Image must be 8MB or smaller.');
    }
  }

  const { result, meta } = await tagPhoto({ imageBase64, imageMimeType });
  return ok(result, { ai: meta });
});
