/**
 * Claude provider — the reasoning, extraction, classification, translation and
 * summarisation half of the AI layer (PROJECT.md §3.2).
 *
 * STRUCTURED OUTPUT STRATEGY
 *
 * Free-form prose is never parsed here. Every capability declares a tool whose
 * `input_schema` mirrors the zod schema in ./types.ts, and the tool input is
 * then validated with that zod schema; a schema miss throws, the dispatcher
 * catches it and falls through to the deterministic stub.
 *
 * Two deliberate deviations from the obvious implementation, both because of
 * the models this project targets (claude-sonnet-5-5 / claude-opus-5-5):
 *
 *  1. `tool_choice` is `auto`, not `{ type: 'tool', name }`. Forced tool choice
 *     ('any' / 'tool') returns HTTP 400 on these models. The call is steered
 *     instead with `strict: true` (guaranteed schema-valid arguments),
 *     `disable_parallel_tool_use` (at most one call) and a system prompt that
 *     names the tool. A reply with no tool_use block throws, so a model that
 *     answers in prose degrades to the stub rather than being parsed.
 *  2. `effort: 'low'`. Thinking cannot be disabled on these models and thinking
 *     tokens count against `max_tokens`, so the cheapest effort keeps these
 *     short extractions inside a modest budget. These are extraction tasks,
 *     not reasoning tasks.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env, hasAnthropic } from '@/lib/env';
import {
  extractedPrice,
  extractedProfile,
  photoTags,
  problemClassification,
  reviewSummary,
  translation,
  type AiMeta,
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
import type { ZodType } from 'zod';
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

const TIMEOUT_MS = 20_000;
const MAX_TOKENS = 1024;
/** extractProfile fills nine fields at once; it needs more room than the rest. */
const MAX_TOKENS_PROFILE = 2048;

const globalForAnthropic = globalThis as unknown as { __roshanAnthropic?: Anthropic };

function client(): Anthropic {
  // Next.js hot-reloads route modules; one client per process keeps the
  // connection pool from growing on every reload.
  globalForAnthropic.__roshanAnthropic ??= new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  });
  return globalForAnthropic.__roshanAnthropic;
}

// ---------------------------------------------------------------------------
// Tool-call plumbing
// ---------------------------------------------------------------------------


type ToolCallOptions<T> = {
  toolName: string;
  description: string;
  schema: JsonSchema;
  validator: ZodType<T>;
  system: string;
  content: Anthropic.ContentBlockParam[];
  model?: string;
  maxTokens?: number;
};

/**
 * One request, one forced-by-construction tool call, one validated result.
 * Throws on anything else so `lib/ai/index.ts` can fall through.
 */
