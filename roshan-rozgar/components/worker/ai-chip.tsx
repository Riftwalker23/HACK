'use client';

/**
 * The truthful "AI" chip for the worker side (TEAM-SPLIT.md §4, honesty rule).
 *
 *   anthropic | openai | gemini | elevenlabs  ->  "AI"         a model produced it
 *   stub / unknown                            ->  "demo data"  offline fallback
 *   none / undefined                          ->  nothing      nothing to claim
 *
 * Same look and rule as Person B's components/customer/ai-chip.tsx, kept in the
 * worker namespace so neither half edits the other's files.
 */

import { useLang } from '@/components/lang';

const REAL = new Set(['anthropic', 'openai', 'gemini', 'elevenlabs']);
const DEMO = { ur: 'ڈیمو ڈیٹا', rm: 'demo data', en: 'demo data' } as const;

/** Pulls `meta.ai.provider` out of an API envelope's meta. */
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
  provider?: string | null;
  note?: string;
  style?: React.CSSProperties;
}) {
  const { lang } = useLang('ur');
  if (!provider || provider === 'none') return null;

  if (isRealAi(provider)) {
    return (
      <span className="ai" style={style} title={`AI: ${provider}`}>
        AI{note ? ` · ${note}` : ''}
      </span>
    );
  }
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
