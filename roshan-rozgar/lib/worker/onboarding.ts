'use client';

/**
 * The voice-onboarding draft: everything the worker has said and shown across
 * the four onboarding screens (voice -> trade -> skills -> proof), held until he
 * taps Publish.
 *
 * Same convention as lib/availability.ts: useSyncExternalStore over
 * localStorage, every storage access wrapped in try/catch, and a stable
 * snapshot object (the same object is returned until the stored value changes).
 * If storage is unavailable the draft still lives in memory for this session.
 *
 * Also holds the small pure helpers the four screens share: merging an
 * extraction into the draft, the follow-up question for missing fields, the
 * area -> coordinates lookup and the publish call.
 */

import { useSyncExternalStore } from 'react';
import type { Lang } from '@/components/lang';
import { aiProvider } from '@/components/worker/ai-chip';
import { api, saveSession, type DemoUser } from '@/lib/client-api';
import { AREAS } from '@/lib/geo';
import { TRADE_SLUGS, tradeName } from '@/lib/worker/trades';

/* ------------------------------------------------------------------ types ---- */

export type SkillSource = 'speech' | 'photo' | 'stub';

export type DraftSkill = {
  labelEn: string;
  labelUr: string | null;
  confidence: number;
  /** 'photo' = tagged by a live vision model; 'stub' = offline demo tags (kept honest in the DB). */
  source: SkillSource;
};

/** One spoken (or typed) answer. */
export type DraftClip = { textUr: string; textRoman: string; provider: string };

export type PhotoTag = { label: string; confidence: number };

export type DraftPhoto = { url: string; tags: PhotoTag[]; tradeGuess: string | null; provider: string | null };

export type Draft = {
  clips: DraftClip[];
  name: string | null;
  tradeSlug: string | null;
  /** The trade the AI extracted (to label the pre-selected tile honestly). */
  aiTradeSlug: string | null;
  yearsExperience: number | null;
  area: string | null;
  rateMin: number | null;
  rateMax: number | null;
  bioUr: string | null;
  bioEn: string | null;
  skills: DraftSkill[];
  missing: string[];
  extractProvider: string | null;
  photos: DraftPhoto[];
};

/** POST /api/ai/extract-profile `data`. */
export type ExtractedProfile = {
  name: string | null;
  tradeSlug: string | null;
  yearsExperience: number | null;
  area: string | null;
  skills: Array<{ labelEn: string; labelUr: string | null; confidence: number }>;
  rateMin: number | null;
  rateMax: number | null;
  bioUr: string | null;
  bioEn: string | null;
  confidence: number;
  missing: string[];
};

export const EMPTY_DRAFT: Draft = {
  clips: [],
  name: null,
  tradeSlug: null,
  aiTradeSlug: null,
  yearsExperience: null,
  area: null,
  rateMin: null,
  rateMax: null,
  bioUr: null,
  bioEn: null,
  skills: [],
  missing: [],
  extractProvider: null,
  photos: [],
};

/* ------------------------------------------------------------------ store ---- */

