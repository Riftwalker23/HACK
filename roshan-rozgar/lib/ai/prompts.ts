/**
 * Prompts and JSON schemas shared by every LLM provider (Anthropic, Gemini).
 *
 * One copy on purpose: a prompt fix must reach every provider, and the judges'
 * question "what does the AI actually do here" has one answer, not two. The
 * wording here was lifted unchanged from the original Anthropic provider, apart
 * from translation, which now handles all four language labels the API accepts.
 *
 * Each schema mirrors the zod contract of the same name in ./types.ts; the
 * provider validates the model's reply with that zod schema, so a mismatch here
 * degrades to the next provider instead of returning malformed data.
 */

import type { ClassifyProblemInput, SummariseReviewsInput, TranslateInput } from './types';

/** Plain JSON Schema object, structurally compatible with each vendor's type. */
export type JsonSchema = { type: 'object'; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const PROFILE_SCHEMA: JsonSchema = {
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

export const PHOTO_SCHEMA: JsonSchema = {
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

export const CLASSIFICATION_SCHEMA: JsonSchema = {
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

export const TRANSLATION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text'],
  properties: { text: { type: 'string' } },
};

export const PRICE_SCHEMA: JsonSchema = {
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

export const REVIEW_SCHEMA: JsonSchema = {
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
// System prompts and user messages
// ---------------------------------------------------------------------------

export const tradeSlugsNote = (slugs: string[]) =>
  `tradeSlug MUST be exactly one of: ${slugs.join(', ')}.`;

const PROFILE_SYSTEM = `You turn a spoken job interview into a structured worker profile for a Pakistani trade-work marketplace.

The transcript is a trade worker answering four questions in Urdu or Roman Urdu: what work do you do, how many years have you been doing it, which area do you work in, and what exactly can you do. He may not read or write, so this transcript is the only record of his skills.

Rules:
- Extract only what he actually said. Never invent a name, an area, a year count or a price.
- Urdu number words count as numbers: "das saal" is 10 years, "dhai hazaar" is 2500, "do hazaar" is 2000.
- skills must be concrete pieces of work he mentioned ("geyser installation"), not personality traits.
- rateMin / rateMax are whole PKR. If he named a single price, use it for both. If he named none, use null.
- bioUr is Urdu script; bioEn is English. One short sentence each, in the third person.
- List every field you could not determine in \`missing\`. An honest gap is useful; a guess is not.`;

export function profileSystem(trades: Array<{ slug: string; nameEn: string; nameUr: string }>): string {
  return `${PROFILE_SYSTEM}\n\n${tradeSlugsNote(trades.map((t) => t.slug))}\nTrades: ${trades
    .map((t) => `${t.slug} (${t.nameEn} / ${t.nameUr})`)
    .join('; ')}`;
}

export const profileUser = (transcript: string) => `Transcript:\n"""\n${transcript}\n"""`;

export function photoSystem(trades: Array<{ slug: string }>): string {
  return `You look at a photograph of completed trade work in Pakistan and name what it shows.

This photo is a worker's only proof of skill — he has no CV. Tag what is actually visible as specific, searchable pieces of work ("split AC outdoor unit mounting", "floor tile fixing"), at most five tags. Set a low confidence when the photo is unclear, and tradeGuess to null if you cannot tell which trade did the work.

${tradeSlugsNote(trades.map((t) => t.slug))}`;
}

export const PHOTO_USER = 'Tag the trade work visible in this photo.';

export function classifySystem(trades: ClassifyProblemInput['allowedTrades']): string {
  return `You read a Pakistani householder's description or photo of something broken and decide which trade she needs.

She does not know the trade names — that is the whole point. The input may be English, Urdu script, Roman Urdu, or a photo.

Rules:
- urgency 'urgent' for water escaping, sparking, smoke, a smell of gas, or anything she says is foran/abhi/jaldi. 'low' when she says there is no hurry. Otherwise 'normal'.
- likelyFix is for the worker's benefit: one or two sentences naming the probable cause and what will probably be done. Do not quote a price.
- keywords are the words in her own message that led to your answer.

${tradeSlugsNote(trades.map((t) => t.slug))}
Trades and the symptoms that belong to each: ${trades
    .map((t) => `${t.slug}: ${t.keywords.slice(0, 14).join(', ')}`)
    .join(' | ')}`;
}

export const classifyUser = (input: Pick<ClassifyProblemInput, 'text'>) =>
  input.text?.trim()
    ? `The customer says:\n"""\n${input.text}\n"""`
    : 'The customer sent only this photo, with no words.';

const LANGUAGE_NAMES: Record<TranslateInput['from'], string> = {
  ur: 'Urdu in Urdu script',
  en: 'English',
  roman: 'Roman Urdu (Urdu written in Latin letters, the way Pakistanis text)',
  'ur-roman': 'Roman Urdu (Urdu written in Latin letters, the way Pakistanis text)',
};

export function translateSystem(input: Pick<TranslateInput, 'from' | 'to'>): string {
  // Speech transcripts and typed text arrive in either Urdu form, so a source
  // of 'ur' is read as "Urdu script or Roman Urdu".
  const source = input.from === 'ur' ? 'Urdu (Urdu script or Roman Urdu)' : LANGUAGE_NAMES[input.from];
  return `You translate ${source} into ${LANGUAGE_NAMES[input.to]} for a live chat between a householder and a trade worker who are negotiating a repair.

Rules:
- Translate only. No commentary, no notes, no explanation, no quotation marks added.
- Preserve every numeral, price and unit EXACTLY as written. "2000" stays "2000"; do not convert, round, or spell out numbers.
- Keep it as short as the original. This appears in a chat bubble.
- If the text is already in the target language, return it unchanged.`;
}

export const PRICE_SYSTEM = `You turn a trade worker's SPOKEN price quote in Urdu or Roman Urdu into a structured record. Both sides will then tap to confirm it, so an invented number is worse than no number.

Urdu number words:
- sau = 100, hazaar = 1000, lakh = 100000
- dhai = 2.5, derh = 1.5, saarhay X = X + 0.5, sawa X = X + 0.25, paune X = X - 0.25, aadha = 0.5
- "do hazaar" = 2000, "dhai hazaar" = 2500, "saarhay teen hazaar" = 3500, "sawa do hazaar" = 2250, "paune do hazaar" = 1750, "paanch sau" = 500
- These fraction words name ONE EXACT amount. They are not hedges and never make a quote ambiguous on their own.

Rules:
- amount is whole PKR. If he named a range ("do se teen hazaar"), use the LOWER bound and set ambiguous true.
- unit: 'job' unless he tied the price to time or a count — 'hour' (ghanta), 'day' (dihari/roz), 'visit' (chakkar), 'per_point' (point), 'month'.
- includes: ["labour"] by default. "material alag" means material is NOT included, so stay ["labour"]. "material shamil" means ["labour","material"].
- ambiguous true ONLY when he gave a range ("do se teen hazaar"), hedged (takreeban, andaza, lagbhag, "dekh kar bataunga"), or named more than one price. A single amount stated with saarhay/sawa/paune/dhai/derh is NOT ambiguous.

Example: "do hazaar rupay lagenge, material alag" -> amount 2000, unit "job", includes ["labour"], ambiguous false.`;

export const priceUser = (transcript: string) => `He said:\n"""\n${transcript}\n"""`;

export const REVIEW_SYSTEM = `You synthesise a trade worker's reviews into the short summary the NEXT customer reads before letting him into her home.

Rules:
- Use only the reviews given. sourceReviewCount must equal the number of reviews supplied.
- Say the average rating as a number. Name the themes that actually repeat across reviews, not one person's wording.
- cautions must be real: low ratings, repeated complaints, or a sample too small to mean much. Never leave cautions empty just to be kind — a summary with no provenance is not trust.
- summaryEn in English, summaryUr in Urdu script, two or three sentences each.`;

export const reviewUser = (input: SummariseReviewsInput) =>
  `Trade: ${input.tradeNameEn}\nReview count: ${input.reviews.length}\nReviews:\n${JSON.stringify(
    input.reviews,
    null,
    2,
  )}`;