async function callTool<T>(options: ToolCallOptions<T>): Promise<AiResult<T>> {
  const started = Date.now();
  const model = options.model ?? env.ANTHROPIC_MODEL;

  const response = await client().messages.create({
    model,
    max_tokens: options.maxTokens ?? MAX_TOKENS,
    // Extraction, not deliberation — keep thinking shallow and the reply small.
    output_config: { effort: 'low' },
    system: `${options.system}\n\nAnswer only by calling the \`${options.toolName}\` tool exactly once. Do not reply in prose.`,
    tools: [
      {
        name: options.toolName,
        description: options.description,
        input_schema: options.schema as Anthropic.Tool.InputSchema,
        // Guarantees the arguments validate against input_schema.
        strict: true,
      },
    ],
    tool_choice: { type: 'auto', disable_parallel_tool_use: true },
    messages: [{ role: 'user', content: options.content }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `anthropic refused: ${response.stop_details?.category ?? 'unknown category'}`,
    );
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('anthropic reply hit max_tokens before the tool call completed');
  }

  const block = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === options.toolName,
  );
  if (!block) {
    throw new Error(`anthropic returned no ${options.toolName} tool call`);
  }

  const parsed = options.validator.safeParse(block.input);
  if (!parsed.success) {
    // Better to show the judges a labelled stub answer than a malformed one.
    throw new Error(
      `anthropic ${options.toolName} output failed validation: ${parsed.error.issues
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }

  const meta: AiMeta = {
    provider: 'anthropic',
    model,
    latencyMs: Date.now() - started,
    cached: false,
  };
  return { result: parsed.data, meta };
}

const imageBlock = (base64: string, mimeType: string): Anthropic.ContentBlockParam => ({
  type: 'image',
  source: {
    type: 'base64',
    // The API accepts this narrow set only; anything else is rejected upstream.
    media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    data: base64,
  },
});

// ---------------------------------------------------------------------------
// Capabilities — prompts and schemas live in ./prompts.ts, shared with Gemini
// ---------------------------------------------------------------------------

async function extractProfile(transcript: string): Promise<AiResult<ExtractedProfile>> {
  const { allowedTrades } = await import('@/data/trades');

  return callTool<ExtractedProfile>({
    toolName: 'save_worker_profile',
    description: "Record the structured profile extracted from the worker's spoken interview.",
    schema: PROFILE_SCHEMA,
    validator: extractedProfile,
    // Heavier model: this is the hardest extraction in the product and it runs
    // once per worker, not once per request.
    model: env.ANTHROPIC_MODEL_HEAVY,
    maxTokens: MAX_TOKENS_PROFILE,
    system: profileSystem(allowedTrades()),
    content: [{ type: 'text', text: profileUser(transcript) }],
  });
}

async function tagPhoto(input: TagPhotoInput): Promise<AiResult<PhotoTags>> {
  return callTool<PhotoTags>({
    toolName: 'save_photo_tags',
    description: "Record the specific trade work visible in a worker's photograph.",
    schema: PHOTO_SCHEMA,
    validator: photoTags,
    system: photoSystem(input.allowedTrades),
    content: [
      imageBlock(input.imageBase64, input.imageMimeType),
      { type: 'text', text: PHOTO_USER },
    ],
  });
}

async function classifyProblem(
  input: ClassifyProblemInput,
): Promise<AiResult<ProblemClassification>> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.imageBase64 && input.imageMimeType) {
    content.push(imageBlock(input.imageBase64, input.imageMimeType));
  }
  content.push({ type: 'text', text: classifyUser(input) });

  return callTool<ProblemClassification>({
    toolName: 'save_problem_classification',
    description: 'Record which trade a household problem needs, how urgent it is, and the likely fix.',
    schema: CLASSIFICATION_SCHEMA,
    validator: problemClassification,
    system: classifySystem(input.allowedTrades),
    content,
  });
}

async function translate(input: TranslateInput): Promise<AiResult<Translation>> {
  return callTool<Translation>({
    toolName: 'save_translation',
    description: 'Record the translated text.',
    schema: TRANSLATION_SCHEMA,
    validator: translation,
    system: translateSystem(input),
    content: [{ type: 'text', text: input.text }],
  });
}

async function extractPrice(transcript: string): Promise<AiResult<ExtractedPrice>> {
  return callTool<ExtractedPrice>({
    toolName: 'save_price',
    description: "Record the structured price extracted from a worker's spoken quote.",
    schema: PRICE_SCHEMA,
    validator: extractedPrice,
    system: PRICE_SYSTEM,
    content: [{ type: 'text', text: priceUser(transcript) }],
  });
}

async function summariseReviews(
  input: SummariseReviewsInput,
): Promise<AiResult<ReviewSummary>> {
  return callTool<ReviewSummary>({
    toolName: 'save_review_summary',
    description: "Record a short, sourced trust summary synthesised from a worker's reviews.",
    schema: REVIEW_SCHEMA,
    validator: reviewSummary,
    system: REVIEW_SYSTEM,
    content: [{ type: 'text', text: reviewUser(input) }],
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const provider: AiProvider = {
  name: 'anthropic',
  available: hasAnthropic(),

  // `transcribe` is deliberately absent: Claude takes no audio input, so the
  // dispatcher must reach Whisper (or the stub) for speech. Omitting the method
  // is how a provider declares a capability unsupported.
  extractProfile,
  tagPhoto,
  classifyProblem,
  translate,
  extractPrice,
  summariseReviews,
};

export default provider;
