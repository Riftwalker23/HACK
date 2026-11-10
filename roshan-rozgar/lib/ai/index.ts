/**
 * AI dispatcher.
 *
 * One entry point per capability. Each call walks an ordered provider chain and
 * falls through on failure, ending at the deterministic stub so an endpoint
 * NEVER returns an error just because a key is missing or venue wifi died.
 *
 * Every result carries `meta.provider`. The UI reads that label and shows an
 * "AI" chip for real providers and a "demo data" chip for 'stub'. The brief
 * penalises presenting mocked functionality as working, so this label is not
 * cosmetic — it is the disclosure mechanism.
 *
 * Providers are loaded with dynamic import and a try/catch so that a provider
 * module which fails to construct (bad key, missing dep) degrades instead of
 * taking down the route.
 */

import { allowedTrades } from '@/data/trades';
import { cacheKey, getCached, setCached } from './cache';
import {
  type AiProvider,
  type AiResult,
  type Capability,
  type ClassifyProblemInput,
  type ExtractedPrice,
  type ExtractedProfile,
  type PhotoTags,
  type ProblemClassification,
  type SummariseReviewsInput,
  type TagPhotoInput,
  type TranscribeInput,
  type Transcription,
  type TranslateInput,
  type Translation,
  type ReviewSummary,
} from './types';

const globalForAi = globalThis as unknown as { __roshanProviders?: AiProvider[] };

async function loadProviders(): Promise<AiProvider[]> {
  if (globalForAi.__roshanProviders) return globalForAi.__roshanProviders;

  const loaded: AiProvider[] = [];

  for (const mod of ['./anthropic', './openai', './stub'] as const) {
    try {
      const m = (await import(mod)) as { provider?: AiProvider; default?: AiProvider };
      const p = m.provider ?? m.default;
      if (p) loaded.push(p);
    } catch (err) {
      console.warn(`[ai] provider ${mod} unavailable:`, (err as Error)?.message);
    }
  }

  globalForAi.__roshanProviders = loaded;
  return loaded;
}

/**
 * Provider preference per capability.
 * Whisper leads on speech; Claude leads on everything textual and visual.
 */
const PREFERENCE: Record<Capability, Array<AiProvider['name']>> = {
  transcribe: ['openai', 'anthropic', 'stub'],
  extractProfile: ['anthropic', 'openai', 'stub'],
  tagPhoto: ['anthropic', 'openai', 'stub'],
  classifyProblem: ['anthropic', 'openai', 'stub'],
  translate: ['anthropic', 'openai', 'stub'],
  extractPrice: ['anthropic', 'openai', 'stub'],
  summariseReviews: ['anthropic', 'openai', 'stub'],
};

async function dispatch<T>(
  capability: Capability,
  input: unknown,
  invoke: (p: AiProvider) => Promise<AiResult<T>> | undefined,
): Promise<AiResult<T>> {
  const key = cacheKey(capability, input);
  const hit = await getCached<T>(key);
  if (hit) return { result: hit.value, meta: hit.meta };

  const providers = await loadProviders();
  const order = PREFERENCE[capability];
  const chain = [...providers].sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name),
  );

  const reasons: string[] = [];

  for (const provider of chain) {
    if (!provider.available) continue;
    const call = invoke(provider);
    if (!call) continue;

    const started = Date.now();
    try {
      const out = await call;
      const meta = {
        ...out.meta,
        provider: out.meta.provider ?? provider.name,
        latencyMs: out.meta.latencyMs ?? Date.now() - started,
        cached: false,
        ...(reasons.length ? { fallbackReason: reasons.join('; ') } : {}),
      };
      // Only cache real answers; stubs are cheap and deterministic already.
      if (meta.provider !== 'stub') await setCached(key, out.result, meta);
      return { result: out.result, meta };
    } catch (err) {
      const reason = `${provider.name}: ${(err as Error)?.message ?? 'failed'}`;
      console.warn(`[ai] ${capability} ${reason}`);
      reasons.push(reason);
    }
  }

  throw new Error(
    `No AI provider could serve ${capability}. Tried: ${chain.map((p) => p.name).join(', ')}. ${reasons.join('; ')}`,
  );
}

// ---------------------------------------------------------------------------
// Public API — one function per barrier in PROJECT.md §2.1
// ---------------------------------------------------------------------------

/** Literacy barrier. Without this the worker cannot onboard at all. */
export function transcribe(input: TranscribeInput): Promise<AiResult<Transcription>> {
  return dispatch('transcribe', { mime: input.mimeType, audio: input.audio, lang: input.language }, (p) =>
    p.transcribe?.(input),
  );
}

/** Without this, raw audio never becomes a searchable profile. */
export function extractProfile(transcript: string): Promise<AiResult<ExtractedProfile>> {
  return dispatch('extractProfile', { transcript }, (p) => p.extractProfile?.(transcript));
}

/** Without this, work photos are decoration instead of evidence of skill. */
export function tagPhoto(input: Omit<TagPhotoInput, 'allowedTrades'>): Promise<AiResult<PhotoTags>> {
  const full: TagPhotoInput = {
    ...input,
    allowedTrades: allowedTrades().map(({ slug, nameEn }) => ({ slug, nameEn })),
  };
  return dispatch('tagPhoto', { mime: full.imageMimeType, image: full.imageBase64.slice(0, 64), len: full.imageBase64.length }, (p) =>
    p.tagPhoto?.(full),
  );
}

/** Without this, the customer must diagnose her own fault before asking. */
export function classifyProblem(
  input: Omit<ClassifyProblemInput, 'allowedTrades'>,
): Promise<AiResult<ProblemClassification>> {
  const full: ClassifyProblemInput = { ...input, allowedTrades: allowedTrades() };
  return dispatch(
    'classifyProblem',
    { text: full.text, image: full.imageBase64?.slice(0, 64), len: full.imageBase64?.length },
    (p) => p.classifyProblem?.(full),
  );
}

/** Without this, the worker and the customer cannot negotiate. */
export function translate(input: TranslateInput): Promise<AiResult<Translation>> {
  return dispatch('translate', input, (p) => p.translate?.(input));
}

/** Without this, there is no record of the price that was agreed out loud. */
export function extractPrice(transcript: string): Promise<AiResult<ExtractedPrice>> {
  return dispatch('extractPrice', { transcript }, (p) => p.extractPrice?.(transcript));
}

/** Without this, the next customer is back to asking a neighbour. */
export function summariseReviews(
  input: SummariseReviewsInput,
): Promise<AiResult<ReviewSummary>> {
  return dispatch('summariseReviews', input, (p) => p.summariseReviews?.(input));
}

/** Which providers are live right now — surfaced at GET /api/health. */
export async function providerStatus() {
  const providers = await loadProviders();
  return providers.map((p) => ({ name: p.name, available: p.available }));
}

export * from './types';
