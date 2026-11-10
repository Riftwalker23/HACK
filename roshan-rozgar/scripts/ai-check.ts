/**
 * AI capability check — "is the AI real, and is it right in Urdu?"
 *
 *   npx tsx scripts/ai-check.ts                 # report what served each call
 *   npx tsx scripts/ai-check.ts --require-real  # fail if anything was stubbed
 *
 * The brief penalises presenting mocked functionality as working, so this
 * script answers two separate questions and never conflates them:
 *
 *   1. CORRECTNESS — did the call return, validate against its zod schema in
 *      lib/ai/types.ts, and satisfy the semantic assertion for that capability?
 *      These assertions are about Urdu and Roman Urdu meaning, not shape.
 *   2. PROVENANCE — did a REAL provider serve it, or the deterministic stub?
 *      Reported on its own line per capability. With no API key present the
 *      stub answers everything; that is a designed, disclosed fallback, so the
 *      run still exits 0. `--require-real` is the gate to run once keys exist:
 *      under it every stubbed capability is a failure.
 *
 * Two capabilities (transcribe, tagPhoto) are acknowledged fakes in the stub —
 * it hashes the bytes to pick a canned answer. They are labelled STUB-FAKE so
 * nobody reads a green row as working ASR or vision.
 *
 * CACHE: lib/ai/cache.ts is content-addressed, and a cached row would make the
 * latency column meaningless. Every input below therefore carries a per-run
 * nonce so `cacheKey` differs on every run. The nonce is built from consonants
 * only, so it cannot accidentally form a keyword ("ac", "do", "se", "mcb") that
 * the classifier or the price parser would score.
 */

import {
  classifyProblem,
  extractPrice,
  extractProfile,
  extractedPrice,
  extractedProfile,
  photoTags,
  problemClassification,
  providerStatus,
  reviewSummary,
  summariseReviews,
  tagPhoto,
  transcribe,
  transcription,
  translate,
  translation,
  type AiMeta,
  type Capability,
} from '@/lib/ai';
import { hasAnthropic, hasGemini, hasOpenAI } from '@/lib/env';
import { inflateSync } from 'node:zlib';
import type { ZodType } from 'zod';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const REQUIRE_REAL =
  argv.includes('--require-real') || process.env.AI_CHECK_REQUIRE_REAL === '1';

const KEYS = {
  ANTHROPIC_API_KEY: hasAnthropic(),
  OPENAI_API_KEY: hasOpenAI(),
  GEMINI_API_KEY: hasGemini(),
};
const MISSING_KEYS = Object.entries(KEYS)
  .filter(([, present]) => !present)
  .map(([name]) => name);
const ANY_KEY = Object.values(KEYS).some(Boolean);

// ---------------------------------------------------------------------------
// Nonce — cache busting that cannot change meaning
// ---------------------------------------------------------------------------

/** Consonants only: no vowel means no accidental keyword. */
const NONCE_ALPHABET = 'qwrtzxvbnmkgh';

function makeNonce(length = 7): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += NONCE_ALPHABET[Math.floor(Math.random() * NONCE_ALPHABET.length)];
  }
  return out;
}

const NONCE = makeNonce();
/** Appended as a bare trailing token, never inside the phrase under test. */
const salt = (text: string) => `${text} ${NONCE}`;

// ---------------------------------------------------------------------------
// Synthetic media — generated in-process, nothing on disk, nothing downloaded
// ---------------------------------------------------------------------------

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A real 16-bit PCM mono WAV. A seeded tone, so each run's bytes differ. */
function makeWav(seed: number, samples = 2_000): Uint8Array {
  const sampleRate = 8_000;
  const dataBytes = samples * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);

  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) out[offset + i] = text.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);

  const freq = 180 + (seed % 400);
  for (let i = 0; i < samples; i++) {
    const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 6_000;
    view.setInt16(44 + i * 2, Math.round(s), true);
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }
  return ((b << 16) | a) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * A genuinely valid truecolor PNG. The deflate stream uses STORED blocks, which
 * needs no compressor — this script must not add a dependency. `width` varies
 * per run so that both the image length and its first bytes differ, which is
 * what the tagPhoto cache key is derived from.
 */
