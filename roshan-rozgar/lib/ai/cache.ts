/**
 * Content-addressed cache for AI responses.
 *
 * Two reasons this exists, both about the demo rather than about cost:
 *  - rehearsing the demo five times must not burn five times the rate limit;
 *  - a repeated call during judging returns instantly instead of waiting on
 *    venue wifi.
 *
 * In-memory + a JSON file on disk, so a restart keeps the warm answers.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AiMeta } from './types';

const CACHE_FILE = process.env.AI_CACHE_FILE ?? join('.data', 'ai-cache.json');
const MAX_ENTRIES = 500;

type Entry = { value: unknown; meta: AiMeta; at: number };

const globalForCache = globalThis as unknown as {
  __roshanAiCache?: Map<string, Entry>;
  __roshanAiCacheLoaded?: boolean;
};

const mem = (globalForCache.__roshanAiCache ??= new Map<string, Entry>());

export function cacheKey(capability: string, input: unknown): string {
  const canonical = JSON.stringify(input, (_k, v) =>
    v instanceof Uint8Array ? createHash('sha256').update(v).digest('hex') : v,
  );
  return `${capability}:${createHash('sha256').update(canonical).digest('hex').slice(0, 32)}`;
}

async function load(): Promise<void> {
  if (globalForCache.__roshanAiCacheLoaded) return;
  globalForCache.__roshanAiCacheLoaded = true;
  try {
    const raw = await readFile(CACHE_FILE, 'utf8');
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) {
      mem.set(k, v);
    }
  } catch {
    // No cache yet. Expected on a fresh clone.
  }
}

let flushTimer: NodeJS.Timeout | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  // Debounced so a burst of calls writes once.
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 1_000);
  // Don't hold the process open just for the cache.
  flushTimer.unref?.();
}

async function flush(): Promise<void> {
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    const entries = [...mem.entries()].slice(-MAX_ENTRIES);
    await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(entries)), 'utf8');
  } catch (err) {
    console.warn('[ai-cache] could not persist', err);
  }
}

export async function getCached<T>(key: string): Promise<{ value: T; meta: AiMeta } | null> {
  await load();
  const hit = mem.get(key);
  if (!hit) return null;
  return { value: hit.value as T, meta: { ...hit.meta, cached: true } };
}

export async function setCached<T>(key: string, value: T, meta: AiMeta): Promise<void> {
  await load();
  mem.set(key, { value, meta: { ...meta, cached: false }, at: Date.now() });
  if (mem.size > MAX_ENTRIES) {
    // Oldest-first eviction; Map preserves insertion order.
    const excess = mem.size - MAX_ENTRIES;
    let i = 0;
    for (const k of mem.keys()) {
      if (i++ >= excess) break;
      mem.delete(k);
    }
  }
  scheduleFlush();
}
