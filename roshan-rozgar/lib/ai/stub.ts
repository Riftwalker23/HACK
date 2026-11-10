/**
 * Deterministic offline provider.
 *
 * This is the reason the backend works on a fresh clone with zero keys, and
 * the reason the demo survives venue wifi. Every capability returns a
 * well-formed, schema-valid result labelled `provider: 'stub'`.
 *
 * HONESTY — what is real here and what is faked:
 *
 *   REAL rule-based work (no model, but genuinely computed from the input):
 *     extractProfile     keyword/regex extraction over the actual transcript
 *     classifyProblem    keyword scoring over data/trades.ts keyword lists
 *     extractPrice       Urdu/Roman number-word + digit parsing
 *     summariseReviews   real arithmetic over the real review rows
 *     translate          a fixed phrase dictionary, then passthrough
 *
 *   FAKED (the input only seeds a deterministic choice — nothing is "understood"):
 *     transcribe         audio bytes are hashed to pick a canned Urdu sentence
 *     tagPhoto           image bytes are hashed to pick canned tags
 *
 * Both faked capabilities need a model to be real; both are labelled, and
 * `transcribe` additionally marks its own output "[demo]" so a stubbed
 * transcript can never be mistaken for a real one further down the pipeline.
 */

import { TRADES, type TradeSeed } from '@/data/trades';
import { AREAS } from '@/lib/geo';
import {
  extractedPrice,
  extractedProfile,
  photoTags,
  problemClassification,
  reviewSummary,
  transcription,
  translation,
  type AiMeta,
  type AiProvider,
  type AiResult,
  type ClassifyProblemInput,
  type ExtractedPrice,
  type ExtractedProfile,
  type PhotoTags,
  type ProblemClassification,
  type ReviewSummary,
  type SummariseReviewsInput,
  type TagPhotoInput,
  type TranscribeInput,
  type Transcription,
  type TranslateInput,
  type Translation,
} from './types';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

function meta(model: string, startedAt: number): AiMeta {
  return { provider: 'stub', model, latencyMs: Date.now() - startedAt, cached: false };
}

// ---------------------------------------------------------------------------
// Text normalisation
//
// Pakistani input arrives in three scripts at once: English, Urdu script, and
// Roman Urdu — often in one sentence. Everything below matches against a single
// normalised form so "geyser", "geezar" and "گیزر" can all land on the plumber.
// ---------------------------------------------------------------------------

