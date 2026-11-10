/**
 * Text-to-speech via ElevenLabs — reads the UI aloud to a worker who cannot read.
 *
 * Audio is cached on disk by (voice, model, text) hash. That is both a cost
 * control and a demo-reliability feature: a prompt rehearsed once replays
 * instantly and offline on the day, with no API call.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { env, hasElevenLabs } from '@/lib/env';

const TTS_DIR = process.env.TTS_CACHE_DIR ?? join('.data', 'tts');
const TIMEOUT_MS = 30_000;
const OUTPUT_FORMAT = 'mp3_44100_128';

export const MAX_SPEAK_CHARS = 500;

export class SpeechUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechUnavailable';
  }
}

export type SpokenAudio = {
  audio: Buffer;
  mimeType: 'audio/mpeg';
  cached: boolean;
  provider: 'elevenlabs';
  model: string;
  voiceId: string;
};

export async function speak(text: string, voiceId?: string): Promise<SpokenAudio> {
  if (!hasElevenLabs()) {
    throw new SpeechUnavailable('ELEVENLABS_API_KEY is not set; use the browser voice instead.');
  }

  const trimmed = text.trim();
  const voice = voiceId ?? env.ELEVENLABS_VOICE_ID;
  const model = env.ELEVENLABS_TTS_MODEL;

  const hash = createHash('sha256').update(`${voice}|${model}|${trimmed}`).digest('hex').slice(0, 32);
  const file = join(TTS_DIR, `${hash}.mp3`);

  try {
    const hit = await readFile(file);
    if (hit.byteLength > 0) {
      return { audio: hit, mimeType: 'audio/mpeg', cached: true, provider: 'elevenlabs', model, voiceId: voice };
    }
  } catch {
    // Not cached yet.
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY!,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({ text: trimmed, model_id: model }),
        signal: controller.signal,
      },
    );
  } catch (err) {
    throw new Error(
      controller.signal.aborted
        ? `elevenlabs tts timed out after ${TIMEOUT_MS}ms`
        : `elevenlabs tts request failed: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`elevenlabs tts ${response.status}: ${detail.slice(0, 300)}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.byteLength) throw new Error('elevenlabs tts returned empty audio');

  try {
    await mkdir(TTS_DIR, { recursive: true });
    await writeFile(file, audio);
  } catch (err) {
    console.warn('[tts] could not cache audio', err);
  }

  return { audio, mimeType: 'audio/mpeg', cached: false, provider: 'elevenlabs', model, voiceId: voice };
}
