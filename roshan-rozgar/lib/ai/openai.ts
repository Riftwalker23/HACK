/**
 * Whisper provider — Urdu speech-to-text ONLY.
 *
 * This is the capability the whole product stands on: the worker may not be
 * able to read or type, so if this fails there is no other input path he can
 * use (PROJECT.md §2.1, row 1). It therefore leads the `transcribe` chain in
 * lib/ai/index.ts and falls back to the stub rather than to an error.
 *
 * Deliberately implemented with plain `fetch` + FormData against the audio
 * endpoint instead of the `openai` npm package: the package is not installed,
 * and one multipart POST does not justify a dependency.
 */

import { env, hasOpenAI } from '@/lib/env';
import {
  transcription,
  type AiProvider,
  type AiResult,
  type TranscribeInput,
  type Transcription,
} from './types';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const TIMEOUT_MS = 25_000;

import { toRomanUrdu } from './roman';
export { toRomanUrdu };

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

/** Whisper rejects an upload whose filename has no recognised extension. */
function filenameFor(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  return `audio.${EXTENSIONS[base] ?? 'webm'}`;
}

type VerboseSegment = { avg_logprob?: number; no_speech_prob?: number };
type WhisperResponse = { text?: string; segments?: VerboseSegment[] };

/**
 * Whisper returns no confidence field. `verbose_json` does return per-segment
 * log-probabilities, so the geometric mean of exp(avg_logprob) is a real (if
 * rough) confidence rather than a made-up constant. Urdu audio recorded on a
 * phone at a street corner genuinely is low-confidence sometimes, and the UI
 * uses this to decide whether to ask the worker to repeat himself.
 */
function estimateConfidence(segments: VerboseSegment[] | undefined): number {
  const usable = (segments ?? []).filter((s) => typeof s.avg_logprob === 'number');
  if (!usable.length) return 0.7;

  const total = usable.reduce((sum, s) => {
    const spoken = 1 - Math.min(1, Math.max(0, s.no_speech_prob ?? 0));
    return sum + Math.exp(s.avg_logprob!) * spoken;
  }, 0);

  return Math.min(1, Math.max(0, total / usable.length));
}

async function transcribe(input: TranscribeInput): Promise<AiResult<Transcription>> {
  const started = Date.now();
  const model = env.OPENAI_STT_MODEL;

  // Copied into a plain ArrayBuffer because a Uint8Array may be backed by a
  // SharedArrayBuffer, which is not a valid BlobPart.
  const buffer = new ArrayBuffer(input.audio.byteLength);
  new Uint8Array(buffer).set(input.audio);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: input.mimeType }), filenameFor(input.mimeType));
  form.append('model', model);
  // Ask for Urdu explicitly: auto-detection confuses Urdu with Hindi and
  // Persian, and a Hindi-script transcript is useless to every downstream step.
  form.append('language', input.language ?? 'ur');
  form.append(
    'prompt',
    'Pakistani trade worker speaking Urdu about electrical, plumbing, AC, carpentry, mechanic, painting or masonry work, areas of Islamabad and Rawalpindi, and prices in rupees.',
  );
  // Only the whisper-* family supports verbose_json; the newer transcription
  // models reject it, so ask for segments only when they are available.
  form.append('response_format', model.startsWith('whisper') ? 'verbose_json' : 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      controller.signal.aborted
        ? `whisper timed out after ${TIMEOUT_MS}ms`
        : `whisper request failed: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`whisper ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as WhisperResponse;
  const textUr = (payload.text ?? '').trim();
  if (!textUr) throw new Error('whisper returned an empty transcript');

  const result = transcription.parse({
    textUr,
    textRoman: toRomanUrdu(textUr),
    confidence: estimateConfidence(payload.segments),
  });

  return {
    result,
    meta: { provider: 'openai', model, latencyMs: Date.now() - started, cached: false },
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const provider: AiProvider = {
  name: 'openai',
  available: hasOpenAI(),

  // Speech only. Every other capability is deliberately absent so the
  // dispatcher routes it to Claude, then to the stub.
  transcribe,
};

export default provider;
