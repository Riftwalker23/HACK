/**
 * ElevenLabs provider — Scribe speech-to-text.
 *
 * Speech only, like the Whisper provider: every other capability is left
 * undefined so the dispatcher routes it to Claude and then to the stub. It leads
 * the `transcribe` chain in lib/ai/index.ts and Whisper is the fallback, so a
 * dead key or a venue-wifi timeout degrades to the next provider, never to an
 * error.
 *
 * Plain `fetch` + FormData, no SDK: one multipart POST does not justify a
 * dependency (same reasoning as lib/ai/openai.ts).
 *
 * Text-to-speech is NOT a provider capability. It produces audio rather than
 * structured data, so it lives in lib/ai/speech.ts behind /api/ai/speak.
 */

import { env, hasElevenLabs } from '@/lib/env';
import { toRomanUrdu } from './roman';
import {
  transcription,
  type AiProvider,
  type AiResult,
  type TranscribeInput,
  type Transcription,
} from './types';

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const TIMEOUT_MS = 30_000;

/** Scribe takes ISO 639-3 codes; 'urd' is Urdu. */
const LANGUAGE_CODES = { ur: 'urd', en: 'eng' } as const;

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

function filenameFor(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  return `audio.${EXTENSIONS[base] ?? 'webm'}`;
}

type ScribeWord = { text?: string; type?: string; logprob?: number };
type ScribeResponse = {
  text?: string;
  language_code?: string;
  language_probability?: number;
  words?: ScribeWord[];
};

/**
 * Scribe reports a log-probability per word, so the mean of exp(logprob) is a
 * real confidence rather than a constant. Falls back to the language-detection
 * probability, then to a neutral 0.7, when no word scores are returned.
 */
function estimateConfidence(payload: ScribeResponse): number {
  const scored = (payload.words ?? []).filter(
    (w) => w.type === 'word' && typeof w.logprob === 'number',
  );
  if (scored.length) {
    const mean = scored.reduce((sum, w) => sum + Math.exp(w.logprob!), 0) / scored.length;
    return Math.min(1, Math.max(0, mean));
  }
  if (typeof payload.language_probability === 'number') {
    return Math.min(1, Math.max(0, payload.language_probability));
  }
  return 0.7;
}

async function transcribe(input: TranscribeInput): Promise<AiResult<Transcription>> {
  const started = Date.now();
  const model = env.ELEVENLABS_STT_MODEL;

  // Plain ArrayBuffer copy: a Uint8Array may sit on a SharedArrayBuffer, which
  // is not a valid BlobPart.
  const buffer = new ArrayBuffer(input.audio.byteLength);
  new Uint8Array(buffer).set(input.audio);

  const form = new FormData();
  form.append('model_id', model);
  form.append('file', new Blob([buffer], { type: input.mimeType }), filenameFor(input.mimeType));
  // Pin the language: auto-detection confuses Urdu with Hindi and Persian, and
  // a transcript in the wrong script is useless to every downstream step.
  form.append('language_code', LANGUAGE_CODES[input.language ?? 'ur']);
  // Speech only: we do not want "(laughter)" style annotations in a profile.
  form.append('tag_audio_events', 'false');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY! },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      controller.signal.aborted
        ? `elevenlabs scribe timed out after ${TIMEOUT_MS}ms`
        : `elevenlabs scribe request failed: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`elevenlabs scribe ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as ScribeResponse;
  const textUr = (payload.text ?? '').trim();
  if (!textUr) throw new Error('elevenlabs scribe returned an empty transcript');

  const result = transcription.parse({
    textUr,
    textRoman: toRomanUrdu(textUr),
    confidence: estimateConfidence(payload),
  });

  return {
    result,
    meta: { provider: 'elevenlabs', model, latencyMs: Date.now() - started, cached: false },
  };
}

export const provider: AiProvider = {
  name: 'elevenlabs',
  available: hasElevenLabs(),
  transcribe,
};

export default provider;
