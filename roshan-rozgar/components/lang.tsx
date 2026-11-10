'use client';

/**
 * Language + stage theme, shared by every screen.
 *
 * The canvas gave each board a `lang` prop with its own default (worker boards
 * start in Urdu, customer boards in English). That is kept exactly: nothing is
 * "chosen" until somebody taps the switch, and each screen falls back to its own
 * default. Once a language is chosen it follows the user across screens.
 *
 * Stored in localStorage through useSyncExternalStore, so the server render and
 * the first client render agree (both see "nothing chosen"), then the remembered
 * value is applied without a mismatch.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type Lang = 'ur' | 'rm' | 'en';

const LANGS: Lang[] = ['ur', 'rm', 'en'];
const KEY_LANG = 'rr.lang';
const KEY_DARK = 'rr.dark';

/* localStorage is per-viewer and can throw (private mode, blocked data). */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
// Fallback for when storage is unavailable: the choice still holds for the session.
const memory: Record<string, string> = {};

function get(key: string): string | null {
  return read(key) ?? memory[key] ?? null;
}
function set(key: string, value: string) {
  memory[key] = value;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* a remembered preference is a convenience, not state we depend on */
  }
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb); // another tab changed it
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

/** Kept so existing layout code can keep wrapping the tree; the store is global. */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const dark = useSyncExternalStore(subscribe, () => get(KEY_DARK) === '1', () => false);
  useEffect(() => {
    document.documentElement.dataset.stage = dark ? 'dark' : 'light';
  }, [dark]);
  return <>{children}</>;
}

function useChosen(): Lang | null {
  const v = useSyncExternalStore(subscribe, () => get(KEY_LANG), () => null);
  return v && (LANGS as string[]).includes(v) ? (v as Lang) : null;
}

export function useStageTheme() {
  const dark = useSyncExternalStore(subscribe, () => get(KEY_DARK) === '1', () => false);
  const setDark = useCallback((d: boolean) => set(KEY_DARK, d ? '1' : '0'), []);
  return { dark, setDark };
}

/** Resolves the language for one screen, given that screen's own default. */
export function useLang(fallback: Lang = 'ur') {
  const chosen = useChosen();
  const { dark, setDark } = useStageTheme();
  const setLang = useCallback((l: Lang) => set(KEY_LANG, l), []);
  const lang = chosen ?? fallback;
  return {
    lang,
    setLang,
    dark,
    setDark,
    // Same mapping the canvas used: Urdu is marked rtl, Roman Urdu is ur-Latn.
    dir: lang === 'ur' ? ('rtl' as const) : ('ltr' as const),
    lc: lang === 'rm' ? 'ur-Latn' : lang,
    theme: dark ? 'dark' : 'light',
  };
}