const KEY = 'rr.worker.onboarding';
const listeners = new Set<() => void>();
let memRaw: string | null = null;
let lastRaw: string | null | undefined;
let lastVal: Draft = EMPTY_DRAFT;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memRaw;
  } catch {
    return memRaw;
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Tolerant parse: an old or hand-edited value never crashes a screen. */
function normalise(p: Record<string, unknown> | null): Draft {
  if (!p || typeof p !== 'object') return EMPTY_DRAFT;
  return {
    clips: arr<DraftClip>(p.clips).filter((c) => c && typeof c.textUr === 'string'),
    name: str(p.name),
    tradeSlug: validSlug(p.tradeSlug),
    aiTradeSlug: validSlug(p.aiTradeSlug),
    yearsExperience: num(p.yearsExperience),
    area: str(p.area),
    rateMin: num(p.rateMin),
    rateMax: num(p.rateMax),
    bioUr: str(p.bioUr),
    bioEn: str(p.bioEn),
    skills: arr<DraftSkill>(p.skills).filter((s) => s && typeof s.labelEn === 'string'),
    missing: arr<string>(p.missing).filter((m) => typeof m === 'string'),
    extractProvider: str(p.extractProvider),
    photos: arr<DraftPhoto>(p.photos).filter((ph) => ph && typeof ph.url === 'string'),
  };
}

function snapshot(): Draft {
  const raw = readRaw();
  if (raw === lastRaw) return lastVal;
  lastRaw = raw;
  try {
    lastVal = normalise(raw ? (JSON.parse(raw) as Record<string, unknown>) : null);
  } catch {
    lastVal = EMPTY_DRAFT;
  }
  return lastVal;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function write(next: Draft | null) {
  const raw = next ? JSON.stringify(next) : null;
  memRaw = raw;
  try {
    if (raw) window.localStorage.setItem(KEY, raw);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* the draft still holds for this session through memRaw */
  }
  listeners.forEach((l) => l());
}

/** The current draft, read outside render (event handlers, async callbacks). */
export function getDraft(): Draft {
  return typeof window === 'undefined' ? EMPTY_DRAFT : snapshot();
}

/** Applies `fn` to the current draft, stores and returns the result. */
export function updateDraft(fn: (d: Draft) => Draft): Draft {
  const next = fn(getDraft());
  write(next);
  return next;
}

export function clearDraft() {
  write(null);
}

export function useDraft(): Draft {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY_DRAFT);
}

const noop = () => () => {};
/** false on the server render and during hydration, true afterwards (avoids an empty-state flash). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/* ------------------------------------------------------------- transcript ---- */

/** What we send to the extractor: every answer, Urdu script preferred. */
export function transcriptOf(d: Draft): string {
  return d.clips
    .map((c) => (c.textUr.trim() || c.textRoman.trim()))
    .filter(Boolean)
    .join('\n');
}

/** What we show in the "You said" area, in the active script. */
export function spokenText(d: Draft, lang: Lang): string {
  return d.clips
    .map((c) => (lang === 'ur' ? c.textUr.trim() || c.textRoman.trim() : c.textRoman.trim() || c.textUr.trim()))
    .filter(Boolean)
    .join(' … ');
}

export function hasTranscript(d: Draft): boolean {
  return transcriptOf(d).length > 0;
}

export function addClip(clip: DraftClip): Draft {
  return updateDraft((d) => ({ ...d, clips: [...d.clips, clip] }));
}

/* ------------------------------------------------------------- extraction ---- */

function validSlug(v: unknown): string | null {
  return typeof v === 'string' && TRADE_SLUGS.includes(v) ? v : null;
}

const clamp01 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5);

const skillKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Appends `incoming` to `existing`, dropping case-insensitive duplicates (either language). */
export function mergeSkills(existing: DraftSkill[], incoming: DraftSkill[]): DraftSkill[] {
  const seen = new Set<string>();
  for (const s of existing) {
    seen.add(skillKey(s.labelEn));
    if (s.labelUr) seen.add(skillKey(s.labelUr));
  }
  const out = [...existing];
  for (const s of incoming) {
    const en = s.labelEn.trim();
    if (!en) continue;
    const keys = [skillKey(en), ...(s.labelUr ? [skillKey(s.labelUr)] : [])];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    out.push({ ...s, labelEn: en, labelUr: s.labelUr?.trim() || null, confidence: clamp01(s.confidence) });
  }
  return out.slice(0, 40);
}

/**
 * Folds an extraction into the draft.
 *   'all'       the extractor saw the whole interview: its non-null fields win
 *   'fillEmpty' the extractor saw one extra clip: only fill what is still empty
 *   'trade'     the "say another trade" clip: take its trade, fill the rest if empty
 * Skills are always appended (deduplicated).
 */
