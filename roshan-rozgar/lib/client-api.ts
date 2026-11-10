'use client';

export type ApiEnvelope<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export type DemoUser = {
  id: string;
  name: string;
  phone: string;
  lat?: number;
  lng?: number;
  addressLabel?: string;
  area?: string;
  status?: 'FREE' | 'BUSY' | 'OFF';
  rating?: number;
  jobsCompleted?: number;
  tradeSlug?: string;
  tradeNameEn?: string;
  rateMin?: number;
  rateMax?: number;
};

export type Classification = {
  tradeSlug: string;
  urgency: 'low' | 'normal' | 'urgent';
  likelyFix: string;
  keywords: string[];
  confidence: number;
  provider: string;
};

const SESSION_KEY = 'rr_demo_session';
const SEARCH_KEY = 'rr_customer_search';
const JOB_KEY = 'rr_active_job';

export async function api<T>(url: string, init?: RequestInit): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const response = await fetch(url, {
    ...init,
    // A FormData body must set its own multipart boundary; forcing JSON here would destroy it.
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok) {
    const message = payload.ok ? `Request failed (${response.status})` : payload.error.message;
    throw new Error(message);
  }
  return { data: payload.data, meta: payload.meta };
}

export function getSession(role?: 'customer' | 'worker'): DemoUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as
      | { role: string; user: DemoUser }
      | null;
    return value && (!role || value.role === role) ? value.user : null;
  } catch {
    return null;
  }
}

export function saveSession(role: 'customer' | 'worker', user: DemoUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ role, user }));
}

export async function signInDemo(role: 'customer' | 'worker'): Promise<DemoUser> {
  const phone = role === 'customer' ? '+923005551234' : '+923001234567';
  const { data } = await api<{ role: string; user: DemoUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, pin: '0000', role }),
  });
  saveSession(role, data.user);
  return data.user;
}

export function saveSearch(value: { description: string; source: 'text' | 'voice' | 'photo'; photoUrl?: string; classification: Classification }) {
  localStorage.setItem(SEARCH_KEY, JSON.stringify(value));
}

export function loadSearch(): { description: string; source: 'text' | 'voice' | 'photo'; photoUrl?: string; classification: Classification } | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(SEARCH_KEY) ?? 'null'); } catch { return null; }
}

export function saveActiveJob(job: unknown) {
  localStorage.setItem(JOB_KEY, JSON.stringify(job));
}

export function loadActiveJob<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(JOB_KEY) ?? 'null') as T | null; } catch { return null; }
}
