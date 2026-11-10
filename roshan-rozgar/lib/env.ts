/**
 * Environment. Every AI key is OPTIONAL by design.
 *
 * The brief penalises presenting mocked functionality as working, so the AI
 * layer reports which provider served each call ('anthropic' | 'openai' |
 * 'stub'). With no keys present every endpoint still returns well-formed data
 * labelled `provider: 'stub'`, which the UI must surface and the README must
 * disclose. Nothing silently pretends.
 */

import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  PGLITE_DATA_DIR: z.string().min(1).optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
  ANTHROPIC_MODEL_HEAVY: z.string().min(1).default('claude-opus-5-5'),

  // Whisper for Urdu speech-to-text.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_STT_MODEL: z.string().min(1).default('whisper-1'),

  GEMINI_API_KEY: z.string().min(1).optional(),

  // Supabase Storage for media upload (Outcome 1, 3, 5).
  SUPABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  SUPABASE_BUCKET: z.string().min(1).default('uploads'),

  // Search tuning, exposed so it can be defended in the demo.
  SEARCH_DEFAULT_RADIUS_KM: z.coerce.number().positive().default(8),
  SEARCH_MAX_RESULTS: z.coerce.number().int().positive().default(20),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail loudly at boot rather than at 2 AM in a route handler.
  throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;

export const hasAnthropic = () => Boolean(env.ANTHROPIC_API_KEY);
export const hasOpenAI = () => Boolean(env.OPENAI_API_KEY);
export const hasGemini = () => Boolean(env.GEMINI_API_KEY);
export const hasSupabaseStorage = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);

/** True when no real model is reachable — everything will be labelled 'stub'. */
export const isFullyStubbed = () => !hasAnthropic() && !hasOpenAI() && !hasGemini();
