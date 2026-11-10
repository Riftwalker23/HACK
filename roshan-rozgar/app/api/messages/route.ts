/**
 * Voice-note-first chat (Outcome 3).
 *
 * The invariant this route exists to hold: EVERY stored message row carries an
 * Urdu side and an English side. The worker speaks Urdu and reads Urdu; the
 * customer reads English off the same row. Remove the translation step and
 * these two users cannot agree on a job or a price at all.
 *
 * GET doubles as the realtime polling fallback — venue networks block
 * websockets (PROJECT.md §11), so the payload is kept tight and carries
 * `serverTime` for the client's next `?after=` cursor.
 */

import { and, asc, eq, gt } from 'drizzle-orm';
import { connection } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { jobs, messages } from '@/db/schema';
import { ApiError, body, handle, ok, query, uuidParam } from '@/lib/http';
import { combineProviders, fillBothLanguages } from '@/lib/trust';

// No `runtime` / `dynamic` exports: next.config.ts sets `cacheComponents: true`,
// and Next 16 rejects both route segment configs outright under it ("Route
// segment config ... is not compatible with nextConfig.cacheComponents").
// `connection()` on GET is the replacement for `dynamic = 'force-dynamic'`.

/** A finished or abandoned job's thread is closed. Writing to it would be a lie. */
const TERMINAL_STATUSES = ['COMPLETED', 'DECLINED', 'CANCELLED'] as const;

const sender = z.enum(['worker', 'customer']);

const voiceBody = z.object({
  jobId: uuidParam,
  sender,
  kind: z.literal('voice'),
  audioUrl: z.string().min(1),
  durationMs: z.coerce.number().int().nonnegative().optional(),
  transcriptUr: z.string().optional(),
  transcriptEn: z.string().optional(),
});

const writtenBody = z.object({
  jobId: uuidParam,
  sender,
  kind: z.enum(['text', 'chip']),
  text: z.string().min(1).max(2_000),
  language: z.enum(['ur', 'en']),
});

const postBody = z.discriminatedUnion('kind', [voiceBody, writtenBody]);

const getQuery = z.object({
  jobId: uuidParam,
  /** ISO timestamp cursor for the poll loop. */
  after: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), 'after must be an ISO timestamp')
    .optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

/** The thread must belong to a real, still-open job. */
async function openJob(database: Awaited<ReturnType<typeof db>>, jobId: string) {
  const [job] = await database
    .select({ id: jobs.id, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) throw new ApiError('NOT_FOUND', 'No such job.');
  if ((TERMINAL_STATUSES as readonly string[]).includes(job.status)) {
    throw new ApiError('CONFLICT', `This job is ${job.status.toLowerCase()}; its chat is closed.`, {
      status: job.status,
    });
  }
  return job;
}

export const POST = handle(async (req: Request) => {
  const input = await body(req, postBody);
  const database = await db();
  await openJob(database, input.jobId);

  // Whatever arrived, both sides get filled before the row is written.
  const bilingual =
    input.kind === 'voice'
      ? await fillBothLanguages({ ur: input.transcriptUr, en: input.transcriptEn })
      : await fillBothLanguages(
          input.language === 'ur' ? { ur: input.text } : { en: input.text },
        );

  const [row] = await database
    .insert(messages)
    .values({
      jobId: input.jobId,
      sender: input.sender,
      kind: input.kind,
      audioUrl: input.kind === 'voice' ? input.audioUrl : null,
      durationMs: input.kind === 'voice' ? (input.durationMs ?? null) : null,
      transcriptUr: bilingual.ur,
      transcriptEn: bilingual.en,
      aiProvider: combineProviders(bilingual.provider),
    })
    .returning();

  // Recognition happens in the browser (Web Speech API); the server never
  // fetches audio from a URL. An untranscribed voice note is playable but
  // unreadable, so tell the client to send the words it heard.
  const needsTranscript = input.kind === 'voice' && !row.transcriptUr && !row.transcriptEn;

  return ok(
    {
      message: row,
      needsTranscript,
      ...(needsTranscript
        ? {
            hint:
              'Voice note stored without text. Post the audio to /api/messages/transcribe, ' +
              'or re-send this message with transcriptUr from the browser recogniser — ' +
              'the server does not download audioUrl.',
          }
        : {}),
    },
    {
      provider: row.aiProvider,
      translated: bilingual.translated,
      ...(bilingual.error ? { translationError: bilingual.error } : {}),
      serverTime: new Date().toISOString(),
    },
  );
});

const getMessages = handle(async (req: Request) => {
  const { jobId, after, limit } = query(req, getQuery);
  const database = await db();

  const [job] = await database
    .select({ id: jobs.id, status: jobs.status, updatedAt: jobs.updatedAt })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) throw new ApiError('NOT_FOUND', 'No such job.');

  const cursor = after ? new Date(after) : null;

  const rows = await database
    .select({
      id: messages.id,
      sender: messages.sender,
      kind: messages.kind,
      audioUrl: messages.audioUrl,
      durationMs: messages.durationMs,
      transcriptUr: messages.transcriptUr,
      transcriptEn: messages.transcriptEn,
      aiProvider: messages.aiProvider,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(cursor ? and(eq(messages.jobId, jobId), gt(messages.createdAt, cursor)) : eq(messages.jobId, jobId))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  return ok(
    { jobId, messages: rows },
    {
      count: rows.length,
      // The poll loop sends this back as `after`, and watches jobStatus so it
      // knows when the booking moved on without a second request.
      serverTime: new Date().toISOString(),
      jobStatus: job.status,
      jobUpdatedAt: job.updatedAt.toISOString(),
      nextAfter: rows.length > 0 ? rows[rows.length - 1].createdAt.toISOString() : (after ?? null),
    },
  );
});

export async function GET(req: Request) {
  // Called OUTSIDE handle() on purpose. Under cacheComponents a GET handler
  // leaves prerendering by throwing, and handle()'s catch-all would turn that
  // bail-out into a prerendered 500 envelope. A live chat thread is never static.
  await connection();
  return getMessages(req);
}
