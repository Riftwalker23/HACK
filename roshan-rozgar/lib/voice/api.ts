'use client';

/**
 * Voice and media helpers over the backend (TEAM-SPLIT.md §3, §4).
 *
 * Every helper throws an Error whose message is the server's own
 * `error.message`, so screens can show (and speak) exactly what went wrong.
 * Blobs are always sent with a filename: the backend checks that the audio part
 * is a File, and a bare Blob in FormData arrives without one.
 */

type Envelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function filenameFor(blob: Blob, base: string): string {
  const mime = (blob.type || '').split(';')[0]!.trim().toLowerCase();
  return `${base}.${EXTENSIONS[mime] ?? 'bin'}`;
}

async function postForm<T>(url: string, form: FormData): Promise<{ data: T; meta?: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach the server. Check the connection and try again.');
  }
  let payload: Envelope<T> | null = null;
  try {
    payload = (await res.json()) as Envelope<T>;
  } catch {
    /* non-JSON error page */
  }
  if (!payload) throw new Error(`Request failed (${res.status}).`);
  if (!res.ok || !payload.ok) {
    throw new Error(payload.ok ? `Request failed (${res.status}).` : payload.error.message);
  }
  return { data: payload.data, meta: payload.meta };
}

/** POST /api/upload — store a voice note or photo; returns its URL. */
export async function uploadMedia(
  blob: Blob,
  filename?: string,
): Promise<{ url: string; kind: 'audio' | 'image'; bytes: number }> {
  const form = new FormData();
  form.append('file', blob, filename ?? filenameFor(blob, 'upload'));
  const { data } = await postForm<{ url: string; kind: 'audio' | 'image'; bytes: number }>('/api/upload', form);
  return { url: data.url, kind: data.kind, bytes: data.bytes };
}

/**
 * POST /api/ai/transcribe — speech to text. `provider` is the honest label of
 * who produced the words ('elevenlabs', 'openai', … or 'stub' for demo data).
 */
export async function transcribeBlob(
  blob: Blob,
  language?: 'ur' | 'en',
): Promise<{ textUr: string; textRoman: string; confidence: number; provider: string }> {
  const form = new FormData();
  form.append('audio', blob, filenameFor(blob, 'speech'));
  if (language) form.append('language', language);
  const { data, meta } = await postForm<{ textUr: string; textRoman: string; confidence: number }>(
    '/api/ai/transcribe',
    form,
  );
  const ai = (meta?.ai ?? {}) as { provider?: string };
  return { ...data, provider: ai.provider ?? 'unknown' };
}

/**
 * POST /api/messages/transcribe — one call: audio -> transcript -> translation
 * -> a stored chat message carrying BOTH the Urdu and English text.
 * Returns the stored message row.
 */
export async function sendVoiceMessage(args: {
  blob: Blob;
  jobId: string;
  sender: 'worker' | 'customer';
  durationMs: number;
  language?: 'ur' | 'en';
}): Promise<unknown> {
  const form = new FormData();
  form.append('audio', args.blob, filenameFor(args.blob, 'voice-note'));
  form.append('jobId', args.jobId);
  form.append('sender', args.sender);
  form.append('durationMs', String(Math.max(0, Math.round(args.durationMs))));
  if (args.language) form.append('language', args.language);
  const { data } = await postForm<{ message: unknown }>('/api/messages/transcribe', form);
  return data.message;
}
