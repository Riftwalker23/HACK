/**
 * POST /api/upload — store a voice note or work photo, get a URL back.
 *
 *   multipart/form-data, field `file`
 *   audio: webm/ogg/mp3/mp4/m4a/wav/flac, up to 8MB
 *   image: jpeg/png/webp, up to 5MB (the client resizes to 1280px first)
 *
 * The returned `url` goes straight into `messages.audioUrl`, `jobs.photoUrl`, a
 * work photo, or a review's `voiceUrl`. Stored in Supabase Storage when
 * configured, else on local disk; `driver` says which.
 */

import { ApiError, handle, ok } from '@/lib/http';
import { MAX_BYTES, classify, saveMedia } from '@/lib/storage';

export const POST = handle(async (req: Request) => {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new ApiError('BAD_REQUEST', 'Send multipart/form-data with a `file` field.');
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    throw new ApiError('BAD_REQUEST', 'Expected a `file` field.');
  }

  const meta = classify(file.type);
  if (!meta) {
    throw new ApiError('BAD_REQUEST', `Unsupported file type "${file.type || 'unknown'}".`, {
      allowed: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'image/jpeg', 'image/png', 'image/webp'],
    });
  }
  if (file.size > MAX_BYTES[meta.kind]) {
    throw new ApiError('BAD_REQUEST', `${meta.kind} files must be ${MAX_BYTES[meta.kind] / 1024 / 1024}MB or smaller.`);
  }

  const stored = await saveMedia(new Uint8Array(await file.arrayBuffer()), file.type);
  return ok(stored, { driver: stored.driver });
});
