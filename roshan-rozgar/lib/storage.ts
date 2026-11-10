/**
 * Media storage layer with Supabase Storage and local disk fallback.
 *
 * Requirements:
 * - Stores audio (webm/mp4/wav, max 5 MB) and images (jpeg/png/webp, max 5 MB).
 * - When SUPABASE_URL and SUPABASE_SERVICE_KEY are set -> upload to Supabase Storage.
 * - Else -> write to .data/uploads and serve via GET /api/upload/[name].
 * - Returns { url, kind, bytes }.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { env, hasSupabaseStorage } from '@/lib/env';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB

export type MediaKind = 'audio' | 'image';

export type StoredMedia = {
  url: string;
  kind: MediaKind;
  bytes: number;
};

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'mp4',
  'audio/m4a': 'mp4',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
};

export const LOCAL_UPLOADS_DIR = join(process.cwd(), '.data', 'uploads');

export function detectMediaKind(mimeType: string): { kind: MediaKind; extension: string } | null {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  if (base in ALLOWED_IMAGE_TYPES) {
    return { kind: 'image', extension: ALLOWED_IMAGE_TYPES[base]! };
  }
  if (base in ALLOWED_AUDIO_TYPES) {
    return { kind: 'audio', extension: ALLOWED_AUDIO_TYPES[base]! };
  }
  return null;
}

/**
 * Upload a media buffer to Supabase Storage or write to local disk.
 */
export async function storeMedia(
  buffer: Buffer | Uint8Array,
  mimeType: string,
  preferredName?: string,
): Promise<StoredMedia> {
  const bytes = buffer.byteLength;
  if (bytes > MAX_MEDIA_BYTES) {
    throw new Error(`File size (${(bytes / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of 5MB.`);
  }

  const detected = detectMediaKind(mimeType);
  if (!detected) {
    throw new Error(
      `Unsupported media type "${mimeType}". Allowed audio: webm, mp4, wav. Allowed images: jpeg, png, webp.`,
    );
  }

  const { kind, extension } = detected;
  const id = randomUUID();
  const safeName = preferredName
    ? `${id}-${preferredName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    : `${id}.${extension}`;

  if (hasSupabaseStorage()) {
    return uploadToSupabase({ buffer, mimeType, safeName, kind, bytes });
  }

  return saveToLocalDisk({ buffer, safeName, kind, bytes });
}

async function uploadToSupabase({
  buffer,
  mimeType,
  safeName,
  kind,
  bytes,
}: {
  buffer: Buffer | Uint8Array;
  mimeType: string;
  safeName: string;
  kind: MediaKind;
  bytes: number;
}): Promise<StoredMedia> {
  const supabaseUrl = env.SUPABASE_URL!.replace(/\/$/, '');
  const bucket = env.SUPABASE_BUCKET;
  const filePath = `${kind}s/${safeName}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Supabase Storage upload failed (${res.status}): ${errorText.slice(0, 300)}`);
  }

  // Public URL for Supabase storage objects:
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${filePath}`;
  return {
    url: publicUrl,
    kind,
    bytes,
  };
}

async function saveToLocalDisk({
  buffer,
  safeName,
  kind,
  bytes,
}: {
  buffer: Buffer | Uint8Array;
  safeName: string;
  kind: MediaKind;
  bytes: number;
}): Promise<StoredMedia> {
  await mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
  const filePath = join(LOCAL_UPLOADS_DIR, safeName);
  await writeFile(filePath, buffer);

  return {
    url: `/api/upload/${safeName}`,
    kind,
    bytes,
  };
}

/**
 * Retrieve a locally stored upload file. Returns null if missing or invalid.
 */
export async function getLocalUpload(name: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  size: number;
} | null> {
  // Prevent path traversal
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name.includes('..')) {
    return null;
  }

  const filePath = join(LOCAL_UPLOADS_DIR, name);
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return null;

    const buffer = await readFile(filePath);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    let mimeType = 'application/octet-stream';
    for (const [mime, extension] of Object.entries(ALLOWED_IMAGE_TYPES)) {
      if (extension === ext) {
        mimeType = mime;
        break;
      }
    }
    for (const [mime, extension] of Object.entries(ALLOWED_AUDIO_TYPES)) {
      if (extension === ext) {
        mimeType = mime;
        break;
      }
    }

    return { buffer, mimeType, size: fileStat.size };
  } catch {
    return null;
  }
}
