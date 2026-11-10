/**
 * Media storage for voice notes and work photos.
 *
 *   SUPABASE_URL + SUPABASE_SERVICE_KEY set -> Supabase Storage (public bucket)
 *   otherwise                               -> local disk, .data/uploads
 *
 * A Supabase failure (venue wifi, bad key) falls back to local disk instead of
 * failing the upload: a worker's voice note must never be lost because the cloud
 * was unreachable. Every result reports which `driver` stored it, so the
 * fallback is visible rather than silent.
 *
 * Plain `fetch` against the Storage REST API; no supabase-js dependency.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { env, hasSupabaseStorage } from '@/lib/env';

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join('.data', 'uploads');

export type MediaKind = 'audio' | 'image';

/** Allowlist, by base mime type (codec parameters are stripped first). */
const ALLOWED: Record<string, { kind: MediaKind; ext: string }> = {
  'audio/webm': { kind: 'audio', ext: 'webm' },
  'audio/ogg': { kind: 'audio', ext: 'ogg' },
  'audio/mpeg': { kind: 'audio', ext: 'mp3' },
  'audio/mp3': { kind: 'audio', ext: 'mp3' },
  'audio/mp4': { kind: 'audio', ext: 'mp4' },
  'audio/m4a': { kind: 'audio', ext: 'm4a' },
  'audio/x-m4a': { kind: 'audio', ext: 'm4a' },
  'audio/wav': { kind: 'audio', ext: 'wav' },
  'audio/x-wav': { kind: 'audio', ext: 'wav' },
  'audio/wave': { kind: 'audio', ext: 'wav' },
  'audio/flac': { kind: 'audio', ext: 'flac' },
  'image/jpeg': { kind: 'image', ext: 'jpg' },
  'image/png': { kind: 'image', ext: 'png' },
  'image/webp': { kind: 'image', ext: 'webp' },
};

export const MAX_BYTES: Record<MediaKind, number> = {
  audio: 8 * 1024 * 1024,
  image: 5 * 1024 * 1024,
};

const EXT_TO_MIME: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Object names we generate; also the only shape the local GET route will serve. */
export const OBJECT_NAME = /^(audio|image)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/;

export function mimeForName(name: string): string {
  return EXT_TO_MIME[name.split('.').pop() ?? ''] ?? 'application/octet-stream';
}

export function classify(mimeType: string): { kind: MediaKind; ext: string; base: string } | null {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  const hit = ALLOWED[base];
  return hit ? { ...hit, base } : null;
}

export type StoredMedia = {
  url: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  bytes: number;
  driver: 'supabase' | 'local';
  /** Set when Supabase was configured but failed, so the UI/logs can say why. */
  fallbackReason?: string;
};

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

// Only the origin is used: pasting the REST address (".../rest/v1/") from the
// dashboard instead of the bare project URL is an easy mistake, and any path on
// SUPABASE_URL would otherwise send Storage calls to the wrong service.
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
      file_size_limit: MAX_BYTES.audio,
      allowed_mime_types: [...new Set(Object.keys(ALLOWED))],
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Supabase answers 400 or 409 with "already exists" for a second create.
    if (!/already exists|Duplicate/i.test(detail)) {
      throw new Error(`supabase bucket ${res.status}: ${detail.slice(0, 200)}`);
    }
  }
  globalForStorage.__roshanBucketReady = true;
}

async function putSupabase(name: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  await ensureBucket();

  const res = await fetch(`${storageBase()}/object/${env.SUPABASE_BUCKET}/${name}`, {
    method: 'POST',
    headers: supabaseHeaders({ 'content-type': mimeType, 'x-upsert': 'false' }),
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`supabase upload ${res.status}: ${detail.slice(0, 200)}`);
  }
  return `${storageBase()}/object/public/${env.SUPABASE_BUCKET}/${name}`;
}

/** Best-effort delete, used by the integration check to clean up after itself. */
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

async function putLocal(name: string, bytes: Uint8Array): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), bytes);
  return `/api/upload/${name}`;
}

export async function readLocal(name: string): Promise<Buffer | null> {
  if (!OBJECT_NAME.test(name)) return null;
  try {
    return await readFile(join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function saveMedia(bytes: Uint8Array, mimeType: string): Promise<StoredMedia> {
  const meta = classify(mimeType);
  if (!meta) throw new RangeError(`Unsupported media type: ${mimeType}`);
  if (bytes.byteLength === 0) throw new RangeError('The file was empty.');
  if (bytes.byteLength > MAX_BYTES[meta.kind]) {
    throw new RangeError(`${meta.kind} files must be ${MAX_BYTES[meta.kind] / 1024 / 1024}MB or smaller.`);
  }

  const name = `${meta.kind}-${randomUUID()}.${meta.ext}`;
  const base = { name, kind: meta.kind, mimeType: meta.base, bytes: bytes.byteLength };

  if (hasSupabaseStorage()) {
    try {
      const url = await putSupabase(name, bytes, meta.base);
      return { ...base, url, driver: 'supabase' };
    } catch (err) {
      const reason = (err as Error).message;
      console.warn(`[storage] supabase failed, saving locally: ${reason}`);
      return { ...base, url: await putLocal(name, bytes), driver: 'local', fallbackReason: reason };
    }
  }

  return { ...base, url: await putLocal(name, bytes), driver: 'local' };
}
