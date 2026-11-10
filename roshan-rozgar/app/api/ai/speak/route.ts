/**
 * /api/ai/speak — text to speech (ElevenLabs), returned as audio/mpeg.
 *
 *   GET  /api/ai/speak?text=...   so an <audio src> or `new Audio(url)` just works
 *   POST /api/ai/speak            { text, voiceId? }
 *
 * Reading the UI aloud is how a worker who cannot read uses the product. When
 * no ElevenLabs key is configured this answers 502 with a clear message and the
 * frontend falls back to the browser's SpeechSynthesis — it never plays silence.
 * Responses carry `x-ai-provider` and `x-ai-cached` so the label stays honest.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { MAX_SPEAK_CHARS, SpeechUnavailable, speak } from '@/lib/ai/speech';
import { ApiError, body, handle, query } from '@/lib/http';

const text = z.string().trim().min(1).max(MAX_SPEAK_CHARS);
const voiceId = z.string().regex(/^[A-Za-z0-9]{10,40}$/, 'Invalid voice id.').optional();

const postBody = z.object({ text, voiceId });
const getQuery = z.object({ text, voiceId });

async function respond(input: { text: string; voiceId?: string }) {
  try {
    const spoken = await speak(input.text, input.voiceId);
    return new NextResponse(new Uint8Array(spoken.audio), {
      headers: {
        'content-type': spoken.mimeType,
        'content-length': String(spoken.audio.byteLength),
        'cache-control': 'private, max-age=86400',
        'x-ai-provider': spoken.provider,
        'x-ai-model': spoken.model,
        'x-ai-cached': String(spoken.cached),
      },
    });
  } catch (err) {
    if (err instanceof SpeechUnavailable) {
      throw new ApiError('UPSTREAM_AI_ERROR', err.message, { fallback: 'browser-speech-synthesis' });
    }
    throw new ApiError('UPSTREAM_AI_ERROR', (err as Error).message, {
      fallback: 'browser-speech-synthesis',
    });
  }
}

export const POST = handle(async (req: Request) => respond(await body(req, postBody)));

export const GET = handle(async (req: Request) => respond(query(req, getQuery)));