const URDU_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Lowercase, Western digits, no diacritics, single spaces. */
function normalise(input: string): string {
  let out = '';
  for (const ch of input) {
    const u = URDU_DIGITS.indexOf(ch);
    if (u >= 0) {
      out += String(u);
      continue;
    }
    const a = ARABIC_DIGITS.indexOf(ch);
    out += a >= 0 ? String(a) : ch;
  }
  return out
    .toLowerCase()
    // Arabic diacritics: speech-to-text output is inconsistent about them.
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[‌‍]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Keyword containment with boundaries. Needed because "ac" must not match
 * inside "pack" and the two-letter Urdu "نل" (tap) must not match inside a
 * longer word — \b is useless for Urdu, so short keywords get an explicit
 * separator class instead.
 */
function hasKeyword(haystack: string, keyword: string): boolean {
  const kw = normalise(keyword);
  if (!kw) return false;

  const isAscii = /^[\x20-\x7e]+$/.test(kw);
  if (isAscii) {
    return new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}([^a-z0-9]|$)`).test(haystack);
  }
  if (kw.length <= 3) {
    return new RegExp(`(^|[\\s،۔,.!?-])${escapeRe(kw)}($|[\\s،۔,.!?-])`).test(haystack);
  }
  return haystack.includes(kw);
}

/** FNV-1a. Any stable hash works; this one needs no imports and no runtime. */
function hash32(bytes: Uint8Array | string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    const b = typeof bytes === 'string' ? bytes.charCodeAt(i) & 0xff : bytes[i]!;
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const pick = <T>(arr: readonly T[], seed: number): T => arr[seed % arr.length]!;

const titleCase = (s: string) =>
  s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ---------------------------------------------------------------------------
// Trade scoring — shared by classifyProblem and extractProfile
// ---------------------------------------------------------------------------

type TradeScore = { trade: TradeSeed; score: number; hits: string[] };

function scoreTrades(text: string): TradeScore[] {
  const hay = normalise(text);

  const scored = TRADES.map((trade) => {
    const hits: string[] = [];
    let score = 0;

    for (const kw of trade.keywords) {
      if (!hasKeyword(hay, kw)) continue;
      hits.push(kw);
      // Multi-word phrases ("short circuit", "not cooling") are far stronger
      // evidence than a single short token, so weight by specificity.
      score += normalise(kw).includes(' ') ? 3 : normalise(kw).length >= 5 ? 2 : 1;
    }

    // Naming the trade outright beats any amount of symptom vocabulary.
    for (const name of [trade.nameEn, trade.nameUr, trade.nameRoman]) {
      if (hasKeyword(hay, name)) {
        score += 5;
        hits.push(name);
      }
    }

    return { trade, score, hits: [...new Set(hits)] };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Urgency + likely fix
// ---------------------------------------------------------------------------

const URGENT_WORDS = [
  'leak', 'leaking', 'leakage', 'burst', 'flood', 'flooding', 'overflow',
  'urgent', 'emergency', 'spark', 'sparking', 'smoke', 'burning', 'short circuit',
  'shock', 'gas smell', 'danger',
  'foran', 'fauran', 'abhi', 'jaldi', 'turant', 'khatra', 'khatarnak', 'aag',
  'dhuan', 'tapak', 'tapak raha', 'bhar gaya', 'band ho gaya',
  'فورا', 'ابھی', 'جلدی', 'خطرہ', 'آگ', 'دھواں', 'ٹپک', 'لیک', 'چنگاری', 'بھر گیا',
];

const RELAXED_WORDS = [
  'next week', 'next month', 'no hurry', 'whenever', 'sometime', 'not urgent',
  'agle hafte', 'agle mahine', 'koi jaldi nahi', 'jab farigh', 'aaram se',
  'اگلے ہفتے', 'اگلے مہینے', 'کوئی جلدی نہیں', 'آرام سے',
];

function detectUrgency(text: string): 'low' | 'normal' | 'urgent' {
  const hay = normalise(text);
  if (RELAXED_WORDS.some((w) => hasKeyword(hay, w))) return 'low';
  if (URGENT_WORDS.some((w) => hasKeyword(hay, w))) return 'urgent';
  return 'normal';
}

/**
 * Symptom -> likely fix. Ordered: the first rule whose words all appear wins.
 * This is what gives the offline demo a useful answer rather than a label.
 */
const LIKELY_FIX: Array<{ all: string[]; fix: string }> = [
  { all: ['geyser'], fix: 'Check the geyser inlet/outlet connections and the washer; a corroded tank or a failed thermostat usually needs replacement, not repair.' },
  { all: ['گیزر'], fix: 'Check the geyser inlet/outlet connections and the washer; a corroded tank or a failed thermostat usually needs replacement, not repair.' },
  { all: ['tap'], fix: 'Replace the tap washer or cartridge; re-seal the threads with PTFE tape.' },
  { all: ['commode'], fix: 'Clear the trap or replace the flush valve and the seat seal.' },
  { all: ['blockage'], fix: 'Rod and flush the drain line, then check the gully trap for a build-up.' },
  { all: ['choked'], fix: 'Rod and flush the drain line, then check the gully trap for a build-up.' },
  { all: ['seepage'], fix: 'Trace the damp source, open the affected section, re-seal the joint and re-plaster.' },
  { all: ['motor'], fix: 'Check the capacitor and the foot valve before condemning the water pump.' },
  { all: ['meter'], fix: 'Inspect the meter terminals and the main breaker; a genuinely faulty meter has to be raised with the utility, not swapped privately.' },
  { all: ['میٹر'], fix: 'Inspect the meter terminals and the main breaker; a genuinely faulty meter has to be raised with the utility, not swapped privately.' },
  { all: ['short circuit'], fix: 'Isolate the circuit, find the damaged section of wiring and re-run it; replace the MCB if it no longer trips cleanly.' },
  { all: ['fan'], fix: 'Replace the fan capacitor first; a seized bearing or a burnt winding means a rewind.' },
  { all: ['socket'], fix: 'Replace the socket and check the termination behind it for loose or burnt conductors.' },
  { all: ['not cooling'], fix: 'Check the gas pressure and clean both coils; a weak compressor or a blocked capillary needs a technician on site.' },
  { all: ['gas refill'], fix: 'Leak-test before refilling — a refill without finding the leak is money thrown away.' },
  { all: ['ac'], fix: 'Service both units, clean the filters and coils, then check gas pressure.' },
  { all: ['deemak'], fix: 'Treat the timber for termite, then replace the sections that have lost strength.' },
  { all: ['دیمک'], fix: 'Treat the timber for termite, then replace the sections that have lost strength.' },
  { all: ['door'], fix: 'Re-align the frame and replace the hinges; plane the leaf if it has swollen.' },
  { all: ['darwaza'], fix: 'Re-align the frame and replace the hinges; plane the leaf if it has swollen.' },
  { all: ['puncture'], fix: 'Patch or replace the tube and check the rim seat.' },
  { all: ['not starting'], fix: 'Test the battery and the starter circuit before opening the engine.' },
  { all: ['brake'], fix: 'Replace the pads or shoes and bleed the brake line.' },
  { all: ['damp patch'], fix: 'Fix the water source first, let the wall dry, then prime with a damp-block primer before repainting.' },
  { all: ['peeling'], fix: 'Scrape back to a sound surface, re-putty, prime, then two coats.' },
  { all: ['crack'], fix: 'Open the crack into a V, fill with a bonding mortar, then re-plaster and cure.' },
  { all: ['tiles'], fix: 'Lift the loose tiles, re-screed the bed and re-fix with tile adhesive, then re-grout.' },
  { all: ['ٹائل'], fix: 'Lift the loose tiles, re-screed the bed and re-fix with tile adhesive, then re-grout.' },
];

const TRADE_DEFAULT_FIX: Record<string, string> = {
  electrician: 'An electrician needs to test the circuit on site to find where the fault sits.',
  plumber: 'A plumber needs to trace the line on site to find the leak or the blockage.',
  'ac-technician': 'An AC technician needs to check gas pressure and airflow on site.',
  carpenter: 'A carpenter needs to see the joint and the timber condition before quoting.',
  mechanic: 'A mechanic needs to run a diagnostic before replacing any part.',
  painter: 'A painter needs to check the surface condition to decide on putty and primer coats.',
  mason: 'A mason needs to see the surface and its substrate before quoting materials.',
};

function likelyFix(top: TradeScore): string {
  const hits = top.hits.map(normalise);
  for (const rule of LIKELY_FIX) {
    if (rule.all.every((w) => hits.some((h) => h === normalise(w)))) return rule.fix;
  }
  return TRADE_DEFAULT_FIX[top.trade.slug] ?? 'A site visit is needed to diagnose this.';
}

// ---------------------------------------------------------------------------
// Urdu / Roman-Urdu number parsing — used by extractPrice and extractProfile
// ---------------------------------------------------------------------------

const UNIT_WORDS: Record<string, number> = {
  ek: 1, aik: 1, ایک: 1,
  do: 2, دو: 2,
  teen: 3, تین: 3,
  char: 4, chaar: 4, چار: 4,
  panch: 5, paanch: 5, paanj: 5, پانچ: 5,
  che: 6, chay: 6, cheh: 6, chhe: 6, چھ: 6, چھے: 6,
  saat: 7, سات: 7,
  aath: 8, ath: 8, آٹھ: 8,
  nau: 9, no: 9, نو: 9,
  das: 10, dus: 10, دس: 10,
  gyarah: 11, گیارہ: 11,
  barah: 12, بارہ: 12,
  terah: 13, تیرہ: 13,
  chaudah: 14, چودہ: 14,
  pandrah: 15, pandra: 15, پندرہ: 15,
  solah: 16, سولہ: 16,
  satrah: 17, سترہ: 17,
  atharah: 18, اٹھارہ: 18,
  unnees: 19, انیس: 19,
  bees: 20, بیس: 20,
  pachees: 25, پچیس: 25,
  tees: 30, تیس: 30,
  chalees: 40, چالیس: 40,
  pachaas: 50, pachas: 50, پچاس: 50,
};

const SCALE_WORDS: Record<string, number> = {
  sau: 100, so: 100, سو: 100,
  hazaar: 1000, hazar: 1000, hazzar: 1000, ہزار: 1000,
  lakh: 100000, lac: 100000, لاکھ: 100000,
  crore: 10000000, karor: 10000000, کروڑ: 10000000,
};

/** "dhai" = 2.5, "derh" = 1.5 — extremely common when quoting a price. */
const SPECIAL_WORDS: Record<string, number> = {
  dhai: 2.5, dhaai: 2.5, ڈھائی: 2.5,
  derh: 1.5, dedh: 1.5, ڈیڑھ: 1.5,
  adha: 0.5, aadha: 0.5, آدھا: 0.5,
};

/** "saarhay teen hazaar" = 3.5 x 1000. The prefix adds a half to what follows. */
const HALF_PREFIX = ['saarhay', 'sarhay', 'sarhe', 'sarha', 'saarhe', 'ساڑھے'];

function tokenise(text: string): string[] {
  return normalise(text)
    // "2,000" must stay one token.
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .split(/[^0-9a-z؀-ۿ]+/)
    .filter(Boolean);
}

const isNumericToken = (t: string) =>
  /^\d+$/.test(t) ||
  t in UNIT_WORDS ||
  t in SCALE_WORDS ||
  t in SPECIAL_WORDS ||
  HALF_PREFIX.includes(t);

/**
 * Evaluates one run of numeric tokens: "do hazaar paanch sau" -> 2500.
 * Scale words multiply whatever unit preceded them and accumulate.
 */
function evaluateRun(tokens: string[]): number {
  let total = 0;
  let unit: number | null = null;
  let half = false;

  for (const t of tokens) {
    if (HALF_PREFIX.includes(t)) {
      half = true;
      continue;
    }
    if (t in SPECIAL_WORDS) {
      unit = SPECIAL_WORDS[t]!;
      continue;
    }
    if (/^\d+$/.test(t)) {
      unit = Number(t) + (half ? 0.5 : 0);
      half = false;
      continue;
    }
    if (t in UNIT_WORDS) {
      unit = UNIT_WORDS[t]! + (half ? 0.5 : 0);
      half = false;
      continue;
    }
    if (t in SCALE_WORDS) {
      total += (unit ?? 1) * SCALE_WORDS[t]!;
      unit = null;
      continue;
    }
  }

  return Math.round(total + (unit ?? 0));
}

/** Every distinct amount the text names, in order of appearance. */
function collectAmounts(text: string): number[] {
  const tokens = tokenise(text);
  const out: number[] = [];

  for (let i = 0; i < tokens.length; ) {
    if (!isNumericToken(tokens[i]!)) {
      i++;
      continue;
    }
    const start = i;
    while (i < tokens.length && isNumericToken(tokens[i]!)) i++;
    const value = evaluateRun(tokens.slice(start, i));
    if (value > 0) out.push(value);
  }

  return out;
}

// ---------------------------------------------------------------------------
// 1. transcribe — FAKED. Hash of the audio picks a canned sentence.
// ---------------------------------------------------------------------------

/**
 * Plausible real answers, so the rest of the offline pipeline (extractProfile,
 * classifyProblem, extractPrice) has genuine input to work on during a demo
 * with no keys. Marked "[demo]" so it is never mistaken for a real transcript.
 */
const DEMO_UTTERANCES: ReadonlyArray<{ ur: string; roman: string }> = [
  {
    ur: 'میرا نام رمضان علی ہے، میں بجلی کا کام کرتا ہوں، دس سال کا تجربہ ہے، جی ۹ اسلام آباد میں رہتا ہوں۔',
    roman: 'mera naam Ramzan Ali hai, main bijli ka kaam karta hoon, das saal ka tajurba hai, G-9 Islamabad mein rehta hoon.',
  },
  {
    ur: 'میرا نام ناصر حسین ہے، میں پلمبر ہوں، آٹھ سال سے کام کر رہا ہوں، صدر راولپنڈی میں، گیزر اور پائپ کا کام کرتا ہوں۔',
    roman: 'mera naam Nasir Hussain hai, main plumber hoon, aath saal se kaam kar raha hoon, Saddar Rawalpindi mein, geyser aur pipe ka kaam karta hoon.',
  },
  {
    ur: 'میرا نام اکرم ہے، میں اے سی کا کام کرتا ہوں، بارہ سال کا تجربہ ہے، ایف ۱۰ اسلام آباد، گیس اور سروس دونوں کرتا ہوں۔',
    roman: 'mera naam Akram hai, main AC ka kaam karta hoon, barah saal ka tajurba hai, F-10 Islamabad, gas aur service dono karta hoon.',
  },
  {
    ur: 'میرا نام شفیق ہے، میں بڑھئی ہوں، پندرہ سال کا تجربہ ہے، آئی ۸ اسلام آباد، الماری اور دروازے بناتا ہوں۔',
    roman: 'mera naam Shafiq hai, main barhai hoon, pandrah saal ka tajurba hai, I-8 Islamabad, almari aur darwaze banata hoon.',
  },
  {
    ur: 'دو ہزار روپے لگیں گے، مٹیریل الگ ہوگا۔',
    roman: 'do hazaar rupay lagenge, material alag hoga.',
  },
  {
    ur: 'میرے گھر کا گیزر لیک کر رہا ہے، پانی ٹپک رہا ہے، فوراً کسی کو بھیج دیں۔',
    roman: 'mere ghar ka geyser leak kar raha hai, paani tapak raha hai, foran kisi ko bhej dein.',
  },
];

function stubTranscribe(input: TranscribeInput): AiResult<Transcription> {
  const started = Date.now();
  const seed = hash32(input.audio);
  const chosen = pick(DEMO_UTTERANCES, seed);

  const result = transcription.parse({
    // The marker is deliberate: a stubbed transcript must announce itself even
    // if someone reads the row straight out of the database.
    textUr: `${chosen.ur} [ڈیمو]`,
    textRoman: `${chosen.roman} [demo]`,
    confidence: 0.5,
  });

  return { result, meta: meta('stub-demo-audio', started) };
}

// ---------------------------------------------------------------------------
// 2. extractProfile — REAL keyword/regex extraction over the transcript
// ---------------------------------------------------------------------------

/** Readable labels for the keywords that make good skill chips. */
const SKILL_LEXICON: Record<string, { en: string; ur: string }> = {
  wiring: { en: 'House wiring', ur: 'وائرنگ' },
  'short circuit': { en: 'Short-circuit fault finding', ur: 'شارٹ سرکٹ' },
  fan: { en: 'Fan repair and installation', ur: 'پنکھا' },
  پنکھا: { en: 'Fan repair and installation', ur: 'پنکھا' },
  ups: { en: 'UPS installation', ur: 'یو پی ایس' },
  generator: { en: 'Generator wiring', ur: 'جنریٹر' },
  meter: { en: 'Meter and breaker work', ur: 'میٹر' },
  میٹر: { en: 'Meter and breaker work', ur: 'میٹر' },
  socket: { en: 'Socket and switchboard work', ur: 'سوئچ بورڈ' },
  سوئچ: { en: 'Socket and switchboard work', ur: 'سوئچ' },
  بجلی: { en: 'Electrical work', ur: 'بجلی کا کام' },
  geyser: { en: 'Geyser installation and repair', ur: 'گیزر' },
  گیزر: { en: 'Geyser installation and repair', ur: 'گیزر' },
  pipe: { en: 'Pipe fitting', ur: 'پائپ فٹنگ' },
  پائپ: { en: 'Pipe fitting', ur: 'پائپ فٹنگ' },
  leak: { en: 'Leak repair', ur: 'لیکیج' },
  tap: { en: 'Tap and faucet work', ur: 'نل' },
  نل: { en: 'Tap and faucet work', ur: 'نل' },
  drain: { en: 'Drain clearing', ur: 'نالی' },
  blockage: { en: 'Drain clearing', ur: 'نالی' },
  commode: { en: 'Commode and flush fitting', ur: 'کموڈ' },
  کموڈ: { en: 'Commode and flush fitting', ur: 'کموڈ' },
  motor: { en: 'Water pump and motor', ur: 'موٹر' },
  'water tank': { en: 'Water tank plumbing', ur: 'ٹینکی' },
  ٹینکی: { en: 'Water tank plumbing', ur: 'ٹینکی' },
  ac: { en: 'AC installation and service', ur: 'اے سی' },
  'اے سی': { en: 'AC installation and service', ur: 'اے سی' },
  'gas refill': { en: 'AC gas refilling', ur: 'گیس ری فل' },
  گیس: { en: 'AC gas refilling', ur: 'گیس ری فل' },
  'ac service': { en: 'AC servicing', ur: 'اے سی سروس' },
  service: { en: 'Servicing', ur: 'سروس' },
  compressor: { en: 'Compressor work', ur: 'کمپریسر' },
  fridge: { en: 'Refrigerator repair', ur: 'فریج' },
  فریج: { en: 'Refrigerator repair', ur: 'فریج' },
  almari: { en: 'Wardrobe making', ur: 'الماری' },
  الماری: { en: 'Wardrobe making', ur: 'الماری' },
  door: { en: 'Door and frame fitting', ur: 'دروازہ' },
  دروازہ: { en: 'Door and frame fitting', ur: 'دروازہ' },
  furniture: { en: 'Furniture making', ur: 'فرنیچر' },
  فرنیچر: { en: 'Furniture making', ur: 'فرنیچر' },
  'kitchen cabinet': { en: 'Kitchen cabinets', ur: 'کچن کیبنٹ' },
  polish: { en: 'Polishing', ur: 'پالش' },
  deemak: { en: 'Termite treatment', ur: 'دیمک' },
  دیمک: { en: 'Termite treatment', ur: 'دیمک' },
  engine: { en: 'Engine work', ur: 'انجن' },
  انجن: { en: 'Engine work', ur: 'انجن' },
  battery: { en: 'Battery and electrics', ur: 'بیٹری' },
  brake: { en: 'Brake work', ur: 'بریک' },
  puncture: { en: 'Puncture repair', ur: 'پنکچر' },
  'oil change': { en: 'Oil change', ur: 'آئل چینج' },
  bike: { en: 'Motorcycle repair', ur: 'موٹر سائیکل' },
  paint: { en: 'Painting', ur: 'پینٹ' },
  پینٹ: { en: 'Painting', ur: 'پینٹ' },
  whitewash: { en: 'Whitewash', ur: 'سفیدی' },
  سفیدی: { en: 'Whitewash', ur: 'سفیدی' },
  putty: { en: 'Putty and surface prep', ur: 'پٹی' },
  emulsion: { en: 'Emulsion paint', ur: 'ایمولشن' },
  tiles: { en: 'Tile fixing', ur: 'ٹائل' },
  ٹائل: { en: 'Tile fixing', ur: 'ٹائل' },
  plaster: { en: 'Plastering', ur: 'پلستر' },
  پلستر: { en: 'Plastering', ur: 'پلستر' },
  marble: { en: 'Marble work', ur: 'ماربل' },
  brick: { en: 'Brickwork', ur: 'اینٹ' },
  اینٹ: { en: 'Brickwork', ur: 'اینٹ' },
  roof: { en: 'Roof repair', ur: 'چھت' },
  چھت: { en: 'Roof repair', ur: 'چھت' },
};

const YEAR_WORDS = ['saal', 'sal', 'years', 'year', 'yrs', 'yr', 'baras', 'سال', 'برس'];

function extractYears(transcript: string): number | null {
  const tokens = tokenise(transcript);

  for (let i = 0; i < tokens.length; i++) {
    if (!YEAR_WORDS.includes(tokens[i]!)) continue;

    // Numbers precede the unit in both Urdu and Roman Urdu ("das saal").
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const start = i - back;
      if (!isNumericToken(tokens[start]!)) continue;
      let from = start;
      while (from > 0 && isNumericToken(tokens[from - 1]!)) from--;
      const value = evaluateRun(tokens.slice(from, i));
      if (value > 0 && value <= 70) return value;
    }
  }
  return null;
}

function extractName(transcript: string): string | null {
  const text = transcript.replace(/\s+/g, ' ').trim();

  const patterns: RegExp[] = [
    /میرا\s+نام\s+([؀-ۿ]+(?:\s+[؀-ۿ]+)?)\s+(?:ہے|ہوں)/u,
    /نام\s+([؀-ۿ]+(?:\s+[؀-ۿ]+)?)\s+(?:ہے|ہوں)/u,
    /\bmera\s+na?am\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:hai|hun|hoon)\b/i,
    /\bmy\s+name\s+is\s+([a-z]+(?:\s+[a-z]+)?)\b/i,
    /\bmain\s+([a-z]+)\s+(?:hun|hoon)\b/i,
  ];

  for (const re of patterns) {
    const m = re.exec(text);
    const raw = m?.[1]?.trim();
    if (!raw) continue;
    // "bijli ka kaam" style phrases follow the same grammar as a name; reject
    // the obvious occupational words rather than storing them as someone's name.
    if (/^(bijli|plumber|ac|pani|kaam|mistri|barhai|painter|mason|mechanic)$/i.test(raw)) continue;
    return /[؀-ۿ]/.test(raw) ? raw : titleCase(raw.toLowerCase());
  }
  return null;
}

/** Candidate spellings for each seeded area, so speech can hit them. */
function areaCandidates(area: (typeof AREAS)[number]): string[] {
  const head = area.name.split(',')[0]!.trim();
  const out = [area.name, area.nameUr, head];

  const sector = /^([a-z])-(\d{1,2})$/i.exec(head);
  if (sector) {
    const [, letter, num] = sector;
    out.push(`${letter}-${num}`, `${letter} ${num}`, `${letter}${num}`);
  }
  return out.map(normalise).filter(Boolean);
}

function extractArea(transcript: string): string | null {
  const hay = normalise(transcript);
  let best: { name: string; len: number } | null = null;

  for (const area of AREAS) {
    for (const candidate of areaCandidates(area)) {
      if (!hasKeyword(hay, candidate)) continue;
      // Longest match wins: "Satellite Town, Rawalpindi" must beat a bare city.
      if (!best || candidate.length > best.len) best = { name: area.name, len: candidate.length };
    }
  }
  return best?.name ?? null;
}

function stubExtractProfile(transcript: string): AiResult<ExtractedProfile> {
  const started = Date.now();

  const ranked = scoreTrades(transcript);
  const top = ranked[0]!;
  const trade = top.score > 0 ? top.trade : null;

  const name = extractName(transcript);
  const years = extractYears(transcript);
  const area = extractArea(transcript);

  // The trade's own name is scored as a hit, but "Plumber" is not a skill.
  const tradeNames = trade
    ? new Set([trade.nameEn, trade.nameUr, trade.nameRoman].map(normalise))
    : new Set<string>();

  const skills = (trade ? top.hits : [])
    .filter((kw) => !tradeNames.has(normalise(kw)))
    .map((kw) => {
      const entry = SKILL_LEXICON[normalise(kw)];
      return entry
        ? { labelEn: entry.en, labelUr: entry.ur, confidence: 0.6 }
        : { labelEn: titleCase(normalise(kw)), labelUr: null, confidence: 0.45 };
    })
    .filter(
      (skill, i, all) => all.findIndex((other) => other.labelEn === skill.labelEn) === i,
    )
    .slice(0, 6);

  // A rate band only exists if he actually said one. Inventing a default here
  // would put a number in front of a customer that no worker ever agreed to.
  const amounts = collectAmounts(transcript).filter((a) => a >= 100);
  const rateMin = amounts.length ? Math.min(...amounts) : null;
  const rateMax = amounts.length ? Math.max(...amounts) : null;

  const bioEn = trade
    ? [
        name ?? 'This worker',
        `is a ${trade.nameEn.toLowerCase()}`,
        years !== null ? `with ${years} years of experience` : null,
        area ? `working in ${area}` : null,
      ]
        .filter(Boolean)
        .join(' ') + '.'
    : null;

  const bioUr = trade
    ? [
        name ?? 'یہ کاریگر',
        `${trade.nameUr} ہیں`,
        years !== null ? `${years} سال کا تجربہ` : null,
        area ? `${area} میں کام کرتے ہیں` : null,
      ]
        .filter(Boolean)
        .join('، ') + '۔'
    : null;

  const missing: string[] = [];
  if (!name) missing.push('name');
  if (!trade) missing.push('tradeSlug');
  if (years === null) missing.push('yearsExperience');
  if (!area) missing.push('area');
  if (!skills.length) missing.push('skills');
  if (rateMin === null) missing.push('rateMin');
  if (rateMax === null) missing.push('rateMax');

  const filled = 7 - missing.length;

  const result = extractedProfile.parse({
    name,
    tradeSlug: trade?.slug ?? null,
    yearsExperience: years,
    area,
    skills,
    rateMin,
    rateMax,
    bioUr,
    bioEn,
    // Rule-based extraction is capped below a model's: never claim certainty.
    confidence: clamp01(0.25 + (filled / 7) * 0.5),
    missing,
  });

  return { result, meta: meta('stub-rules-v1', started) };
}

// ---------------------------------------------------------------------------
// 3. tagPhoto — FAKED. Hash of the image picks from a per-trade vocabulary.
// ---------------------------------------------------------------------------

const PHOTO_TAGS: Record<string, string[]> = {
  electrician: ['switchboard wiring', 'distribution board', 'ceiling fan installation', 'conduit laying', 'MCB replacement', 'socket termination'],
  plumber: ['geyser installation', 'pipe fitting', 'tap replacement', 'drain clearing', 'water tank connection', 'commode installation'],
  'ac-technician': ['split AC indoor unit', 'outdoor unit mounting', 'gas refilling', 'coil cleaning', 'copper line insulation', 'compressor check'],
  carpenter: ['wardrobe carcass', 'door frame fitting', 'kitchen cabinet', 'wood polishing', 'hinge replacement', 'bed headboard'],
  mechanic: ['engine overhaul', 'brake pad change', 'battery terminals', 'puncture repair', 'oil change', 'chain adjustment'],
  painter: ['wall putty work', 'emulsion topcoat', 'ceiling whitewash', 'primer coat', 'enamel on grill', 'damp patch treatment'],
  mason: ['brick wall laying', 'floor tile fixing', 'plaster finishing', 'marble polishing', 'roof waterproofing', 'boundary wall repair'],
};

function stubTagPhoto(input: TagPhotoInput): AiResult<PhotoTags> {
  const started = Date.now();
  const seed = hash32(input.imageBase64);

  const slugs = input.allowedTrades.length
    ? input.allowedTrades.map((t) => t.slug)
    : Object.keys(PHOTO_TAGS);
  const slug = pick(slugs, seed);
  const vocabulary = PHOTO_TAGS[slug] ?? ['trade work'];

  // Rotate a 3-tag window through the vocabulary so different images differ.
  const tags = [0, 1, 2].map((offset) => ({
    label: vocabulary[(seed + offset) % vocabulary.length]!,
    confidence: 0.4,
  }));

  const result = photoTags.parse({
    tags: tags.filter((t, i, all) => all.findIndex((o) => o.label === t.label) === i),
    tradeGuess: slug,
  });

  return { result, meta: meta('stub-demo-vision', started) };
}

// ---------------------------------------------------------------------------
// 4. classifyProblem — REAL keyword scoring. This is what runs offline.
// ---------------------------------------------------------------------------

function stubClassifyProblem(input: ClassifyProblemInput): AiResult<ProblemClassification> {
  const started = Date.now();
  const text = input.text ?? '';

  const ranked = scoreTrades(text);
  const top = ranked[0]!;
  const runnerUp = ranked[1];
  const allowed = new Set(input.allowedTrades.map((t) => t.slug));

  // No usable text (photo-only request): fall back to the commonest household
  // call-out rather than erroring, and say so in the confidence.
  const textless = !text.trim() || top.score === 0;
  const chosen = textless
    ? input.allowedTrades.find((t) => t.slug === 'plumber') ?? input.allowedTrades[0]
    : null;

  const slug = textless ? chosen?.slug ?? 'plumber' : top.trade.slug;

  // A clear winner is worth more than a tie; a tie means the UI should confirm.
  const margin = top.score - (runnerUp?.score ?? 0);
  const confidence = textless
    ? 0.15
    : clamp01(0.35 + Math.min(top.score, 8) * 0.05 + Math.min(margin, 5) * 0.04);

  const result = problemClassification.parse({
    tradeSlug: allowed.size && !allowed.has(slug) ? [...allowed][0]! : slug,
    urgency: detectUrgency(text),
    likelyFix: textless
      ? 'Not enough detail to guess the fault — the customer should describe or photograph the problem.'
      : likelyFix(top),
    keywords: textless ? [] : top.hits.slice(0, 8),
    confidence,
  });

  return { result, meta: meta('stub-rules-v1', started) };
}

// ---------------------------------------------------------------------------
// 5. translate — REAL but tiny: a fixed dictionary, then passthrough.
// ---------------------------------------------------------------------------

/** Urdu -> English for the strings the demo script actually uses. */
const PHRASES: ReadonlyArray<readonly [string, string]> = [
  ['گیزر لیک کر رہا ہے', 'The geyser is leaking'],
  ['پانی ٹپک رہا ہے', 'Water is dripping'],
  ['بجلی کا میٹر خراب ہے', 'The electricity meter is faulty'],
  ['اے سی ٹھنڈا نہیں کر رہا', 'The AC is not cooling'],
  ['پنکھا نہیں چل رہا', 'The fan is not running'],
  ['نل سے پانی نہیں آ رہا', 'There is no water from the tap'],
  ['دروازہ بند نہیں ہو رہا', 'The door will not close'],
  ['میں راستے میں ہوں', 'I am on my way'],
  ['دس منٹ میں پہنچ جاؤں گا', 'I will arrive in ten minutes'],
  ['کام ہو گیا', 'The work is done'],
  ['کام مکمل ہو گیا ہے', 'The work is complete'],
  ['مٹیریل الگ ہوگا', 'Material will be charged separately'],
  ['مٹیریل شامل ہے', 'Material is included'],
  ['کل آ جاؤں؟', 'Shall I come tomorrow?'],
  ['کتنے پیسے لگیں گے؟', 'How much will it cost?'],
  ['دو ہزار روپے لگیں گے', 'It will cost two thousand rupees'],
  ['ٹھیک ہے', 'That is fine'],
  ['شکریہ', 'Thank you'],
  ['معاف کیجیے', 'Sorry'],
  ['فوراً آئیں', 'Please come immediately'],
  ['کام اچھا تھا', 'The work was good'],
  ['وقت پر آئے', 'He arrived on time'],
  ['صفائی سے کام کیا', 'He worked cleanly'],
];

function stubTranslate(input: TranslateInput): AiResult<Translation> {
  const started = Date.now();

  // Never throw: a failed translation must degrade to the original words, not
  // to an empty chat bubble.
  let text = input.text;

  if (input.from !== input.to) {
    const pairs = input.from === 'ur' ? PHRASES : PHRASES.map(([ur, en]) => [en, ur] as const);
    const needle = normalise(input.text);

    const exact = pairs.find(([src]) => normalise(src) === needle);
    if (exact) {
      text = exact[1];
    } else {
      // Longest phrases first so a long match is not pre-empted by a short one.
      let working = input.text;
      for (const [src, dst] of [...pairs].sort((a, b) => b[0].length - a[0].length)) {
        if (!src) continue;
        const re = new RegExp(escapeRe(src), 'gi');
        working = working.replace(re, dst);
      }
      text = working;
    }
  }

  const result = translation.parse({ text });
  return { result, meta: meta('stub-phrasebook', started) };
}

// ---------------------------------------------------------------------------
// 6. extractPrice — REAL Urdu/Roman number parsing.
// ---------------------------------------------------------------------------

const UNIT_HINTS: ReadonlyArray<{ unit: string; words: string[] }> = [
  { unit: 'hour', words: ['per hour', 'hourly', 'ghanta', 'ghantay', 'ghante', 'ghanty', 'گھنٹہ', 'گھنٹے', 'فی گھنٹہ'] },
  { unit: 'day', words: ['per day', 'daily', 'din ka', 'din ke', 'roz', 'rozana', 'dihari', 'dihaari', 'dehari', 'دیہاڑی', 'روزانہ', 'دن کا', 'فی دن'] },
  { unit: 'visit', words: ['per visit', 'visit', 'chakkar', 'phera', 'pheyra', 'وزٹ', 'چکر'] },
  { unit: 'per_point', words: ['per point', 'point', 'points', 'پوائنٹ', 'فی پوائنٹ'] },
  { unit: 'month', words: ['per month', 'monthly', 'mahina', 'mahine ka', 'ماہانہ', 'مہینے کا'] },
];

const MATERIAL_EXCLUDED = [
  'material alag', 'material separate', 'material nahi', 'material apna', 'saman alag',
  'samaan alag', 'saamaan alag', 'مٹیریل الگ', 'سامان الگ', 'میٹریل الگ', 'مال الگ',
];

const MATERIAL_INCLUDED = [
  'material shamil', 'material included', 'including material', 'with material',
  'saman shamil', 'sab kuch shamil', 'مٹیریل شامل', 'سامان شامل', 'سب کچھ شامل', 'میٹریل شامل',
];

const RANGE_TOKENS = ['se', 'tak', 'ya', 'or', 'to', 'سے', 'تک', 'یا'];

const HEDGE_WORDS = [
  'takreeban', 'taqreeban', 'approx', 'approximately', 'around', 'about',
  'andaza', 'lagbhag', 'shayad', 'maybe', 'ho sakta', 'dekh kar',
  'تقریبا', 'اندازہ', 'شاید', 'ہو سکتا', 'دیکھ کر',
];

function stubExtractPrice(transcript: string): AiResult<ExtractedPrice> {
  const started = Date.now();
  const hay = normalise(transcript);
  const tokens = tokenise(transcript);

  const all = collectAmounts(transcript);
  // Below 50 PKR is a count ("do kamray"), not a price, when a real price exists.
  const priced = all.filter((a) => a >= 50);
  const candidates = priced.length ? priced : all;

  const amount = candidates.length ? Math.min(...candidates) : null;

  const unit = amount === null
    ? null
    : UNIT_HINTS.find((h) => h.words.some((w) => hasKeyword(hay, w)))?.unit ?? 'job';

  const includes: string[] = ['labour'];
  if (MATERIAL_INCLUDED.some((w) => hay.includes(normalise(w)))) includes.push('material');
  if (UNIT_HINTS[2]!.words.some((w) => hasKeyword(hay, w)) && unit !== 'visit') {
    includes.push('visit');
  }

  // A range or a hedge is exactly the case where the UI must ask again rather
  // than write a number into the job record.
  const hasRange =
    new Set(candidates).size > 1 && tokens.some((t) => RANGE_TOKENS.includes(t));
  const hedged = HEDGE_WORDS.some((w) => hasKeyword(hay, w));
  const ambiguous = amount === null || hasRange || hedged || new Set(candidates).size > 1;

  const result = extractedPrice.parse({
    amount,
    unit,
    includes,
    ambiguous,
    confidence: amount === null ? 0.15 : ambiguous ? 0.45 : 0.7,
  });

  return { result, meta: meta('stub-rules-v1', started) };
}

// ---------------------------------------------------------------------------
// 7. summariseReviews — REAL arithmetic over the real rows.
// ---------------------------------------------------------------------------

const TAG_LEXICON: Record<string, { en: string; ur: string }> = {
  on_time: { en: 'arrived on time', ur: 'وقت پر آئے' },
  punctual: { en: 'arrived on time', ur: 'وقت پر آئے' },
  clean_work: { en: 'left the work clean', ur: 'صفائی سے کام کیا' },
  tidy: { en: 'left the work clean', ur: 'صفائی سے کام کیا' },
  fair_price: { en: 'charged a fair price', ur: 'مناسب قیمت لی' },
  honest_price: { en: 'charged a fair price', ur: 'مناسب قیمت لی' },
  polite: { en: 'was polite', ur: 'مہذب تھے' },
  skilled: { en: 'knew the work', ur: 'کام جانتے ہیں' },
  fast: { en: 'worked fast', ur: 'تیز کام کیا' },
  explained_well: { en: 'explained the problem', ur: 'مسئلہ سمجھایا' },
  late: { en: 'arrived late', ur: 'دیر سے آئے' },
  messy: { en: 'left a mess', ur: 'گندگی چھوڑی' },
  expensive: { en: 'charged more than quoted', ur: 'زیادہ پیسے لیے' },
  rushed: { en: 'rushed the job', ur: 'جلدی میں کام کیا' },
  no_show: { en: 'did not turn up', ur: 'نہیں آئے' },
};

const NEGATIVE_TAGS = new Set(['late', 'messy', 'expensive', 'rushed', 'no_show']);

const humaniseTag = (tag: string) =>
  TAG_LEXICON[tag.toLowerCase()]?.en ?? tag.replace(/[_-]+/g, ' ').trim().toLowerCase();

const humaniseTagUr = (tag: string) =>
  TAG_LEXICON[tag.toLowerCase()]?.ur ?? tag.replace(/[_-]+/g, ' ').trim();

function stubSummariseReviews(input: SummariseReviewsInput): AiResult<ReviewSummary> {
  const started = Date.now();
  const { reviews, tradeNameEn } = input;
  const count = reviews.length;

  if (count === 0) {
    const empty = reviewSummary.parse({
      summaryEn: `No reviews yet for this ${tradeNameEn.toLowerCase()}. Nothing has been verified by a previous customer.`,
      summaryUr: 'ابھی کوئی رائے موجود نہیں۔ کسی سابقہ گاہک نے تصدیق نہیں کی۔',
      sourceReviewCount: 0,
      strengths: [],
      cautions: ['No reviews yet — nothing has been verified by a previous customer.'],
    });
    return { result: empty, meta: meta('stub-aggregate', started) };
  }

  const average = reviews.reduce((sum, r) => sum + r.stars, 0) / count;
  const rounded = Math.round(average * 10) / 10;
  const lowRated = reviews.filter((r) => r.stars <= 2).length;

  const frequency = new Map<string, number>();
  for (const review of reviews) {
    for (const tag of new Set(review.tags.map((t) => t.toLowerCase().trim()))) {
      if (tag) frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
    }
  }
  const ordered = [...frequency.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  const strengths = ordered
    .filter(([tag]) => !NEGATIVE_TAGS.has(tag))
    .slice(0, 3)
    .map(([tag, n]) => `${humaniseTag(tag)} (${n} of ${count})`);

  const cautions = ordered
    .filter(([tag]) => NEGATIVE_TAGS.has(tag))
    .slice(0, 3)
    .map(([tag, n]) => `${humaniseTag(tag)} (${n} of ${count})`);

  if (lowRated > 0) {
    cautions.push(`${lowRated} of ${count} customers rated 2 stars or lower.`);
  }
  if (count < 3) {
    // Provenance is the point of this summary; a thin sample must say so.
    cautions.push(`Based on only ${count} review${count === 1 ? '' : 's'} so far.`);
  }

  const strengthText = strengths.length
    ? ` Customers most often say the worker ${ordered
        .filter(([tag]) => !NEGATIVE_TAGS.has(tag))
        .slice(0, 2)
        .map(([tag]) => humaniseTag(tag))
        .join(' and ')}.`
    : ' No repeated themes in the tags yet.';

  const summaryEn =
    `Across ${count} review${count === 1 ? '' : 's'}, this ${tradeNameEn.toLowerCase()} ` +
    `averages ${rounded} out of 5.${strengthText}` +
    (lowRated ? ` ${lowRated} review${lowRated === 1 ? '' : 's'} rated 2 stars or lower.` : '');

  const strengthTextUr = strengths.length
    ? ` گاہک زیادہ تر کہتے ہیں: ${ordered
        .filter(([tag]) => !NEGATIVE_TAGS.has(tag))
        .slice(0, 2)
        .map(([tag]) => humaniseTagUr(tag))
        .join('، ')}۔`
    : ' ابھی کوئی واضح رجحان نہیں۔';

  const summaryUr =
    `${count} رائے کی بنیاد پر، اوسط درجہ بندی ${rounded} از ۵ ہے۔${strengthTextUr}` +
    (lowRated ? ` ${lowRated} گاہکوں نے ۲ یا کم ستارے دیے۔` : '');

  const result = reviewSummary.parse({
    summaryEn,
    summaryUr,
    sourceReviewCount: count,
    strengths,
    cautions,
  });

  return { result, meta: meta('stub-aggregate', started) };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const provider: AiProvider = {
  name: 'stub',
  // Always available. It is the floor of the provider chain in lib/ai/index.ts.
  available: true,

  transcribe: async (input) => stubTranscribe(input),
  extractProfile: async (transcript) => stubExtractProfile(transcript),
  tagPhoto: async (input) => stubTagPhoto(input),
  classifyProblem: async (input) => stubClassifyProblem(input),
  translate: async (input) => stubTranslate(input),
  extractPrice: async (transcript) => stubExtractPrice(transcript),
  summariseReviews: async (input) => stubSummariseReviews(input),
};

export default provider;
