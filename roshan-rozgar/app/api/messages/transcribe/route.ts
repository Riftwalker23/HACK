/**
 * One-call voice note: audio in, bilingual message row out (Outcome 3).
 *
 * This is the path the worker's phone uses. He holds a button, speaks Urdu,
 * releases — and one request transcribes, translates and posts the message, so
 * the slowest link (venue wifi) is crossed once instead of three times.
 *
 * Accepts multipart form-data (an audio File) or JSON with base64, because the
 * worker's client records a Blob while the demo scripts and the customer's
 * client find base64 easier.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { jobs, messages } from '@/db/schema';
import { transcribe } from '@/lib/ai';
import { ApiError, handle, ok, uuidParam } from '@/lib/http';
import { combineProviders, fillBothLanguages } from '@/lib/trust';

// No `runtime` / `dynamic` exports: next.config.ts sets `cacheComponents: true`,
// and Next 16 rejects both route segment configs outright under it. POST is
// never prerendered, so nothing is needed in their place here.

const TERMINAL_STATUSES = ['COMPLETED', 'DECLINED', 'CANCELLED'] as const;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // a voice note, not a podcast

const shared = {
  jobId: uuidParam,
  sender: z.enum(['worker', 'customer']),
  durationMs: z.coerce.number().int().nonnegative().optional(),
  /** Where the blob was stored, if the client uploaded it separately. */
  audioUrl: z.string().min(1).optional(),
  language: z.enum(['ur', 'en']).optional(),
};

const jsonBody = z.object({
  ...shared,
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1),
});

const formFields = z.object(shared);

type Parsed = {
  jobId: string;
  sender: 'worker' | 'customer';
  durationMs?: number;
  audioUrl?: string;
  language?: 'ur' | 'en';
  audio: Uint8Array;
  mimeType: string;
};

function invalid(error: z.ZodError): never {
  throw new ApiError('BAD_REQUEST', 'Invalid request.', z.treeifyError(error));
}

async function parseRequest(req: Request): Promise<Parsed> {
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ApiError('BAD_REQUEST', 'Could not read the form data.');
    }

    const file = form.get('audio');
    if (!(file instanceof File)) {
      throw new ApiError('BAD_REQUEST', 'Expected an `audio` file part.');
    }

    const raw = Object.fromEntries(
      [...form.entries()].filter(([, v]) => typeof v === 'string'),
    );
    const parsed = formFields.safeParse(raw);
    if (!parsed.success) invalid(parsed.error);

    const bytes = new Uint8Array(await file.arrayBuffer());
    return {
      ...parsed.data,
      audio: bytes,
      mimeType: file.type || 'audio/webm',
    };
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(
      'BAD_REQUEST',
      'Send multipart form-data with an `audio` file, or JSON with `audioBase64`.',
    );
  }
  const parsed = jsonBody.safeParse(raw);
  if (!parsed.success) invalid(parsed.error);

  // Tolerate a full data: URL — browsers produce them from FileReader.
  const base64 = parsed.data.audioBase64.replace(/^data:[^;]+;base64,/, '');
  const audio = new Uint8Array(Buffer.from(base64, 'base64'));
  if (audio.byteLength === 0) {
    throw new ApiError('BAD_REQUEST', '`audioBase64` did not decode to any audio.');
  }

  return {
    jobId: parsed.data.jobId,
    sender: parsed.data.sender,
    durationMs: parsed.data.durationMs,
    audioUrl: parsed.data.audioUrl,
    language: parsed.data.language,
    audio,
    mimeType: parsed.data.mimeType,
  };
}

export const POST = handle(async (req: Request) => {
  const input = await parseRequest(req);

  if (input.audio.byteLength > MAX_AUDIO_BYTES) {
    throw new ApiError('BAD_REQUEST', 'Audio is too long. Keep voice notes under about a minute.');
  }

  const database = await db();
  const [job] = await database
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, input.jobId))
    .limit(1);

  if (!job) throw new ApiError('NOT_FOUND', 'No such job.');
  if ((TERMINAL_STATUSES as readonly string[]).includes(job.status)) {
    throw new ApiError('CONFLICT', `This job is ${job.status.toLowerCase()}; its chat is closed.`, {
      status: job.status,
    });
  }

  const spoken = await transcribe({
    audio: input.audio,
    mimeType: input.mimeType,
    language: input.language ?? 'ur',
  });

  // The recogniser gives us one language; the row must hold both.
  const bilingual =
    input.language === 'en'
      ? await fillBothLanguages({ en: spoken.result.textUr })
      : await fillBothLanguages({ ur: spoken.result.textUr });

  const [row] = await database
    .insert(messages)
    .values({
      jobId: input.jobId,
      sender: input.sender,
      kind: 'voice',
      audioUrl: input.audioUrl ?? null,
      durationMs: input.durationMs ?? null,
      transcriptUr: bilingual.ur,
      transcriptEn: bilingual.en,
      aiProvider: combineProviders(spoken.meta.provider, bilingual.provider),
    })
    .returning();

  return ok(
    {
      message: row,
      transcription: {
        textUr: spoken.result.textUr,
        textRoman: spoken.result.textRoman,
        confidence: spoken.result.confidence,
      },
    },
    {
      // Row label is the weakest step; the per-step truth is here.
      provider: row.aiProvider,
      transcribeProvider: spoken.meta.provider,
      translateProvider: bilingual.provider,
      translated: bilingual.translated,
      ...(bilingual.error ? { translationError: bilingual.error } : {}),
      latencyMs: spoken.meta.latencyMs,
      bytes: input.audio.byteLength,
      serverTime: new Date().toISOString(),
    },
  );
});