function makePng(width: number, height: number, seed: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const iv = new DataView(ihdr.buffer);
  iv.setUint32(0, width);
  iv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolor RGB
  // Bytes 10-12 (deflate / adaptive filtering / no interlace) are all zero.

  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);
  let s = seed >>> 0;
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // per-scanline filter: none
    for (let x = 0; x < width * 3; x++) {
      s = (Math.imul(s, 1_103_515_245) + 12_345) >>> 0;
      raw[y * stride + 1 + x] = (s >>> 16) & 0xff;
    }
  }

  const blocks: Uint8Array[] = [];
  for (let off = 0; off < raw.length; off += 65_535) {
    const slice = raw.subarray(off, Math.min(off + 65_535, raw.length));
    const head = new Uint8Array(5);
    head[0] = off + 65_535 >= raw.length ? 1 : 0; // BFINAL, BTYPE=00 (stored)
    head[1] = slice.length & 0xff;
    head[2] = (slice.length >>> 8) & 0xff;
    head[3] = ~slice.length & 0xff;
    head[4] = (~slice.length >>> 8) & 0xff;
    blocks.push(head, slice);
  }
  const body = concat(blocks);
  const zlib = new Uint8Array(2 + body.length + 4);
  zlib[0] = 0x78;
  zlib[1] = 0x01;
  zlib.set(body, 2);
  new DataView(zlib.buffer).setUint32(2 + body.length, adler32(raw));

  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * The stub never decodes the media it is handed, so a malformed WAV or PNG
 * would sail through a keyless run and only blow up the first time a real
 * provider is wired in. Decode them here instead, with node's own zlib.
 */
