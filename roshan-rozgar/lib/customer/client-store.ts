'use client';

/**
 * Browser-only values (the URL query, localStorage, the clock) read during
 * render through useSyncExternalStore instead of being copied into state from
 * an effect. The server render and the hydrating client render both see
 * `serverValue`; React then re-renders with the real value, which is exactly
 * what the old "useState + setState in useEffect" pattern did, minus the
 * cascading render the react-hooks lint rules forbid.
 */

import { useSyncExternalStore } from 'react';

type Primitive = string | number | boolean | null | undefined;

/** Back/forward changes the query; another tab can change localStorage. */
function subscribeBrowser(cb: () => void) {
  window.addEventListener('popstate', cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener('popstate', cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * `read` must return a primitive (two reads of the same state compare equal),
 * otherwise React would re-render forever.
 */
export function useBrowserValue<T extends Primitive>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeBrowser, read, () => serverValue);
}

export function readQueryParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * A query-string parameter. `undefined` means "not read yet" (server render and
 * hydration), `null` means the URL has no such parameter.
 */
export function useQueryParam(name: string): string | null | undefined {
  return useBrowserValue<string | null | undefined>(() => readQueryParam(name), undefined);
}

function subscribeMinute(cb: () => void) {
  const id = window.setInterval(cb, 15_000);
  return () => window.clearInterval(id);
}

/** "Now" in epoch ms, floored to the minute; 0 on the server. Keeps render pure. */
export function useNowMinute(): number {
  return useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
}