export function mergeExtraction(
  d: Draft,
  p: ExtractedProfile,
  provider: string | null,
  mode: 'all' | 'fillEmpty' | 'trade',
): Draft {
  const pick = <T>(cur: T | null, next: T | null | undefined): T | null =>
    mode === 'all' ? (next ?? cur) : (cur ?? next ?? null);
  const slug = validSlug(p.tradeSlug);
  const years =
    typeof p.yearsExperience === 'number' && p.yearsExperience >= 0 && p.yearsExperience <= 70
      ? Math.round(p.yearsExperience)
      : null;
  const next: Draft = {
    ...d,
    name: pick(d.name, str(p.name)),
    tradeSlug: mode === 'fillEmpty' ? (d.tradeSlug ?? slug) : (slug ?? d.tradeSlug),
    aiTradeSlug: mode === 'fillEmpty' ? (d.aiTradeSlug ?? slug) : (slug ?? d.aiTradeSlug),
    yearsExperience: pick(d.yearsExperience, years),
    area: pick(d.area, str(p.area)),
    rateMin: pick(d.rateMin, num(p.rateMin)),
    rateMax: pick(d.rateMax, num(p.rateMax)),
    bioUr: pick(d.bioUr, str(p.bioUr)),
    bioEn: pick(d.bioEn, str(p.bioEn)),
    skills: mergeSkills(
      d.skills,
      (p.skills ?? []).map((s) => ({
        labelEn: String(s.labelEn ?? ''),
        labelUr: s.labelUr ?? null,
        confidence: clamp01(s.confidence),
        source: 'speech' as const,
      })),
    ),
    extractProvider: provider ?? d.extractProvider,
  };
  next.missing = missingFields(next);
  return next;
}

/** The fields we still need to ask for, aloud. */
export function missingFields(d: Draft): string[] {
  const out: string[] = [];
  if (!d.tradeSlug) out.push('tradeSlug');
  if (d.yearsExperience === null) out.push('yearsExperience');
  if (!d.area) out.push('area');
  if (!d.name) out.push('name');
  return out;
}

const ASK: Record<Lang, Record<string, string>> = {
  ur: {
    tradeSlug: 'آپ کون سا کام کرتے ہیں؟',
    yearsExperience: 'کتنے سال سے یہ کام کر رہے ہیں؟',
    area: 'آپ کس علاقے میں کام کرتے ہیں؟',
    name: 'آپ کا نام کیا ہے؟',
  },
  rm: {
    tradeSlug: 'Aap kaunsa kaam karte hain?',
    yearsExperience: 'Kitne saal se yeh kaam kar rahe hain?',
    area: 'Aap kis ilaqe mein kaam karte hain?',
    name: 'Aap ka naam kya hai?',
  },
  en: {
    tradeSlug: 'What work do you do?',
    yearsExperience: 'How many years have you done this work?',
    area: 'Which area do you work in?',
    name: 'What is your name?',
  },
};

const ALSO: Record<Lang, string> = { ur: 'یہ بھی بتائیں:', rm: 'Yeh bhi batayein:', en: 'Please also tell us:' };

/** A short spoken follow-up for the first two missing fields ('' if nothing is missing). */
export function followUpQuestion(missing: string[], lang: Lang): string {
  const qs = missing.filter((m) => ASK[lang][m]).slice(0, 2).map((m) => ASK[lang][m]);
  return qs.length ? `${ALSO[lang]} ${qs.join(' ')}` : '';
}

/** POST /api/ai/extract-profile. Throws Error(server message). */
export async function extractProfile(transcript: string): Promise<{ profile: ExtractedProfile; provider: string | null }> {
  const { data, meta } = await api<ExtractedProfile>('/api/ai/extract-profile', {
    method: 'POST',
    body: JSON.stringify({ transcript: transcript.slice(0, 20_000) }),
  });
  return { profile: data, provider: aiProvider(meta) ?? null };
}

/* ----------------------------------------------------------------- photos ---- */

/** POST /api/ai/tag-photo as multipart `image`. */
export async function tagPhoto(image: Blob): Promise<{ tags: PhotoTag[]; tradeGuess: string | null; provider: string | null }> {
  const form = new FormData();
  form.append('image', image, image.type === 'image/png' ? 'work.png' : image.type === 'image/webp' ? 'work.webp' : 'work.jpg');
  const { data, meta } = await api<{ tags: PhotoTag[]; tradeGuess: string | null }>('/api/ai/tag-photo', {
    method: 'POST',
    body: form,
  });
  return {
    tags: (data.tags ?? []).filter((t) => t && typeof t.label === 'string' && t.label.trim()),
    tradeGuess: data.tradeGuess ?? null,
    provider: aiProvider(meta) ?? null,
  };
}

