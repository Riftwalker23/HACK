'use client';

/**
 * The truthful "AI" chip.
 *
 * The hackathon brief penalises presenting mocked output as working, so a chip
 * that says "AI" must mean a model produced the thing next to it. This is the
 * single place that decision is made:
 *
 *   anthropic | openai | gemini | elevenlabs  ->  "AI"          (a model answered)
 *   stub | unreported | unknown               ->  "demo data"   (offline fallback)
 *   none | undefined                          ->  nothing       (no model involved,
 *                                                                or nothing to claim)
 *
 * Every customer screen uses this instead of a hard-coded "AI · demo" chip.
 */

import { useLang } from '@/components/lang';

const REAL = new Set(['anthropic', 'openai', 'gemini', 'elevenlabs']);

const DEMO = { ur: 'ڈیمو ڈیٹا', rm: 'demo data', en: 'demo data' } as const;

/** Pulls the provider label out of an API envelope's `meta` (`meta.ai.provider`). */
export function aiProvider(meta?: Record<string, unknown> | null): string | undefined {
  const ai = meta?.ai as { provider?: unknown } | undefined;
  return typeof ai?.provider === 'string' ? ai.provider : undefined;
}

export function isRealAi(provider?: string | null): boolean {
  return !!provider && REAL.has(provider);
}

export function AiChip({
  provider,
  note,
  style,
}: {
  /** `meta.ai.provider`, or the `provider` field on a classification payload. */
  provider?: string | null;
  /** Short qualifier shown after "AI", e.g. "translated" or "we heard this". */
  note?: string;
  style?: React.CSSProperties;
}) {
  const { lang } = useLang('en');

  // Nothing to claim: no provider information at all, or no model was involved.
  if (!provider || provider === 'none') return null;

  if (isRealAi(provider)) {
    return (
      <span className="ai" style={style} title={`AI: ${provider}`}>
        AI{note ? ` · ${note}` : ''}
      </span>
    );
  }

  // stub, 'unreported', or anything we do not recognise: say so plainly.
  return (
    <span
      className="ai"
      style={{ borderStyle: 'dashed', color: 'var(--soft)', ...style }}
      title="Served by the offline fallback, not a live model"
    >
      {DEMO[lang]}
    </span>
  );
}
