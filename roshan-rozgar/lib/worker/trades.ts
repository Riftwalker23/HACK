/**
 * Trade lookups for the worker screens: backend slug -> design tile/glyph class
 * and the three-language name. Names come straight from data/trades.ts (the
 * same source the backend seeds from), so the UI and the database never drift.
 */

import { TRADES } from '@/data/trades';
import type { Lang } from '@/components/lang';

/** Backend slug -> the design's short trade key (tile class `tr-<key>`, glyph `g-<key>`). */
export const TRADE_KEY: Record<string, string> = {
  electrician: 'elec',
  plumber: 'plum',
  'ac-technician': 'ac',
  carpenter: 'carp',
  mechanic: 'mech',
  painter: 'paint',
  mason: 'mason',
};

export const TRADE_SLUGS = TRADES.map((t) => t.slug);

export function tradeKey(slug?: string | null): string | null {
  return (slug && TRADE_KEY[slug]) || null;
}

/** "tr-elec" — the class that sets `--c` to the trade colour. */
export function tradeClass(slug?: string | null): string {
  const k = tradeKey(slug);
  return k ? `tr-${k}` : '';
}

/** "g-elec" — the sprite glyph id for the trade. */
export function tradeGlyph(slug?: string | null): string {
  const k = tradeKey(slug);
  return k ? `g-${k}` : 'i-tools';
}

/** The trade's name in the active language. Roman names are title-cased for display. */
export function tradeName(slug: string | null | undefined, lang: Lang): string {
  const t = TRADES.find((x) => x.slug === slug);
  if (!t) return '';
  if (lang === 'ur') return t.nameUr;
  if (lang === 'rm') return t.nameRoman.replace(/\b\w/g, (c) => c.toUpperCase());
  return t.nameEn;
}
