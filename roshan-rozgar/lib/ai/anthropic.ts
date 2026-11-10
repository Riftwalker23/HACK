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

type JsonSchema = Anthropic.Tool.InputSchema;

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
        input_schema: options.schema,
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

const TRADE_SLUGS_NOTE = (slugs: string[]) =>
  `tradeSlug MUST be exactly one of: ${slugs.join(', ')}.`;

// ---------------------------------------------------------------------------
// Schemas — JSON-Schema mirrors of the zod contracts in ./types.ts
// ---------------------------------------------------------------------------

const PROFILE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name', 'tradeSlug', 'yearsExperience', 'area', 'skills',
    'rateMin', 'rateMax', 'bioUr', 'bioEn', 'confidence', 'missing',
  ],
  properties: {
    name: { type: ['string', 'null'], description: 'The worker\'s own name as he said it. null if he never gave one.' },
    tradeSlug: { type: ['string', 'null'], description: 'One of the allowed trade slugs, or null if unclear.' },
    yearsExperience: { type: ['integer', 'null'], minimum: 0, maximum: 70 },
    area: { type: ['string', 'null'], description: 'The area or sector he named, e.g. "G-9, Islamabad".' },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['labelEn', 'labelUr', 'confidence'],
        properties: {
          labelEn: { type: 'string' },
          labelUr: { type: ['string', 'null'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    rateMin: { type: ['integer', 'null'], minimum: 0, description: 'Lower bound of his rate in whole PKR. null if he named no price.' },
    rateMax: { type: ['integer', 'null'], minimum: 0 },
    bioUr: { type: ['string', 'null'], description: 'One short sentence in Urdu script.' },
    bioEn: { type: ['string', 'null'], description: 'One short sentence in English.' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    missing: {
      type: 'array',
      items: { type: 'string' },
      description: 'Field names you could not determine. The UI will ask for these again, aloud.',
    },
  },
};

const PHOTO_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['tags', 'tradeGuess'],
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'confidence'],
        properties: {
          label: { type: 'string', description: 'A specific piece of work visible in the photo, e.g. "split AC outdoor unit mounting".' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    tradeGuess: { type: ['string', 'null'] },
  },
};

const CLASSIFICATION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['tradeSlug', 'urgency', 'likelyFix', 'keywords', 'confidence'],
  properties: {
    tradeSlug: { type: 'string' },
    urgency: { type: 'string', enum: ['low', 'normal', 'urgent'] },
    likelyFix: { type: 'string', description: 'One or two plain sentences a householder can understand.' },
    keywords: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
};

const TRANSLATION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text'],
  properties: { text: { type: 'string' } },
};

const PRICE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['amount', 'unit', 'includes', 'ambiguous', 'confidence'],
  properties: {
    amount: { type: ['integer', 'null'], minimum: 0, description: 'Whole PKR. null if no number was spoken.' },
    unit: { type: ['string', 'null'], enum: ['job', 'hour', 'day', 'visit', 'per_point', 'month', null] },
    includes: {
      type: 'array',
      items: { type: 'string' },
      description: 'What the amount covers, e.g. ["labour"] or ["labour","material"].',
    },
    ambiguous: { type: 'boolean', description: 'true if he gave a range, hedged, or named more than one price.' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
};

const REVIEW_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summaryEn', 'summaryUr', 'sourceReviewCount', 'strengths', 'cautions'],
  properties: {
    summaryEn: { type: 'string', description: 'Two or three sentences at most.' },
    summaryUr: { type: 'string', description: 'The same summary in Urdu script.' },
    sourceReviewCount: { type: 'integer', minimum: 0 },
    strengths: { type: 'array', items: { type: 'string' } },
    cautions: { type: 'array', items: { type: 'string' } },
  },
};

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

const PROFILE_SYSTEM = `You turn a spoken job interview into a structured worker profile for a Pakistani trade-work marketplace.

The transcript is a trade worker answering four questions in Urdu or Roman Urdu: what work do you do, how many years have you been doing it, which area do you work in, and what exactly can you do. He may not read or write, so this transcript is the only record of his skills.

Rules:
- Extract only what he actually said. Never invent a name, an area, a year count or a price.
- Urdu number words count as numbers: "das saal" is 10 years, "dhai hazaar" is 2500, "do hazaar" is 2000.
- skills must be concrete pieces of work he mentioned ("geyser installation"), not personality traits.
- rateMin / rateMax are whole PKR. If he named a single price, use it for both. If he named none, use null.
- bioUr is Urdu script; bioEn is English. One short sentence each, in the third person.
- List every field you could not determine in \`missing\`. An honest gap is useful; a guess is not.`;

async function extractProfile(transcript: string): Promise<AiResult<ExtractedProfile>> {
  const { allowedTrades } = await import('@/data/trades');
  const trades = allowedTrades();

  return callTool<ExtractedProfile>({
    toolName: 'save_worker_profile',
    description: 'Record the structured profile extracted from the worker\'s spoken interview.',
    schema: PROFILE_SCHEMA,
    validator: extractedProfile,
    // Heavier model: this is the hardest extraction in the product and it runs
    // once per worker, not once per request.
    model: env.ANTHROPIC_MODEL_HEAVY,
    maxTokens: MAX_TOKENS_PROFILE,
    system: `${PROFILE_SYSTEM}\n\n${TRADE_SLUGS_NOTE(trades.map((t) => t.slug))}\nTrades: ${trades
      .map((t) => `${t.slug} (${t.nameEn} / ${t.nameUr})`)
      .join('; ')}`,
    content: [{ type: 'text', text: `Transcript:\n"""\n${transcript}\n"""` }],
  });
}

async function tagPhoto(input: TagPhotoInput): Promise<AiResult<PhotoTags>> {
  return callTool<PhotoTags>({
    toolName: 'save_photo_tags',
    description: 'Record the specific trade work visible in a worker\'s photograph.',
    schema: PHOTO_SCHEMA,
    validator: photoTags,
    system: `You look at a photograph of completed trade work in Pakistan and name what it shows.

This photo is a worker's only proof of skill — he has no CV. Tag what is actually visible as specific, searchable pieces of work ("split AC outdoor unit mounting", "floor tile fixing"), at most five tags. Set a low confidence when the photo is unclear, and tradeGuess to null if you cannot tell which trade did the work.

${TRADE_SLUGS_NOTE(input.allowedTrades.map((t) => t.slug))}`,
    content: [
      imageBlock(input.imageBase64, input.imageMimeType),
      { type: 'text', text: 'Tag the trade work visible in this photo.' },
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
  content.push({
    type: 'text',
    text: input.text?.trim()
      ? `The customer says:\n"""\n${input.text}\n"""`
      : 'The customer sent only this photo, with no words.',
  });

  return callTool<ProblemClassification>({
    toolName: 'save_problem_classification',
    description: 'Record which trade a household problem needs, how urgent it is, and the likely fix.',
    schema: CLASSIFICATION_SCHEMA,
    validator: problemClassification,
    system: `You read a Pakistani householder's description or photo of something broken and decide which trade she needs.

She does not know the trade names — that is the whole point. The input may be English, Urdu script, Roman Urdu, or a photo.

Rules:
- urgency 'urgent' for water escaping, sparking, smoke, a smell of gas, or anything she says is foran/abhi/jaldi. 'low' when she says there is no hurry. Otherwise 'normal'.
- likelyFix is for the worker's benefit: one or two sentences naming the probable cause and what will probably be done. Do not quote a price.
- keywords are the words in her own message that led to your answer.

${TRADE_SLUGS_NOTE(input.allowedTrades.map((t) => t.slug))}
Trades and the symptoms that belong to each: ${input.allowedTrades
      .map((t) => `${t.slug}: ${t.keywords.slice(0, 14).join(', ')}`)
      .join(' | ')}`,
    content,
  });
}

async function translate(input: TranslateInput): Promise<AiResult<Translation>> {
  const direction =
    input.from === 'ur' ? 'Urdu (or Roman Urdu) into English' : 'English into Urdu script';

  return callTool<Translation>({
    toolName: 'save_translation',
    description: 'Record the translated text.',
    schema: TRANSLATION_SCHEMA,
    validator: translation,
    system: `You translate ${direction} for a live chat between a householder and a trade worker who are negotiating a repair.

Rules:
- Translate only. No commentary, no notes, no explanation, no quotation marks added.
- Preserve every numeral, price and unit EXACTLY as written. "2000" stays "2000"; do not convert, round, or spell out numbers.
- Keep it as short as the original. This appears in a chat bubble.
- If the text is already in the target language, return it unchanged.`,
    content: [{ type: 'text', text: input.text }],
  });
}

async function extractPrice(transcript: string): Promise<AiResult<ExtractedPrice>> {
  return callTool<ExtractedPrice>({
    toolName: 'save_price',
    description: 'Record the structured price extracted from a worker\'s spoken quote.',
    schema: PRICE_SCHEMA,
    validator: extractedPrice,
    system: `You turn a trade worker's SPOKEN price quote in Urdu or Roman Urdu into a structured record. Both sides will then tap to confirm it, so an invented number is worse than no number.

Urdu number words:
- sau = 100, hazaar = 1000, lakh = 100000
- dhai = 2.5, derh = 1.5, saarhay X = X + 0.5
- "do hazaar" = 2000, "dhai hazaar" = 2500, "saarhay teen hazaar" = 3500, "paanch sau" = 500

Rules:
- amount is whole PKR. If he named a range ("do se teen hazaar"), use the LOWER bound and set ambiguous true.
- unit: 'job' unless he tied the price to time or a count — 'hour' (ghanta), 'day' (dihari/roz), 'visit' (chakkar), 'per_point' (point), 'month'.
- includes: ["labour"] by default. "material alag" means material is NOT included, so stay ["labour"]. "material shamil" means ["labour","material"].
- ambiguous true whenever he gave a range, hedged (takreeban, andaza, "dekh kar bataunga"), or named more than one price.

Example: "do hazaar rupay lagenge, material alag" -> amount 2000, unit "job", includes ["labour"], ambiguous false.`,
    content: [{ type: 'text', text: `He said:\n"""\n${transcript}\n"""` }],
  });
}

async function summariseReviews(
  input: SummariseReviewsInput,
): Promise<AiResult<ReviewSummary>> {
  return callTool<ReviewSummary>({
    toolName: 'save_review_summary',
    description: 'Record a short, sourced trust summary synthesised from a worker\'s reviews.',
    schema: REVIEW_SCHEMA,
    validator: reviewSummary,
    system: `You synthesise a trade worker's reviews into the short summary the NEXT customer reads before letting him into her home.

Rules:
- Use only the reviews given. sourceReviewCount must equal the number of reviews supplied.
- Say the average rating as a number. Name the themes that actually repeat across reviews, not one person's wording.
- cautions must be real: low ratings, repeated complaints, or a sample too small to mean much. Never leave cautions empty just to be kind — a summary with no provenance is not trust.
- summaryEn in English, summaryUr in Urdu script, two or three sentences each.`,
    content: [
      {
        type: 'text',
        text: `Trade: ${input.tradeNameEn}\nReview count: ${input.reviews.length}\nReviews:\n${JSON.stringify(
          input.reviews,
          null,
          2,
        )}`,
      },
    ],
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