function verifyFixtures(): string {
  const problems: string[] = [];

  const wav = makeWav(1234, 2_000);
  const wavView = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const tag = (offset: number) =>
    String.fromCharCode(...wav.subarray(offset, offset + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(36) !== 'data') {
    problems.push('WAV: RIFF/WAVE/data markers wrong');
  }
  if (wavView.getUint32(4, true) !== wav.length - 8) problems.push('WAV: RIFF size wrong');
  if (wavView.getUint32(40, true) !== wav.length - 44) problems.push('WAV: data size wrong');
  if (wavView.getUint16(34, true) !== 16) problems.push('WAV: bit depth wrong');

  const width = 14;
  const height = 10;
  const png = makePng(width, height, 1234);
  if (
    png[0] !== 0x89 ||
    String.fromCharCode(...png.subarray(1, 4)) !== 'PNG' ||
    String.fromCharCode(...png.subarray(12, 16)) !== 'IHDR'
  ) {
    problems.push('PNG: signature or IHDR missing');
  }
  try {
    // IDAT begins after the 8-byte signature and the 25-byte IHDR chunk.
    const idatLength = new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(33);
    const idat = png.subarray(41, 41 + idatLength);
    const raw = inflateSync(Buffer.from(idat));
    const expected = height * (width * 3 + 1);
    if (raw.length !== expected) {
      problems.push(`PNG: inflated to ${raw.length} bytes, expected ${expected}`);
    }
  } catch (err) {
    problems.push(`PNG: zlib stream invalid (${(err as Error).message})`);
  }

  return problems.length
    ? `INVALID — ${problems.join('; ')}`
    : `valid (WAV ${wav.length} B PCM16 mono 8 kHz; PNG ${width}x${height} truecolor, zlib round-trips)`;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type Status = 'PASS' | 'FAIL' | 'SKIP' | 'STUB-FAKE';

type Row = {
  capability: Capability;
  label: string;
  provider: string;
  model: string;
  cached: boolean;
  wallMs: number;
  status: Status;
  detail: string;
  fallbackReason?: string;
};

const rows: Row[] = [];

/** The semantic verdict a check returns, before provenance is applied. */
type Verdict = { ok: boolean; detail: string };

const ok = (detail: string): Verdict => ({ ok: true, detail });
const bad = (detail: string): Verdict => ({ ok: false, detail });

type Check<T> = {
  capability: Capability;
  label: string;
  schema: ZodType<T>;
  run: () => Promise<{ result: T; meta: AiMeta }>;
  assert: (value: T) => Verdict;
  /**
   * How to report a stub-served row:
   *   'assert'    — the stub is expected to get this right (rule-based work).
   *   'fake'      — the stub only hashes its input; label STUB-FAKE.
   *   'skip'      — the stub cannot do this honestly; label SKIP.
   */
  whenStubbed: 'assert' | 'fake' | 'skip';
};

async function execute<T>(check: Check<T>): Promise<void> {
  const started = Date.now();
  let out: { result: T; meta: AiMeta };

  try {
    out = await check.run();
  } catch (err) {
    rows.push({
      capability: check.capability,
      label: check.label,
      provider: 'none',
      model: '-',
      cached: false,
      wallMs: Date.now() - started,
      status: 'FAIL',
      detail: `call threw: ${(err as Error)?.message ?? String(err)}`,
    });
    return;
  }

  const wallMs = Date.now() - started;
  const stubbed = out.meta.provider === 'stub';

  // Schema validation is non-negotiable for every provider, stub included: a
  // malformed result would break the route handler regardless of who produced it.
  const parsed = check.schema.safeParse(out.result);
  let status: Status;
  let detail: string;

  if (!parsed.success) {
    status = 'FAIL';
    detail = `schema: ${parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
      .join('; ')}`;
  } else if (stubbed && check.whenStubbed === 'fake') {
    const verdict = check.assert(parsed.data);
    status = verdict.ok ? 'STUB-FAKE' : 'FAIL';
    detail = verdict.ok
      ? `schema ok, shape ok — but the stub HASHES its input to pick a canned answer. Not real ASR/vision. ${verdict.detail}`
      : verdict.detail;
  } else if (stubbed && check.whenStubbed === 'skip') {
    const verdict = check.assert(parsed.data);
    status = 'SKIP';
    detail = `stub translator is substitution-only, so this assertion is not meaningful here (would have been ${
      verdict.ok ? 'PASS' : 'FAIL'
    }: ${verdict.detail})`;
  } else {
    const verdict = check.assert(parsed.data);
    status = verdict.ok ? 'PASS' : 'FAIL';
    detail = verdict.detail;
  }

  rows.push({
    capability: check.capability,
    label: check.label,
    provider: out.meta.provider,
    model: out.meta.model ?? '-',
    cached: out.meta.cached === true,
    wallMs,
    status,
    detail,
    fallbackReason: out.meta.fallbackReason,
  });
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

const PROFILE_TRANSCRIPT =
  'میرا نام اسلم خان ہے۔ میں بجلی کا کام کرتا ہوں۔ پندرہ سال کا تجربہ ہے۔ ' +
  'جی ۹ اسلام آباد میں رہتا ہوں۔ میٹر، سوئچ بورڈ اور پنکھے کا کام کرتا ہوں۔';

const REVIEWS = [
  { stars: 5, tags: ['on_time', 'clean_work'], text: 'بہت اچھا کام کیا، وقت پر آئے۔' },
  { stars: 4, tags: ['on_time', 'fair_price'], text: 'theek kaam kiya, paisay munasib thay.' },
  { stars: 2, tags: ['late', 'expensive'], text: 'Arrived two hours late and charged more than quoted.' },
];

/** classifyProblem — the four assertions from the brief, Urdu + Roman + English. */
const CLASSIFY_CASES: Array<{ text: string; expect: string }> = [
  { text: 'mera geyser leak kar raha hai', expect: 'plumber' },
  { text: 'بجلی کا میٹر خراب ہے', expect: 'electrician' },
  { text: 'AC thanda nahi kar raha', expect: 'ac-technician' },
  { text: 'darwaza toot gaya hai', expect: 'carpenter' },
];

type PriceCase = {
  text: string;
  amount?: number | null;
  ambiguous?: boolean;
  /** Why this case is in the list, printed next to a failure. */
  note: string;
};

const PRICE_CASES: PriceCase[] = [
  // The five assertions named in the brief.
  { text: 'do hazaar rupay lagenge, material alag', amount: 2_000, note: 'Roman Urdu, material excluded' },
  { text: 'دو ہزار روپے', amount: 2_000, note: 'Urdu script number words' },
  { text: 'pandrah sau', amount: 1_500, note: 'compound: 15 x 100' },
  { text: 'dhai hazaar', amount: 2_500, note: 'dhai = 2.5' },
  { text: 'teen se chaar hazaar', ambiguous: true, note: 'range; the scale belongs to both bounds' },
  // Additional coverage the stub is required to handle.
  { text: 'teen hazaar paanch sau', amount: 3_500, ambiguous: false, note: 'compound: 3000 + 500' },
  { text: 'saarhay teen hazaar', amount: 3_500, ambiguous: false, note: 'saarhay = x + 0.5' },
  { text: 'paune do hazaar', amount: 1_750, ambiguous: false, note: 'paune = x - 0.25' },
  { text: 'sawa do hazaar', amount: 2_250, ambiguous: false, note: 'sawa = x + 0.25' },
  { text: 'derh hazaar', amount: 1_500, ambiguous: false, note: 'derh = 1.5' },
  { text: 'aadha hazaar', amount: 500, ambiguous: false, note: 'aadha = 0.5' },
  { text: 'ایک لاکھ', amount: 100_000, ambiguous: false, note: 'lakh in Urdu script' },
  { text: '۱۵۰۰ روپے', amount: 1_500, ambiguous: false, note: 'Urdu-Indic digits ۱۲۳' },
  { text: '٢٠٠٠ روپے', amount: 2_000, ambiguous: false, note: 'Arabic-Indic digits ٠١٢٣' },
  { text: 'do se teen hazaar', amount: 2_000, ambiguous: true, note: 'range, lower bound 2000' },
  { text: '2000-3000', amount: 2_000, ambiguous: true, note: 'written range' },
  { text: 'takreeban do hazaar', amount: 2_000, ambiguous: true, note: 'hedged quote' },
];

function buildChecks(): Array<() => Promise<void>> {
  const queue: Array<() => Promise<void>> = [];

  // 1. transcribe — synthetic WAV, generated here. Acknowledged fake in the stub.
  queue.push(() =>
    execute({
      capability: 'transcribe',
      label: 'synthetic 0.25s WAV (ur)',
      schema: transcription,
      whenStubbed: 'fake',
      run: () =>
        transcribe({
          audio: makeWav(crc32(new TextEncoder().encode(NONCE))),
          mimeType: 'audio/wav',
          language: 'ur',
        }),
      assert: (t) =>
        t.textUr.trim() && t.textRoman.trim()
          ? ok(`textUr ${t.textUr.length} chars, confidence ${t.confidence}`)
          : bad('textUr or textRoman was empty'),
    }),
  );

  // 2. extractProfile — real rule-based work in the stub, so it must be right.
  queue.push(() =>
    execute({
      capability: 'extractProfile',
      label: 'Urdu: electrician, 15 years, G-9',
      schema: extractedProfile,
      whenStubbed: 'assert',
      run: () => extractProfile(salt(PROFILE_TRANSCRIPT)),
      assert: (p) => {
        const problems: string[] = [];
        if (p.tradeSlug !== 'electrician') problems.push(`tradeSlug=${p.tradeSlug} want electrician`);
        if (p.yearsExperience !== 15) problems.push(`yearsExperience=${p.yearsExperience} want 15`);
        if (!p.skills.length) problems.push('skills was empty');
        // Loose on purpose: a real model may phrase the sector differently, but
        // losing it entirely means the worker is unsearchable by distance.
        if (!p.area || !p.area.includes('9')) problems.push(`area=${p.area} want the G-9 sector`);
        return problems.length
          ? bad(problems.join('; '))
          : ok(`electrician / 15y / ${p.skills.length} skills / area=${p.area ?? 'null'}`);
      },
    }),
  );

  // 3. tagPhoto — synthetic PNG, generated here. Acknowledged fake in the stub.
  queue.push(() => {
    const seed = crc32(new TextEncoder().encode(NONCE));
    const png = makePng(12 + (seed % 9), 10, seed);
    return execute({
      capability: 'tagPhoto',
      label: 'synthetic truecolor PNG',
      schema: photoTags,
      whenStubbed: 'fake',
      run: () =>
        tagPhoto({
          imageBase64: Buffer.from(png).toString('base64'),
          imageMimeType: 'image/png',
        }),
      assert: (p) =>
        p.tags.length
          ? ok(`${p.tags.length} tags, tradeGuess=${p.tradeGuess ?? 'null'}`)
          : bad('tags was empty'),
    });
  });

  // 4. classifyProblem — four semantic assertions, reported individually.
  for (const testCase of CLASSIFY_CASES) {
    queue.push(() =>
      execute({
        capability: 'classifyProblem',
        label: `"${testCase.text}" -> ${testCase.expect}`,
        schema: problemClassification,
        whenStubbed: 'assert',
        run: () => classifyProblem({ text: salt(testCase.text) }),
        assert: (c) =>
          c.tradeSlug === testCase.expect
            ? ok(`${c.tradeSlug}, urgency=${c.urgency}, confidence=${c.confidence.toFixed(2)}`)
            : bad(`tradeSlug=${c.tradeSlug} want ${testCase.expect}`),
      }),
    );
  }

  // 5. translate — a hard FAIL on a real provider, SKIP on the substitution stub.
  const urPhrase = 'گیزر لیک کر رہا ہے';
  const enPhrase = 'The geyser is leaking';

  queue.push(() =>
    execute({
      capability: 'translate',
      label: 'ur -> en',
      schema: translation,
      whenStubbed: 'skip',
      run: () => translate({ text: salt(urPhrase), from: 'ur', to: 'en' }),
      assert: (t) => {
        if (!t.text.trim()) return bad('empty translation');
        if (t.text === salt(urPhrase)) return bad('returned the input unchanged');
        return ok(`"${t.text}"`);
      },
    }),
  );

  queue.push(() =>
    execute({
      capability: 'translate',
      label: 'en -> ur',
      schema: translation,
      whenStubbed: 'skip',
      run: () => translate({ text: salt(enPhrase), from: 'en', to: 'ur' }),
      assert: (t) => {
        if (!t.text.trim()) return bad('empty translation');
        if (t.text === salt(enPhrase)) return bad('returned the input unchanged');
        return ok(`"${t.text}"`);
      },
    }),
  );

  // 6. extractPrice — every case reported individually.
  for (const testCase of PRICE_CASES) {
    queue.push(() =>
      execute({
        capability: 'extractPrice',
        label: `"${testCase.text}"`,
        schema: extractedPrice,
        whenStubbed: 'assert',
        run: () => extractPrice(salt(testCase.text)),
        assert: (p) => {
          const problems: string[] = [];
          if (testCase.amount !== undefined && p.amount !== testCase.amount) {
            problems.push(`amount=${p.amount} want ${testCase.amount}`);
          }
          if (testCase.ambiguous !== undefined && p.ambiguous !== testCase.ambiguous) {
            problems.push(`ambiguous=${p.ambiguous} want ${testCase.ambiguous}`);
          }
          const seen = `amount=${p.amount} unit=${p.unit} ambiguous=${p.ambiguous} includes=[${p.includes.join(',')}]`;
          return problems.length
            ? bad(`${problems.join('; ')} (${testCase.note})`)
            : ok(seen);
        },
      }),
    );
  }

  // 7. summariseReviews — provenance is the whole point, so the count must match.
  queue.push(() =>
    execute({
      capability: 'summariseReviews',
      label: '3 reviews (5/4/2 stars)',
      schema: reviewSummary,
      whenStubbed: 'assert',
      run: () =>
        summariseReviews({
          tradeNameEn: 'Plumber',
          reviews: REVIEWS.map((r, i) =>
            i === 0 ? { ...r, text: salt(r.text) } : r,
          ),
        }),
      assert: (s) => {
        const problems: string[] = [];
        if (s.sourceReviewCount !== 3) {
          problems.push(`sourceReviewCount=${s.sourceReviewCount} want 3`);
        }
        if (!s.summaryEn.trim()) problems.push('summaryEn was empty');
        return problems.length
          ? bad(problems.join('; '))
          : ok(`${s.strengths.length} strengths, ${s.cautions.length} cautions`);
      },
    }),
  );

  return queue;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const CAPABILITIES: Capability[] = [
  'transcribe',
  'extractProfile',
  'tagPhoto',
  'classifyProblem',
  'translate',
  'extractPrice',
  'summariseReviews',
];

function pad(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

function padStart(text: string, width: number): string {
  return text.padStart(width);
}

/**
 * Provider errors carry a per-request id, so N identical auth failures look
 * like N distinct reasons. Strip the volatile parts before de-duplicating.
 */
function normaliseReason(reason: string): string {
  return reason
    .replace(/"request_id":"[^"]*"/g, '')
    .replace(/\s*,\s*}/g, '}')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

function printTable(): void {
  const header =
    `${pad('CAPABILITY', 17)} ${pad('CASE', 40)} ${pad('PROVIDER', 10)} ` +
    `${pad('CACHED', 7)} ${padStart('MS', 6)}  STATUS`;
  console.log(header);
  console.log('-'.repeat(header.length + 4));

  let lastCapability = '';
  for (const row of rows) {
    const capability = row.capability === lastCapability ? '' : row.capability;
    lastCapability = row.capability;
    console.log(
      `${pad(capability, 17)} ${pad(row.label, 40)} ${pad(row.provider, 10)} ` +
        `${pad(row.cached ? 'YES (!)' : 'no', 7)} ${padStart(String(row.wallMs), 6)}  ${row.status}`,
    );
  }
}

function printDetails(): void {
  console.log('\nPER-CASE DETAIL');
  let lastCapability = '';
  for (const row of rows) {
    if (row.capability !== lastCapability) {
      console.log(`\n  ${row.capability}`);
      lastCapability = row.capability;
    }
    console.log(`    [${row.status}] ${row.label}`);
    console.log(`           ${row.detail}`);
    if (row.cached) {
      console.log('           NOTE: served from lib/ai/cache.ts — the MS column is not a real latency.');
    }
  }
}

function printProvenance(): void {
  console.log('\nREAL-PROVIDER PROVENANCE (one line per capability)');
  for (const capability of CAPABILITIES) {
    const mine = rows.filter((r) => r.capability === capability);
    if (!mine.length) {
      console.log(`  ${pad(capability, 17)} not exercised`);
      continue;
    }
    const providers = [...new Set(mine.map((r) => r.provider))];
    const real = providers.filter((p) => p !== 'stub' && p !== 'none');
    const label = `provider=${providers.join(',')}`;

    if (real.length && real.length === providers.length) {
      const models = [...new Set(mine.map((r) => r.model))].join(',');
      console.log(`  ${pad(capability, 17)} ${pad(label, 28)} REAL=yes (model ${models})`);
    } else if (real.length) {
      console.log(`  ${pad(capability, 17)} ${pad(label, 28)} REAL=partial`);
    } else {
      const why = ANY_KEY
        ? 'fell back to the stub — see fallbackReason below'
        : 'no API key';
      console.log(`  ${pad(capability, 17)} ${pad(label, 28)} REAL=no (${why})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const wallStart = Date.now();

  console.log('Roshan Rozgar — AI capability check');
  console.log('='.repeat(78));
  console.log(
    `keys:      ${Object.entries(KEYS)
      .map(([name, present]) => `${name}=${present ? 'present' : 'absent'}`)
      .join('  ')}`,
  );

  const status = await providerStatus();
  console.log(
    `providers: ${status.map((p) => `${p.name}=${p.available ? 'available' : 'unavailable'}`).join('  ')}`,
  );
  console.log(`mode:      ${REQUIRE_REAL ? '--require-real (a stubbed capability is a FAILURE)' : 'report-only (stub is an accepted, disclosed fallback)'}`);
  console.log(`cache:     bypassed — every input carries the run nonce "${NONCE}"`);
  console.log(`fixtures:  ${verifyFixtures()}`);
  console.log('');

  // Sequential on purpose: a parallel run would make the MS column a measure of
  // contention rather than of provider latency.
  for (const check of buildChecks()) await check();

  printTable();
  printDetails();
  printProvenance();

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  const counts = {
    pass: rows.filter((r) => r.status === 'PASS').length,
    fail: rows.filter((r) => r.status === 'FAIL').length,
    skip: rows.filter((r) => r.status === 'SKIP').length,
    stubFake: rows.filter((r) => r.status === 'STUB-FAKE').length,
  };
  const served = [...new Set(rows.map((r) => r.provider))];
  const realServed = served.filter((p) => p !== 'stub' && p !== 'none');
  const cachedRows = rows.filter((r) => r.cached);
  const fallbackCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.fallbackReason) continue;
    const key = normaliseReason(row.fallbackReason);
    fallbackCounts.set(key, (fallbackCounts.get(key) ?? 0) + 1);
  }
  const stubbedCapabilities = CAPABILITIES.filter((capability) =>
    rows.some((r) => r.capability === capability && r.provider === 'stub'),
  );

  console.log('\nSUMMARY');
  console.log(`  checks:          ${rows.length}`);
  console.log(`  passed:          ${counts.pass}`);
  console.log(`  failed:          ${counts.fail}`);
  console.log(`  skipped:         ${counts.skip}  (stub cannot answer honestly)`);
  console.log(`  stub-fake:       ${counts.stubFake}  (schema-valid, but the stub hashed its input)`);
  console.log(`  providers served: ${served.join(', ')}`);
  console.log(
    `  real providers:  ${realServed.length ? realServed.join(', ') : `none — ${MISSING_KEYS.join(', ')} unset`}`,
  );
  console.log(`  cached rows:     ${cachedRows.length}${cachedRows.length ? ' (!) latency figures above are not real' : ''}`);
  console.log(`  total wall time: ${Date.now() - wallStart} ms`);

  if (!fallbackCounts.size) {
    console.log('  fallbacks:       none');
  } else {
    console.log('  fallbacks:       a real provider was tried and failed —');
    for (const [reason, count] of fallbackCounts) {
      console.log(`      x${count}  ${reason}`);
    }
  }

  if (counts.fail) {
    console.log('\nFAILURES');
    for (const row of rows.filter((r) => r.status === 'FAIL')) {
      console.log(`  ${row.capability} / ${row.label}`);
      console.log(`      ${row.detail}`);
    }
  }

  let exitCode = counts.fail ? 1 : 0;

  if (REQUIRE_REAL && stubbedCapabilities.length) {
    exitCode = 1;
    console.log('\n--require-real: FAILED');
    console.log(
      `  ${stubbedCapabilities.length} of ${CAPABILITIES.length} capabilities were served by the deterministic stub:`,
    );
    console.log(`    ${stubbedCapabilities.join(', ')}`);
    if (!ANY_KEY) {
      console.log(
        `  CAUSE: no API key is set. ${MISSING_KEYS.join(', ')} are all unset, so no live\n` +
          '         provider could be exercised. Nothing here was verified against a real model.',
      );
      console.log(
        '  FIX:   put ANTHROPIC_API_KEY (and OPENAI_API_KEY for speech) in .env and re-run\n' +
          '         with --env-file-if-exists=.env, or export them into the shell.',
      );
    } else {
      console.log('  CAUSE: a key is present but the provider chain still fell through. See fallbacks above.');
    }
  } else if (REQUIRE_REAL) {
    console.log('\n--require-real: every capability was served by a real provider.');
  } else if (stubbedCapabilities.length && !ANY_KEY) {
    console.log(
      '\nNOTE: every capability above was served by the deterministic stub because no API\n' +
        '      key is set. The stub is a designed, disclosed fallback, so this run exits 0.\n' +
        '      It is NOT evidence that any live model works. Run with --require-real once a\n' +
        '      key is available — that is the check that proves the AI is real.',
    );
  }

  console.log(`\nexit: ${exitCode}`);
  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error('[ai-check] crashed:', err);
    process.exitCode = 1;
  });