/** Skills a photo's tags contribute: 'photo' for a live model, 'stub' for offline demo tags. */
export function photoSkills(photo: DraftPhoto): DraftSkill[] {
  const source: SkillSource = photo.provider && photo.provider !== 'stub' ? 'photo' : 'stub';
  // A model's "unclear trade work" at 0.1 is shown on the photo, but is not a skill.
  return photo.tags
    .filter((t) => clamp01(t.confidence) >= 0.3)
    .map((t) => ({ labelEn: t.label, labelUr: null, confidence: clamp01(t.confidence), source }));
}

const UPLOADABLE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Phone camera photos are often larger than the 5 MB upload limit (and some are
 * HEIC). Re-encode to a JPEG of at most `maxSide` px; fall back to the original.
 */
export async function shrinkImage(file: Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    if (UPLOADABLE.includes(file.type) && file.size <= 1_500_000) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

/* ------------------------------------------------------------------- skill ---- */

/** A sprite icon for a skill label (squint test: every row has a picture). */
export function skillIcon(s: DraftSkill): string {
  if (s.source !== 'speech') return 'i-cam';
  const l = `${s.labelEn} ${s.labelUr ?? ''}`.toLowerCase();
  if (/wir|cable|conduit|تار|وائر/.test(l)) return 'i-wire';
  if (/fan|پنکھ/.test(l)) return 'i-fan';
  if (/breaker|panel|board|mcb|fuse|بریکر|بورڈ/.test(l)) return 'i-panel';
  if (/geyser|heater|گیزر/.test(l)) return 'i-geyser';
  if (/light|bulb|lamp|لائٹ|بلب/.test(l)) return 'i-bulb';
  if (/ups|battery|inverter|solar|بیٹری/.test(l)) return 'i-batt';
  return 'i-wrench';
}

export function skillLabel(s: DraftSkill, lang: Lang): string {
  return lang === 'ur' && s.labelUr ? s.labelUr : s.labelEn;
}

/* ----------------------------------------------------------------- publish ---- */

/** Typical bands (whole PKR), the middle band from data/seed-data.ts TRADE_RATE_BANDS. */
const TYPICAL_RATE: Record<string, { min: number; max: number }> = {
  electrician: { min: 1200, max: 2500 },
  plumber: { min: 1300, max: 2600 },
  'ac-technician': { min: 2000, max: 4000 },
  carpenter: { min: 1500, max: 3000 },
  mechanic: { min: 1000, max: 2200 },
  painter: { min: 1400, max: 2800 },
  mason: { min: 1500, max: 3000 },
};

/** The rate to publish: his own words if he named one, otherwise the trade's typical band. */
export function rateFor(d: Draft): { min: number; max: number; typical: boolean } {
  const lo = d.rateMin ?? d.rateMax;
  const hi = d.rateMax ?? d.rateMin;
  if (lo !== null && hi !== null && lo > 0) {
    const a = Math.round(Math.min(lo, hi));
    const b = Math.round(Math.max(lo, hi));
    return { min: a, max: b, typical: false };
  }
  const band = (d.tradeSlug && TYPICAL_RATE[d.tradeSlug]) || { min: 1000, max: 2500 };
  return { ...band, typical: true };
}

const DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};
const norm = (s: string) =>
  s
    .replace(/[۰-۹٠-٩]/g, (c) => DIGITS[c] ?? c)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

/** Matches spoken area text against AREAS (name or nameUr, substring either way). */
export function matchArea(area: string | null): (typeof AREAS)[number] | null {
  if (!area) return null;
  const a = norm(area);
  if (a.length < 2) return null;
  let best: { area: (typeof AREAS)[number]; score: number } | null = null;
  for (const x of AREAS) {
    const cands = [x.name, x.name.split(',')[0]!, x.nameUr, x.nameUr.split('،')[0]!].map(norm).filter((c) => c.length >= 2);
    for (const c of cands) {
      // "G-11 Islamabad" containing "g11" is a specific hit; "Rawalpindi" inside a name is a weak one.
      const score = a.includes(c) ? 100 + c.length : c.includes(a) ? a.length : 0;
      if (score > 0 && (!best || score > best.score)) best = { area: x, score };
    }
  }
  return best?.area ?? null;
}

