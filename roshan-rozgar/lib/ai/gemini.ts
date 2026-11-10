/**
 * Gemini provider — the same reasoning, extraction, classification, translation
 * and summarisation job as the Claude provider.
 *
 * NOT speech-to-text, deliberately. Tested on this project: given a 0.25s tone
 * with no speech in it, Gemini returned a complete, plausible Urdu customer
 * request ("geyser service in G-9, and check the AC gas too") built from the
 * domain words in its prompt. A dedicated speech model (ElevenLabs Scribe)
 * correctly returned nothing. An invented transcript labelled as real AI is the
 * worst possible failure here, so speech stays with the dedicated models.
 *
 * Prompts and JSON schemas are shared with Claude (./prompts.ts); only the
 * transport differs. Structured output works the same way in spirit: the request
 * asks for `application/json` constrained by a JSON Schema, and the reply is then
 * validated with the zod contract from ./types.ts. A reply that fails validation
 * throws, the dispatcher catches it and falls through to the next provider (and
 * finally the labelled stub) rather than returning malformed data.
 *
 * Plain `fetch` against the Generative Language REST API; no SDK dependency.
 * The key goes in the `x-goog-api-key` header, never in the URL, so it cannot
 * end up in a request log.
 */

import type { ZodType } from 'zod';

import { env, hasGemini } from '@/lib/env';
import {
  CLASSIFICATION_SCHEMA,
  PHOTO_SCHEMA,
  PHOTO_USER,
  PRICE_SCHEMA,
  PRICE_SYSTEM,
  PROFILE_SCHEMA,
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  TRANSLATION_SCHEMA,
  classifySystem,
  classifyUser,
  photoSystem,
  priceUser,
  profileSystem,
  profileUser,
  reviewUser,
  translateSystem,
  type JsonSchema,
} from './prompts';
import {
  extractedPrice,
  extractedProfile,
  photoTags,
  problemClassification,
  reviewSummary,
  translation,
  type AiProvider,
  type AiResult,
  type ClassifyProblemInput,
  type ExtractedPrice,
  type ExtractedProfile,
  type PhotoTags,
  type ProblemClassification,
  type ReviewSummary,
  type SummariseReviewsInput,
  type TagPhotoInput,
  type TranslateInput,
  type Translation,
} from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT_MS = 30_000;

// Thinking tokens count against maxOutputTokens on Gemini 2.5+/3 models, so the
// budgets are generous: a reply cut off mid-JSON is worse than a slow one.
const MAX_TOKENS = 4096;
const MAX_TOKENS_PROFILE = 8192;

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type GenerateOptions = {
  system: string;
  parts: Part[];
  /** When set, the reply is constrained to this JSON Schema. */
  schema?: JsonSchema;
  maxOutputTokens: number;
};

async function post(model: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

// ---------------------------------------------------------------------------
// Model chain
//
// Free-tier quota is counted per model per day, and is small. GEMINI_MODEL is
// therefore a list: when one model is out of quota (429) or retired (404) the
// call moves to the next, and the dead model is benched for a while so later
// calls do not pay a wasted round trip to rediscover it.
// ---------------------------------------------------------------------------

export const geminiModels = (): string[] =>
  env.GEMINI_MODEL.split(',').map((m) => m.trim()).filter(Boolean);

const globalForGemini = globalThis as unknown as { __roshanGeminiBench?: Map<string, number> };
const bench = (globalForGemini.__roshanGeminiBench ??= new Map<string, number>());

const PER_DAY_BENCH_MS = 60 * 60 * 1000; // daily quota: retry in an hour
const PER_MINUTE_BENCH_MS = 60 * 1000; // per-minute quota: retry in a minute
const RETIRED_BENCH_MS = 24 * 60 * 60 * 1000; // 404: model is gone

function benched(model: string): boolean {
  const until = bench.get(model);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    bench.delete(model);
    return false;
  }
  return true;
}

/** Errors that mean "this model cannot serve us right now; try the next one". */
class ModelUnavailable extends Error {}

