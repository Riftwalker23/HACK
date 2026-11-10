/**
 * Media storage for voice notes and work photos.
 *
 *   SUPABASE_URL + SUPABASE_SERVICE_KEY set -> Supabase Storage (public bucket)
 *   otherwise                               -> local disk, .data/uploads, served
 *                                              by GET /api/upload/[name]
 *
 * Behaviour worth knowing:
 *  - The bucket is created on first use, so there is no dashboard step.
 *  - Both Supabase key styles work: legacy `service_role` JWTs (sent as
 *    `apikey` + `Authorization`) and newer `sb_secret_…` keys (`apikey` only).
 *  - SUPABASE_URL is reduced to its origin, so pasting the ".../rest/v1/"
 *    address from the dashboard still works.
 *  - A Supabase failure (venue wifi, bad key) falls back to local disk instead
 *    of losing a worker's voice note. `driver` / `fallbackReason` on the result
 *    make that visible rather than silent.
 *
 * Plain `fetch` against the Storage REST API; no supabase-js dependency.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { env, hasSupabaseStorage } from '@/lib/env';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB, audio and images alike

export type MediaKind = 'audio' | 'image';

export type StoredMedia = {
  url: string;
  kind: MediaKind;
  bytes: number;
  /** Object name; the last path segment of `url`. */
  name: string;
  mimeType: string;
  /** Which backend actually holds the file. */
  driver: 'supabase' | 'local';
  /** Set when Supabase was configured but failed and the file went to disk. */
  fallbackReason?: string;
};

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
};

export const LOCAL_UPLOADS_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), '.data', 'uploads');

/** Extension -> the one mime type we serve it as. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
};

export function mimeForName(name: string): string {
  return EXT_TO_MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

export function detectMediaKind(mimeType: string): { kind: MediaKind; extension: string } | null {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  if (base in ALLOWED_IMAGE_TYPES) return { kind: 'image', extension: ALLOWED_IMAGE_TYPES[base]! };
  if (base in ALLOWED_AUDIO_TYPES) return { kind: 'audio', extension: ALLOWED_AUDIO_TYPES[base]! };
  return null;
}

// ---------------------------------------------------------------------------
// Supabase Storage
// ---------------------------------------------------------------------------

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = env.SUPABASE_SERVICE_KEY!;
  return {
    apikey: key,
    // Legacy service_role keys are JWTs and go in Authorization too. The newer
    // sb_secret_ keys are not JWTs and must be sent as `apikey` only.
    ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    ...extra,
  };
}

// Only the origin is used: pasting the REST address (".../rest/v1/") instead of
// the bare project URL is an easy mistake, and any path on SUPABASE_URL would
// otherwise send Storage calls to the wrong service.
const storageBase = () => `${new URL(env.SUPABASE_URL!).origin}/storage/v1`;

const globalForStorage = globalThis as unknown as { __roshanBucketReady?: boolean };

/** Creates the public bucket once per process. "Already exists" is success. */
async function ensureBucket(): Promise<void> {
  if (globalForStorage.__roshanBucketReady) return;

  const res = await fetch(`${storageBase()}/bucket`, {
    method: 'POST',
    headers: supabaseHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      id: env.SUPABASE_BUCKET,
      name: env.SUPABASE_BUCKET,
      public: true,
      file_size_limit: MAX_MEDIA_BYTES,
      allowed_mime_types: [
        ...new Set([...Object.keys(ALLOWED_IMAGE_TYPES), ...Object.keys(ALLOWED_AUDIO_TYPES)]),
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Supabase answers 400 or 409 with "already exists" for a second create.
    if (!/already exists|Duplicate/i.test(detail)) {
      throw new Error(`Supabase bucket setup failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
  globalForStorage.__roshanBucketReady = true;
}

async function uploadToSupabase(name: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  await ensureBucket();

  const res = await fetch(`${storageBase()}/object/${env.SUPABASE_BUCKET}/${name}`, {
    method: 'POST',
    headers: supabaseHeaders({ 'content-type': mimeType, 'x-upsert': 'false' }),
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase Storage upload failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return `${storageBase()}/object/public/${env.SUPABASE_BUCKET}/${name}`;
}

/** Best-effort delete of a Supabase object (used by the integration check). */
export async function deleteMedia(media: Pick<StoredMedia, 'name' | 'driver'>): Promise<void> {
  if (media.driver === 'supabase' && hasSupabaseStorage()) {
    await fetch(`${storageBase()}/object/${env.SUPABASE_BUCKET}/${media.name}`, {
      method: 'DELETE',
      headers: supabaseHeaders(),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// Local disk
// ---------------------------------------------------------------------------

async function saveToLocalDisk(name: string, bytes: Uint8Array): Promise<string> {
  await mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
  await writeFile(join(LOCAL_UPLOADS_DIR, name), bytes);
  return `/api/upload/${name}`;
}

/**
 * Retrieve a locally stored upload. Returns null if missing or if the name
 * could point outside the uploads directory.
 */
export async function getLocalUpload(
  name: string,
): Promise<{ buffer: Buffer; mimeType: string; size: number } | null> {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name.includes('..')) return null;

  const filePath = join(LOCAL_UPLOADS_DIR, name);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
    return { buffer: await readFile(filePath), mimeType: mimeForName(name), size: info.size };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Validates and stores one file. Throws a plain Error (with a user-readable
 * message) for an oversize, empty or unsupported file.
 *
 * `preferredName` is accepted for API compatibility but not used in the stored
 * name: the object name is always `<kind>-<uuid>.<ext-from-mime>`, so a
 * client-supplied filename can never choose an extension or a path.
 */
export async function storeMedia(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  preferredName?: string,
): Promise<StoredMedia> {
  void preferredName;

  const bytes = buffer.byteLength;
  if (bytes === 0) throw new Error('The uploaded file is empty.');
  if (bytes > MAX_MEDIA_BYTES) {
    throw new Error(
      `File size (${(bytes / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of ${MAX_MEDIA_BYTES / 1024 / 1024}MB.`,
    );
  }

  const detected = detectMediaKind(mimeType);
  if (!detected) {
    throw new Error(
      `Unsupported media type "${mimeType}". Allowed audio: webm, ogg, mp3, mp4/m4a, wav, flac. Allowed images: jpeg, png, webp.`,
    );
  }

  const { kind, extension } = detected;
  const name = `${kind}-${randomUUID()}.${extension}`;
  const base = { name, kind, bytes, mimeType: mimeForName(name) };
  const data = new Uint8Array(buffer);

  if (hasSupabaseStorage()) {
    try {
      return { ...base, url: await uploadToSupabase(name, data, base.mimeType), driver: 'supabase' };
    } catch (err) {
      const reason = (err as Error).message;
      console.warn(`[storage] supabase failed, saving locally: ${reason}`);
      return { ...base, url: await saveToLocalDisk(name, data), driver: 'local', fallbackReason: reason };
    }
  }

  return { ...base, url: await saveToLocalDisk(name, data), driver: 'local' };
}