function geolocate(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (v: { lat: number; lng: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          done({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          done(null);
        },
        { timeout: timeoutMs - 500, maximumAge: 10 * 60_000 },
      );
    } catch {
      clearTimeout(timer);
      done(null);
    }
  });
}

const G9 = AREAS[0]!; // G-9, Islamabad (33.6938, 73.0377)

function nearestArea(p: { lat: number; lng: number }) {
  let best = G9;
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = (a.lat - p.lat) ** 2 + (a.lng - p.lng) ** 2;
    if (d < bestD) {
      best = a;
      bestD = d;
    }
  }
  return best;
}

/** area -> coordinates: AREAS match, else the device location, else G-9. */
export async function resolveLocation(
  area: string | null,
): Promise<{ area: string; lat: number; lng: number; via: 'area' | 'gps' | 'default' }> {
  const hit = matchArea(area);
  if (hit) return { area: area!.trim().slice(0, 120), lat: hit.lat, lng: hit.lng, via: 'area' };
  const gps = await geolocate();
  if (gps) return { area: (area?.trim() || nearestArea(gps).name).slice(0, 120), lat: gps.lat, lng: gps.lng, via: 'gps' };
  return { area: (area?.trim() || G9.name).slice(0, 120), lat: G9.lat, lng: G9.lng, via: 'default' };
}

export const DEMO_PHONE = '+923009999999';
export const DEMO_PIN = '0000';

type WorkerRow = {
  id: string;
  name: string;
  phone: string;
  area: string;
  lat?: number;
  lng?: number;
  status?: 'FREE' | 'BUSY' | 'OFF';
  rating?: number;
  jobsCompleted?: number;
  rateMin?: number;
  rateMax?: number;
  tradeSlug?: string;
  tradeNameEn?: string;
  trade?: { slug: string; nameEn: string };
};

function toUser(w: WorkerRow): DemoUser {
  return {
    id: w.id,
    name: w.name,
    phone: w.phone,
    area: w.area,
    ...(typeof w.lat === 'number' ? { lat: w.lat } : {}),
    ...(typeof w.lng === 'number' ? { lng: w.lng } : {}),
    status: w.status,
    rating: w.rating,
    jobsCompleted: w.jobsCompleted,
    tradeSlug: w.trade?.slug ?? w.tradeSlug,
    tradeNameEn: w.trade?.nameEn ?? w.tradeNameEn,
    rateMin: w.rateMin,
    rateMax: w.rateMax,
  };
}

export type PublishStage = 'locating' | 'creating' | 'signing-in' | 'photos';

export class PublishError extends Error {
  constructor(
    message: string,
    public readonly code: 'create' | 'login' | 'photos',
    /** set when the worker exists but the photos failed: retry only the photos */
    public readonly user?: DemoUser,
  ) {
    super(message);
  }
}

/** The JSON body for POST /api/workers (matches createWorkerBody in app/api/workers/route.ts). */
export function buildWorkerBody(d: Draft, name: string, loc: { area: string; lat: number; lng: number }) {
  const rate = rateFor(d);
  const bioUr = d.bioUr?.trim().slice(0, 2000);
  const bioEn = d.bioEn?.trim().slice(0, 2000);
  return {
    name: name.trim().slice(0, 80),
    phone: DEMO_PHONE,
    pin: DEMO_PIN,
    tradeSlug: d.tradeSlug!,
    yearsExperience: Math.min(70, Math.max(0, Math.round(d.yearsExperience ?? 0))),
    area: loc.area,
    lat: loc.lat,
    lng: loc.lng,
    rateMin: rate.min,
    rateMax: rate.max,
    ...(bioUr ? { bioUr } : {}),
    ...(bioEn ? { bioEn } : {}),
    skills: d.skills.slice(0, 40).map((s) => {
      const labelUr = s.labelUr?.trim().slice(0, 120);
      return {
        labelEn: s.labelEn.trim().slice(0, 120),
        ...(labelUr ? { labelUr } : {}),
        source: s.source,
        confidence: clamp01(s.confidence),
      };
    }),
    onboardingTranscript: transcriptOf(d).slice(0, 20_000) || undefined,
    onboardedVia: 'voice' as const,
  };
}