/** One request against one model, returning the raw response body. */
async function requestModel(model: string, body: unknown): Promise<GeminiResponse> {
  let res: Response;
  try {
    res = await post(model, body);
    if (res.status === 503) {
      // Overloaded is transient: one short retry on the same model.
      await new Promise((r) => setTimeout(r, 700));
      res = await post(model, body);
    }
  } catch (err) {
    const timedOut = (err as Error).name === 'TimeoutError' || (err as Error).name === 'AbortError';
    throw new ModelUnavailable(
      timedOut ? `${model} timed out after ${TIMEOUT_MS}ms` : `${model} request failed: ${(err as Error).message}`,
    );
  }

  if (res.status === 429 || res.status === 404) {
    const detail = await res.text().catch(() => '');
    const perDay = /PerDay/i.test(detail);
    bench.set(
      model,
      Date.now() + (res.status === 404 ? RETIRED_BENCH_MS : perDay ? PER_DAY_BENCH_MS : PER_MINUTE_BENCH_MS),
    );
    throw new ModelUnavailable(
      res.status === 404 ? `${model} not found (retired?)` : `${model} out of ${perDay ? 'daily' : 'per-minute'} quota`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`gemini ${model} ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as GeminiResponse;
}

/** One logical request, one text reply, walking the model chain. */
async function generate(options: GenerateOptions): Promise<{ text: string; model: string }> {
  const body = {
    systemInstruction: { parts: [{ text: options.system }] },
    contents: [{ role: 'user', parts: options.parts }],
    generationConfig: {
      // Extraction and translation, not creative writing: stay close to the input.
      temperature: 0.2,
      maxOutputTokens: options.maxOutputTokens,
      ...(options.schema
        ? { responseMimeType: 'application/json', responseJsonSchema: options.schema }
        : {}),
      ...(env.GEMINI_THINKING_LEVEL
        ? { thinkingConfig: { thinkingLevel: env.GEMINI_THINKING_LEVEL } }
        : {}),
    },
  };

  const chain = geminiModels();
  const live = chain.filter((m) => !benched(m));
  if (!live.length) {
    throw new Error(`every Gemini model is out of quota or unavailable right now (${chain.join(', ')})`);
  }

  const skipped: string[] = [];
  let payload: GeminiResponse | null = null;
  let model = live[0]!;
  for (const candidateModel of live) {
    try {
      payload = await requestModel(candidateModel, body);
      model = candidateModel;
      break;
    } catch (err) {
      if (!(err instanceof ModelUnavailable)) throw err;
      skipped.push(err.message);
    }
  }
  if (!payload) throw new Error(`no Gemini model could answer: ${skipped.join('; ')}`);
  if (skipped.length) console.warn(`[ai] gemini fell through to ${model}: ${skipped.join('; ')}`);

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`gemini blocked the prompt: ${payload.promptFeedback.blockReason}`);
  }

  const candidate = payload.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('gemini reply hit maxOutputTokens before it finished');
  }

  // Skip "thought" parts: they are the model's reasoning, not the answer.
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();

  if (!text) {
    throw new Error(`gemini returned no text (finishReason ${candidate?.finishReason ?? 'unknown'})`);
  }
  return { text, model };
}

/** A schema-constrained reply, parsed and validated with the zod contract. */
async function generateJson<T>(
  name: string,
  validator: ZodType<T>,
  options: GenerateOptions & { schema: JsonSchema },
): Promise<AiResult<T>> {
  const started = Date.now();
  const { text, model } = await generate(options);

  let raw: unknown;
  try {
    // Models occasionally wrap JSON in a code fence even when told not to.
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error(`gemini ${name} reply was not valid JSON`);
  }

  const parsed = validator.safeParse(raw);
  if (!parsed.success) {
    // Better to show the judges a labelled stub answer than a malformed one.
    throw new Error(
      `gemini ${name} output failed validation: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }

  return {
    result: parsed.data,
    meta: { provider: 'gemini', model, latencyMs: Date.now() - started, cached: false },
  };
}

const image = (base64: string, mimeType: string): Part => ({
  inlineData: { mimeType, data: base64 },
});

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

async function extractProfile(transcript: string): Promise<AiResult<ExtractedProfile>> {
  const { allowedTrades } = await import('@/data/trades');
  return generateJson('extractProfile', extractedProfile, {
    system: profileSystem(allowedTrades()),
    parts: [{ text: profileUser(transcript) }],
    schema: PROFILE_SCHEMA,
    maxOutputTokens: MAX_TOKENS_PROFILE,
  });
}

async function tagPhoto(input: TagPhotoInput): Promise<AiResult<PhotoTags>> {
  return generateJson('tagPhoto', photoTags, {
    system: photoSystem(input.allowedTrades),
    parts: [image(input.imageBase64, input.imageMimeType), { text: PHOTO_USER }],
    schema: PHOTO_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
  });
}

async function classifyProblem(
  input: ClassifyProblemInput,
): Promise<AiResult<ProblemClassification>> {
  const parts: Part[] = [];
  if (input.imageBase64 && input.imageMimeType) {
    parts.push(image(input.imageBase64, input.imageMimeType));
  }
  parts.push({ text: classifyUser(input) });

  return generateJson('classifyProblem', problemClassification, {
    system: classifySystem(input.allowedTrades),
    parts,
    schema: CLASSIFICATION_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
  });
}

async function translate(input: TranslateInput): Promise<AiResult<Translation>> {
  return generateJson('translate', translation, {
    system: translateSystem(input),
    parts: [{ text: input.text }],
    schema: TRANSLATION_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
  });
}

async function extractPrice(transcript: string): Promise<AiResult<ExtractedPrice>> {
  return generateJson('extractPrice', extractedPrice, {
    system: PRICE_SYSTEM,
    parts: [{ text: priceUser(transcript) }],
    schema: PRICE_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
  });
}

async function summariseReviews(
  input: SummariseReviewsInput,
): Promise<AiResult<ReviewSummary>> {
  return generateJson('summariseReviews', reviewSummary, {
    system: REVIEW_SYSTEM,
    parts: [{ text: reviewUser(input) }],
    schema: REVIEW_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const provider: AiProvider = {
  name: 'gemini',
  available: hasGemini(),
  // `transcribe` is deliberately absent; see the header comment.
  extractProfile,
  tagPhoto,
  classifyProblem,
  translate,
  extractPrice,
  summariseReviews,
};

export default provider;
