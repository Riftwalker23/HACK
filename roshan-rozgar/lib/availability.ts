'use client';

/**
 * The worker's availability, shared between screens (and between browser tabs).
 *
 * There is no backend in this build, so the worker's "I'm on a job, free at 5:30 pm"
 * lives in localStorage. The worker screen writes it; the customer's results screen
 * reads it, so a customer in another window sees "Busy till 5:30 pm" and can book
 * from that time. Opening both side by side shows it update live.
 */

import { useSyncExternalStore } from 'react';

export type Status = 'free' | 'busy' | 'off';
export type Avail = { status: Status; freeAt: number | null };

const KEY = 'rr.avail';
const DEFAULT: Avail = { status: 'free', freeAt: null };

const listeners = new Set<() => void>();
let memRaw: string | null = null; // holds the value if storage is unavailable
let lastRaw: string | null | undefined;
let lastVal: Avail = DEFAULT;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memRaw;
  } catch {
    return memRaw;
  }
}

/** Stable snapshot: the same object is returned until the stored value changes. */
function snapshot(): Avail {
  const raw = readRaw();
  if (raw === lastRaw) return lastVal;
  lastRaw = raw;
  try {
    const p = raw ? JSON.parse(raw) : null;
    const okStatus = p && (p.status === 'free' || p.status === 'busy' || p.status === 'off');
    lastVal = okStatus
      ? { status: p.status, freeAt: typeof p.freeAt === 'number' ? p.freeAt : null }
      : DEFAULT;
  } catch {
    lastVal = DEFAULT;
  }
  return lastVal;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb); // another tab or window changed it
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

export function setAvailability(next: Avail) {
  const raw = JSON.stringify(next);
  memRaw = raw;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* the value still holds for this session through memRaw */
  }
  listeners.forEach((l) => l());
}

export function useAvailability(): Avail {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT);
}

/* --- "now", to the minute, as a store: keeps render pure and lets a passed time expire --- */
function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 15_000);
  return () => clearInterval(id);
}

/** Current time in whole minutes since the epoch. */
export function useMinute(): number {
  return useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60_000), () => 0);
}

/** The moment `mins` minutes from now, in epoch ms. */
export function minutesFromNow(mins: number): number {
  return Date.now() + mins * 60_000;
}

/** "5:30 pm" — written by hand so it never picks up locale-specific spacing. */
export function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** For <input type="time">: local "HH:MM". */
export function toInputValue(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** From "HH:MM": the next time that clock reading occurs (today, or tomorrow if it has passed). */
export function fromInputValue(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}