function photosBody(d: Draft) {
  return {
    photos: d.photos.slice(0, 12).map((p) => ({
      url: p.url.slice(0, 2000),
      aiTags: p.tags.slice(0, 20).map((t) => ({ label: t.label.trim().slice(0, 120), confidence: clamp01(t.confidence) })),
      ...(p.provider ? { aiProvider: p.provider.slice(0, 60) } : {}),
    })),
  };
}

/** POST /api/workers/{id}/photos — no-op when there are no photos. */
export async function attachPhotos(user: DemoUser, d: Draft): Promise<void> {
  if (!d.photos.length) return;
  try {
    await api(`/api/workers/${encodeURIComponent(user.id)}/photos`, {
      method: 'POST',
      body: JSON.stringify(photosBody(d)),
    });
  } catch (err) {
    throw new PublishError((err as Error).message || 'Could not add the photos.', 'photos', user);
  }
}

/**
 * Publish: create the worker (or, on 409, sign in to the existing reserved demo
 * account), attach the photos, save the session and clear the draft.
 * Returns the signed-in user and whether the account already existed.
 */
export async function publishDraft(
  d: Draft,
  name: string,
  onStage: (s: PublishStage) => void,
): Promise<{ user: DemoUser; existed: boolean }> {
  onStage('locating');
  const loc = await resolveLocation(d.area);

  onStage('creating');
  let res: Response;
  try {
    res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWorkerBody(d, name, loc)),
    });
  } catch {
    throw new PublishError('Could not reach the server. Check the connection and try again.', 'create');
  }
  let payload: { ok: boolean; data?: WorkerRow; error?: { message?: string } } | null = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON error page */
  }

  let user: DemoUser;
  let existed = false;
  if (res.ok && payload?.ok && payload.data) {
    user = toUser(payload.data);
  } else if (res.status === 409) {
    existed = true;
    onStage('signing-in');
    try {
      const { data } = await api<{ role: string; user: WorkerRow }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: DEMO_PHONE, pin: DEMO_PIN, role: 'worker' }),
      });
      user = toUser(data.user);
    } catch (err) {
      throw new PublishError((err as Error).message || 'Could not sign in.', 'login');
    }
    // Login does not return the rate; the profile does. Best effort.
    try {
      const { data } = await api<WorkerRow>(`/api/workers/${encodeURIComponent(user.id)}`);
      user = { ...user, rateMin: data.rateMin, rateMax: data.rateMax, lat: data.lat, lng: data.lng };
    } catch {
      /* the session works without it */
    }
  } else {
    throw new PublishError(payload?.error?.message || `Could not create the profile (${res.status}).`, 'create');
  }

  onStage('photos');
  await attachPhotos(user, d);

  finishPublish(user);
  return { user, existed };
}

/** Saves the worker session and clears the draft. */
export function finishPublish(user: DemoUser) {
  try {
    saveSession('worker', user);
  } catch {
    /* storage blocked: the home screen falls back to the demo sign-in */
  }
  clearDraft();
}

/* ------------------------------------------------------------- read aloud ---- */

/** "Name: … Work: … 12 years. Area: … Skills: …" in the active language. */
export function profileSpeech(d: Draft, lang: Lang, name: string | null): string {
  const L = {
    ur: { name: 'نام', work: 'کام', yrs: 'سال کا تجربہ', area: 'علاقہ', skills: 'ہنر', sep: '۔ ' },
    rm: { name: 'Naam', work: 'Kaam', yrs: 'saal ka tajurba', area: 'Ilaqa', skills: 'Hunar', sep: '. ' },
    en: { name: 'Name', work: 'Work', yrs: 'years of experience', area: 'Area', skills: 'Skills', sep: '. ' },
  }[lang];
  const parts: string[] = [];
  if (name) parts.push(`${L.name}: ${name}`);
  if (d.tradeSlug) parts.push(`${L.work}: ${tradeName(d.tradeSlug, lang)}`);
  if (d.yearsExperience !== null) parts.push(`${d.yearsExperience} ${L.yrs}`);
  if (d.area) parts.push(`${L.area}: ${d.area}`);
  if (d.skills.length) parts.push(`${L.skills}: ${d.skills.map((s) => skillLabel(s, lang)).join(', ')}`);
  return parts.join(L.sep);
}
