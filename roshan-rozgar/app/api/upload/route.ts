/**
 * POST /api/upload (multipart)
 *
 * Media upload endpoint:
 * - Stores audio (webm/mp4/wav, max 5 MB) and images (jpeg/png/webp, max 5 MB).
 * - Uses Supabase Storage when SUPABASE_URL and SUPABASE_SERVICE_KEY are set,
 *   else writes to .data/uploads and serves via GET /api/upload/[name].
 * - Validates type and size.
 * - Returns { url, kind, bytes }.
 */

import { ApiError, handle, ok } from '@/lib/http';
import { MAX_MEDIA_BYTES, detectMediaKind, storeMedia } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_MEDIA_BYTES + 1024 * 1024) {
    // Generous envelope check for multipart boundary overhead
    throw new ApiError('BAD_REQUEST', 'Request payload exceeds 5MB limit.');
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new ApiError('BAD_REQUEST', 'Content-Type must be multipart/form-data.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError('BAD_REQUEST', 'Failed to parse multipart form data.');
  }

  // Support 'file', 'image', 'audio', or 'media' fields
  const file = form.get('file') ?? form.get('image') ?? form.get('audio') ?? form.get('media');

  if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
    throw new ApiError('BAD_REQUEST', 'No media file provided. Expected `file`, `image`, `audio`, or `media`.');
  }

  if (file.size > MAX_MEDIA_BYTES) {
    throw new ApiError(
      'BAD_REQUEST',
      `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds the 5MB limit.`,
    );
  }

  if (file.size === 0) {
    throw new ApiError('BAD_REQUEST', 'The uploaded file is empty.');
  }

  const mimeType = file.type || 'application/octet-stream';
  const detected = detectMediaKind(mimeType);
  if (!detected) {
    throw new ApiError(
      'BAD_REQUEST',
      `Unsupported media type "${mimeType}". Allowed audio: webm, mp4, wav. Allowed images: jpeg, png, webp.`,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const preferredName = file instanceof File ? file.name : undefined;

  const stored = await storeMedia(bytes, mimeType, preferredName);

  return ok(stored);
});
