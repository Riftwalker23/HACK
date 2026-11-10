/**
 * The AI contract — one capability per barrier named in the brief.
 *
 * Every result carries `meta.provider`, so the UI can label what a model
 * produced and the README can state exactly what was real during the demo.
 * `provider: 'stub'` means a deterministic offline fallback answered. Never
 * present a stubbed result as a live model result.
 *
 * PROJECT.md §2.1 is the "what breaks without this" table. Keep them in sync.
 */

import { z } from 'zod';

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'stub';

export const aiMeta = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'stub']),
  model: z.string().optional(),
  latencyMs: z.number().int().nonnegative(),
  cached: z.boolean().default(false),
  /** Set when a real provider was tried and failed before falling back. */
  fallbackReason: z.string().optional(),
});
export type AiMeta = z.infer<typeof aiMeta>;

/** Wrapper for every AI result. */
export type AiResult<T> = { result: T; meta: AiMeta };

// ---------------------------------------------------------------------------
// 1. Urdu speech-to-text — removes the literacy barrier (Outcome 1, 3, 5)
// ---------------------------------------------------------------------------

export const transcription = z.object({
  textUr: z.string(),
  /** Roman Urdu, for fuzzy matching and for the Roman UI mode. */
  textRoman: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Transcription = z.infer<typeof transcription>;

// ---------------------------------------------------------------------------
// 2. Profile extraction — turns speech into a searchable profile (Outcome 1)
// ---------------------------------------------------------------------------

export const extractedProfile = z.object({
  name: z.string().nullable(),
  tradeSlug: z.string().nullable(),
  yearsExperience: z.number().int().min(0).max(70).nullable(),
  area: z.string().nullable(),
  skills: z.array(
    z.object({
      labelEn: z.string(),
      labelUr: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  rateMin: z.number().int().nonnegative().nullable(),
  rateMax: z.number().int().nonnegative().nullable(),
  bioUr: z.string().nullable(),
  bioEn: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  /** Fields the model could not fill — the UI must ask for these again, aloud. */
  missing: z.array(z.string()),
});
export type ExtractedProfile = z.infer<typeof extractedProfile>;

// ---------------------------------------------------------------------------
// 3. Work-photo tagging — proof of skill without a CV (Outcome 1)
// ---------------------------------------------------------------------------

export const photoTags = z.object({
  tags: z.array(z.object({ label: z.string(), confidence: z.number().min(0).max(1) })),
  tradeGuess: z.string().nullable(),
});
export type PhotoTags = z.infer<typeof photoTags>;

// ---------------------------------------------------------------------------
// 4. Problem classification — she needn't know the trade name (Outcome 2)
// ---------------------------------------------------------------------------

export const problemClassification = z.object({
  tradeSlug: z.string(),
  urgency: z.enum(['low', 'normal', 'urgent']),
  likelyFix: z.string(),
  keywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type ProblemClassification = z.infer<typeof problemClassification>;

// ---------------------------------------------------------------------------
// 5. Translation — they literally cannot negotiate without it (Outcome 3)
// ---------------------------------------------------------------------------

export const translation = z.object({ text: z.string() });
export type Translation = z.infer<typeof translation>;

// ---------------------------------------------------------------------------
// 6. Price extraction — a spoken quote becomes a record (Outcome 3, 4)
// ---------------------------------------------------------------------------

export const extractedPrice = z.object({
  amount: z.number().int().nonnegative().nullable(),
  /** 'job' | 'hour' | 'day' | 'visit' | 'per_point' ... free text, shown verbatim. */
  unit: z.string().nullable(),
  includes: z.array(z.string()),
  /** True when the worker named a range or hedged; the UI must then ask again. */
  ambiguous: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type ExtractedPrice = z.infer<typeof extractedPrice>;

// ---------------------------------------------------------------------------
// 7. Review synthesis — trust instead of "ask a neighbour" (Outcome 5)
// ---------------------------------------------------------------------------

export const reviewSummary = z.object({
  summaryEn: z.string(),
  summaryUr: z.string(),
  /** Shown beside the summary. A score with no provenance is not trust. */
  sourceReviewCount: z.number().int().nonnegative(),
  strengths: z.array(z.string()),
  cautions: z.array(z.string()),
});
export type ReviewSummary = z.infer<typeof reviewSummary>;

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export type TranscribeInput = {
  audio: Uint8Array;
  mimeType: string;
  /** Hint only; providers should auto-detect. */
  language?: 'ur' | 'en';
};

export type ClassifyProblemInput = {
  text?: string;
  /** base64, no data: prefix. */
  imageBase64?: string;
  imageMimeType?: string;
  /** Slugs the classifier is allowed to return. */
  allowedTrades: Array<{ slug: string; nameEn: string; nameUr: string; keywords: string[] }>;
};

export type TagPhotoInput = {
  imageBase64: string;
  imageMimeType: string;
  allowedTrades: Array<{ slug: string; nameEn: string }>;
};

export type TranslateInput = {
  text: string;
  from: 'ur' | 'en' | 'roman' | 'ur-roman';
  to: 'ur' | 'en' | 'roman' | 'ur-roman';
};

export type SummariseReviewsInput = {
  reviews: Array<{ stars: number; tags: string[]; text?: string | null }>;
  tradeNameEn: string;
};

/**
 * A provider implements as much as it can and throws `NotSupported` for the
 * rest; the dispatcher then falls through to the next provider and finally to
 * the stub, recording `fallbackReason` in the meta.
 */
export interface AiProvider {
  readonly name: ProviderName;
  readonly available: boolean;

  transcribe?(input: TranscribeInput): Promise<AiResult<Transcription>>;
  extractProfile?(transcript: string): Promise<AiResult<ExtractedProfile>>;
  tagPhoto?(input: TagPhotoInput): Promise<AiResult<PhotoTags>>;
  classifyProblem?(input: ClassifyProblemInput): Promise<AiResult<ProblemClassification>>;
  translate?(input: TranslateInput): Promise<AiResult<Translation>>;
  extractPrice?(transcript: string): Promise<AiResult<ExtractedPrice>>;
  summariseReviews?(input: SummariseReviewsInput): Promise<AiResult<ReviewSummary>>;
}

export class NotSupported extends Error {
  constructor(capability: string, provider: string) {
    super(`${provider} does not implement ${capability}`);
    this.name = 'NotSupported';
  }
}

export type Capability = keyof Omit<AiProvider, 'name' | 'available'>;
