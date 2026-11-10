/**
 * Roshan Rozgar — the demo world.
 *
 *   npm run seed            wipe and reseed (default, idempotent)
 *   npm run seed -- --keep  leave existing rows alone
 *
 * Three properties this script must keep, because the demo rests on them:
 *
 *  1. DETERMINISTIC. A hand-rolled mulberry32 PRNG seeded from a fixed string.
 *     `Math.random()` is never called, so two runs produce byte-identical rows
 *     and the demo is rehearsable. The only moving part is the date anchor,
 *     which is rounded down to midnight UTC so the "past 90 days" stays true
 *     without making the data differ between two runs on the same day.
 *
 *  2. CONSISTENT WITH THE INVARIANT. `one_active_job_per_worker` is a partial
 *     unique index in the schema, so a seed that double-books a worker simply
 *     fails to insert. Beyond that, we hold the stronger product rule too:
 *     every BUSY worker has exactly one active job and no FREE/OFF worker has
 *     any — the seeded world passes the same check the API enforces.
 *
 *  3. AGGREGATES THAT AGREE WITH THE ROWS. `workers.rating` is the true mean of
 *     that worker's seeded reviews and `workers.jobsCompleted` the true count of
 *     his COMPLETED jobs. A judge who runs one GROUP BY must find no daylight.
 *
 * Everything inserted here is fabricated and labelled as such: AI-derived
 * columns carry `aiProvider: 'stub'` rather than pretending a model spoke.
 */

import { sql } from 'drizzle-orm';
import { getDb } from './client';
import { TRADES } from '../data/trades';
import { AREAS } from '../lib/geo';
import {
  customers,
  jobs,
  messages,
  reviews,
  trades,
  trustSummaries,
  workPhotos,
  workerSkills,
  workers,
  type JobStatus,
  type WorkerStatus,
} from './schema';
import {
  ADDRESS_TEMPLATES,
  BIO_TEMPLATES,
  CONVERSATION_SCRIPTS,
  FEMALE_FIRST_NAMES,
  MALE_FIRST_NAMES,
  NEGATIVE_TAGS,
  ONBOARDING_TRANSCRIPT_TEMPLATES,
  PHONE_PREFIXES,
  POSITIVE_TAGS,
  PRICE_INCLUDES,
  PRICE_UNITS,
  REVIEW_LINES,
  REVIEW_TAGS,
  SURNAMES,
  TRADE_JOB_DESCRIPTIONS,
  TRADE_PHOTO_TAGS,
  TRADE_RATE_BANDS,
  TRADE_SKILLS,
  isTradeSlug,
  type BilingualName,
  type ReviewTone,
  type TradeSlug,
} from '../data/seed-data';

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

const WORKER_COUNT = 60;
const CUSTOMER_COUNT = 12;

const FREE_COUNT = 24; // 40%
const BUSY_COUNT = 15; // 25%
const OFF_COUNT = 21; // 35%

/**
 * PROJECT.md asks for ~150 jobs AND ~200 reviews, but `reviews.job_id` is
 * UNIQUE — one review per job — so 200 reviews need at least 200 completed
 * jobs. The constraint wins: the job count is raised so the review target can
 * be met honestly. Disclosed in the README.
 */
const COMPLETED_COUNT = 220;
const REQUESTED_COUNT = 10;
const DECLINED_COUNT = 10;
const CANCELLED_COUNT = 6;
const REVIEW_COUNT = 200;

const CHUNK_SIZE = 100;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Jitter workers off the area centre so distance sorting has something to do. */
const JITTER_DEG = 0.0045; // ~500 m

const DEMO = {
  worker: { name: 'Aslam Khan', nameUr: 'اسلم خان', phone: '+923001234567' },
  /** Reserved, deliberately NOT inserted — see the note where it is printed. */
  freshWorker: { name: 'Naya Kaarigar', nameUr: 'نیا کاریگر', phone: '+923009999999' },
  customer: { name: 'Ayesha Siddiqui', nameUr: 'عائشہ صدیقی', phone: '+923005551234' },
} as const;

const DEMO_PIN = '0000';

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(xmur3('roshan-rozgar/seed/v1')());

const rnd = () => rand();
/** Inclusive on both ends. */
const rint = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;

function shuffled<T>(xs: readonly T[]): T[] {
  const out = xs.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickMany<T>(xs: readonly T[], n: number): T[] {
  return shuffled(xs).slice(0, Math.min(n, xs.length));
}

/** v4-shaped, but drawn from the seeded PRNG so IDs are stable across runs. */
function uuid(): string {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(rand() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

function fill(template: string, tokens: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in tokens ? String(tokens[key]) : whole,
  );
}

const round50 = (n: number) => Math.round(n / 50) * 50;

// Midnight UTC today: see the determinism note at the top of the file.
const ANCHOR = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
})();

const at = (ms: number) => new Date(ms);

// ---------------------------------------------------------------------------
// Row builders
// ---------------------------------------------------------------------------

type TradeRow = typeof trades.$inferInsert;
type WorkerRow = typeof workers.$inferInsert;
type SkillRow = typeof workerSkills.$inferInsert;
type PhotoRow = typeof workPhotos.$inferInsert;
type CustomerRow = typeof customers.$inferInsert;
type JobRow = typeof jobs.$inferInsert;
type MessageRow = typeof messages.$inferInsert;
type ReviewRow = typeof reviews.$inferInsert;
type TrustRow = typeof trustSummaries.$inferInsert;

type WorkerMeta = {
  index: number;
  id: string;
  name: string;
  phone: string;
  tradeId: string;
  tradeSlug: TradeSlug;
  status: WorkerStatus;
  rateMin: number;
  rateMax: number;
};

const ACTIVE_STATUSES: JobStatus[] = ['ACCEPTED', 'PRICE_AGREED', 'IN_PROGRESS'];

function tradeSlugOf(slug: string): TradeSlug {
  if (!isTradeSlug(slug)) {
    throw new Error(`data/seed-data.ts has no pools for trade "${slug}" — add them before seeding.`);
  }
  return slug;
}

function build() {
  // --- trades -------------------------------------------------------------
  const tradeRows: TradeRow[] = TRADES.map((t) => ({
    id: uuid(),
    slug: t.slug,
    nameEn: t.nameEn,
    nameUr: t.nameUr,
    nameRoman: t.nameRoman,
    color: t.color,
    glyph: t.glyph,
    keywords: t.keywords,
    createdAt: at(ANCHOR - 120 * DAY),
  }));
  const tradeIdBySlug = new Map(tradeRows.map((t) => [t.slug, t.id as string]));

  // --- workers ------------------------------------------------------------
  // Electrician-heavy because the scripted demo worker is one.
  const perTrade = [12, 11, 9, 8, 7, 7, 6];
  const tradeOfWorker: string[] = [];
  TRADES.forEach((t, i) => {
    for (let k = 0; k < perTrade[i]; k++) tradeOfWorker.push(t.slug);
  });
  if (tradeOfWorker.length !== WORKER_COUNT) {
    throw new Error(`trade allocation sums to ${tradeOfWorker.length}, expected ${WORKER_COUNT}`);
  }

  const statusOfWorker: WorkerStatus[] = new Array<WorkerStatus>(WORKER_COUNT);
  statusOfWorker[0] = 'FREE'; // the judge has to be able to book Aslam
  {
    const rest = shuffled(Array.from({ length: WORKER_COUNT - 1 }, (_, i) => i + 1));
    let p = 0;
    for (let i = 0; i < FREE_COUNT - 1; i++) statusOfWorker[rest[p++]] = 'FREE';
    for (let i = 0; i < BUSY_COUNT; i++) statusOfWorker[rest[p++]] = 'BUSY';
    for (let i = 0; i < OFF_COUNT; i++) statusOfWorker[rest[p++]] = 'OFF';
  }

  const usedNames = new Set<string>([DEMO.worker.name]);
  const nextMaleName = (): BilingualName => {
    for (let attempt = 0; attempt < 2000; attempt++) {
      const f = pick(MALE_FIRST_NAMES);
      const s = pick(SURNAMES);
      const en = `${f.en} ${s.en}`;
      if (!usedNames.has(en)) {
        usedNames.add(en);
        return { en, ur: `${f.ur} ${s.ur}` };
      }
    }
    throw new Error('exhausted the name pool');
  };

  const workerRows: WorkerRow[] = [];
  const workerMeta: WorkerMeta[] = [];
  const skillRows: SkillRow[] = [];
  const photoRows: PhotoRow[] = [];

  for (let i = 0; i < WORKER_COUNT; i++) {
    const slug = tradeSlugOf(tradeOfWorker[i]);
    const trade = TRADES.find((t) => t.slug === slug)!;
    const tradeId = tradeIdBySlug.get(slug)!;
    const area = AREAS[i % AREAS.length];
    const isDemo = i === 0;

    const name = isDemo ? { en: DEMO.worker.name, ur: DEMO.worker.nameUr } : nextMaleName();
    const years = isDemo ? 15 : rint(2, 30);

    // Experience biases the band upward; it is what a customer would expect.
    const bands = TRADE_RATE_BANDS[slug];
    const bandIdx = isDemo
      ? 2
      : Math.min(bands.length - 1, Math.floor((years / 31) * bands.length) + (chance(0.25) ? 1 : 0));
    const band = bands[Math.min(bandIdx, bands.length - 1)];
    const rateMin = Math.max(800, round50(band.min + rint(0, 3) * 50));
    const rateMax = Math.min(5000, Math.max(rateMin + 300, round50(band.max + rint(-2, 4) * 50)));

    const skills = pickMany(TRADE_SKILLS[slug], isDemo ? 6 : rint(3, 6));
    const onboardedVia = isDemo ? 'voice' : chance(0.85) ? 'voice' : 'form';

    const tokens = {
      name: name.en,
      nameUr: name.ur,
      years,
      area: area.name,
      areaUr: area.nameUr,
      trade: trade.nameEn.toLowerCase(),
      tradeUr: trade.nameUr,
      skill1: skills[0].labelEn.toLowerCase(),
      skill1Ur: skills[0].labelUr,
      skill2: (skills[1] ?? skills[0]).labelEn.toLowerCase(),
      skill2Ur: (skills[1] ?? skills[0]).labelUr,
      rateMin,
      rateMax,
    };
    const bio = pick(BIO_TEMPLATES);
    const transcript = pick(ONBOARDING_TRANSCRIPT_TEMPLATES);

    const id = uuid();
    const phone = isDemo
      ? DEMO.worker.phone
      : `+92${PHONE_PREFIXES[i % PHONE_PREFIXES.length]}${String(1000000 + i * 4567)}`;

    workerRows.push({
      id,
      name: name.en,
      phone,
      pin: DEMO_PIN,
      tradeId,
      yearsExperience: years,
      area: area.name,
      lat: area.lat + (rnd() * 2 - 1) * JITTER_DEG,
      lng: area.lng + (rnd() * 2 - 1) * JITTER_DEG,
      status: statusOfWorker[i],
      rateMin,
      rateMax,
      rating: 0, // patched once the reviews exist
      jobsCompleted: 0, // patched once the jobs exist
      bioUr: fill(bio.ur, tokens),
      bioEn: fill(bio.en, tokens),
      photoUrl: `https://picsum.photos/seed/rr-worker-${i}/400/400`,
      onboardedVia,
      onboardingTranscript: onboardedVia === 'voice' ? fill(transcript, tokens) : null,
      createdAt: at(ANCHOR - rint(95, 400) * DAY),
    });

    workerMeta.push({
      index: i,
      id,
      name: name.en,
      phone,
      tradeId,
      tradeSlug: slug,
      status: statusOfWorker[i],
      rateMin,
      rateMax,
    });

    skills.forEach((s, k) => {
      // The first skills came out of his own words; later ones were inferred
      // from the photos he took, which is why their confidence is lower.
      const fromPhoto = k >= 3 && chance(0.6);
      skillRows.push({
        id: uuid(),
        workerId: id,
        labelEn: s.labelEn,
        labelUr: s.labelUr,
        source: fromPhoto ? 'photo' : 'speech',
        confidence: fromPhoto ? 0.55 + rnd() * 0.3 : 0.74 + rnd() * 0.25,
        createdAt: at(ANCHOR - rint(90, 395) * DAY),
      });
    });

    const vocab = TRADE_PHOTO_TAGS[slug];
    const photoCount = isDemo ? 5 : rint(3, 5);
    for (let k = 0; k < photoCount; k++) {
      photoRows.push({
        id: uuid(),
        workerId: id,
        url: `https://picsum.photos/seed/rr-${slug}-${i}-${k}/800/600`,
        aiTags: pickMany(vocab, rint(2, 4)).map((label) => ({
          label,
          confidence: Number((0.55 + rnd() * 0.4).toFixed(2)),
        })),
        aiProvider: 'stub',
        createdAt: at(ANCHOR - rint(20, 380) * DAY),
      });
    }
  }

  // --- customers ----------------------------------------------------------
  const customerRows: CustomerRow[] = [];
  const usedCustomerNames = new Set<string>([DEMO.customer.name]);

  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const isDemo = i === 0;
    // Ayesha sits in G-11 so the seeded workers are plausibly walking distance.
    const area = isDemo ? AREAS[1] : AREAS[(i * 3 + 2) % AREAS.length];

    let name: string;
    if (isDemo) {
      name = DEMO.customer.name;
    } else {
      let candidate = '';
      for (let attempt = 0; attempt < 2000; attempt++) {
        const first = chance(0.7) ? pick(FEMALE_FIRST_NAMES) : pick(MALE_FIRST_NAMES);
        candidate = `${first.en} ${pick(SURNAMES).en}`;
        if (!usedCustomerNames.has(candidate)) break;
      }
      usedCustomerNames.add(candidate);
      name = candidate;
    }

    customerRows.push({
      id: uuid(),
      name,
      phone: isDemo ? DEMO.customer.phone : `+92${PHONE_PREFIXES[(i + 2) % PHONE_PREFIXES.length]}${String(7100000 + i * 911)}`,
      pin: DEMO_PIN,
      lat: area.lat + (rnd() * 2 - 1) * JITTER_DEG,
      lng: area.lng + (rnd() * 2 - 1) * JITTER_DEG,
      addressLabel: fill(pick(ADDRESS_TEMPLATES), {
        house: rint(2, 480),
        street: rint(1, 72),
        area: area.name,
      }),
      rating: Number((4.4 + rnd() * 0.6).toFixed(2)),
      createdAt: at(ANCHOR - rint(95, 300) * DAY),
    });
  }

  const customerIds = customerRows.map((c) => c.id as string);

  // --- jobs ---------------------------------------------------------------
  const jobRows: JobRow[] = [];
  /** Completed job ids per worker index, in insertion order. */
  const completedByWorker: string[][] = Array.from({ length: WORKER_COUNT }, () => []);
  const jobById = new Map<string, JobRow>();

  let descriptionSeq = 0;

  type JobShape = {
    status: JobStatus;
    requestedAt: number;
    acceptedAt?: number;
    startedAt?: number;
    completedAt?: number;
    priced: 'none' | 'quoted' | 'agreed';
  };

  function makeJob(w: WorkerMeta, shape: JobShape): JobRow {
    const pool = TRADE_JOB_DESCRIPTIONS[w.tradeSlug];
    const desc = pool[descriptionSeq++ % pool.length];
    const id = uuid();

    // Photo-described faults are the headline customer path, so keep a real
    // share of them; the rest split between voice and typed text.
    const source = chance(0.45) ? 'voice' : chance(0.45) ? 'photo' : 'text';

    const price =
      shape.priced === 'none'
        ? null
        : round50(rint(w.rateMin, w.rateMax));

    const last = shape.completedAt ?? shape.startedAt ?? shape.acceptedAt ?? shape.requestedAt;

    const row: JobRow = {
      id,
      customerId: pick(customerIds),
      workerId: w.id,
      tradeId: w.tradeId,
      status: shape.status,
      descriptionRaw: desc.text,
      descriptionSource: source,
      photoUrl: source === 'photo' ? `https://picsum.photos/seed/rr-job-${descriptionSeq}/800/600` : null,
      aiClassification: {
        tradeSlug: w.tradeSlug,
        urgency: desc.urgency,
        likelyFix: desc.likelyFix,
        keywords: desc.keywords,
        confidence: Number((0.68 + rnd() * 0.29).toFixed(2)),
        provider: 'stub',
      },
      agreedPriceAmount: price,
      agreedPriceUnit: price === null ? null : pick(PRICE_UNITS),
      agreedPriceIncludes: price === null ? null : pickMany(PRICE_INCLUDES, rint(1, 3)),
      priceConfirmedByWorker: shape.priced !== 'none',
      priceConfirmedByCustomer: shape.priced === 'agreed',
      requestedAt: at(shape.requestedAt),
      acceptedAt: shape.acceptedAt === undefined ? null : at(shape.acceptedAt),
      startedAt: shape.startedAt === undefined ? null : at(shape.startedAt),
      completedAt: shape.completedAt === undefined ? null : at(shape.completedAt),
      updatedAt: at(Math.min(last + rint(1, 90) * MINUTE, ANCHOR)),
    };
    jobById.set(id, row);
    return row;
  }

  // Completed history. Aslam carries a visibly strong record; everyone else
  // gets at least three so no profile card is empty and every worker ends up
  // with real reviews behind his rating.
  const completedPerWorker = new Array<number>(WORKER_COUNT).fill(3);
  completedPerWorker[0] = 14;
  {
    let remaining = COMPLETED_COUNT - completedPerWorker.reduce((a, b) => a + b, 0);
    const order = shuffled(Array.from({ length: WORKER_COUNT - 1 }, (_, i) => i + 1));
    let p = 0;
    while (remaining > 0) {
      completedPerWorker[order[p % order.length]] += 1;
      p += 1;
      remaining -= 1;
    }
  }

  for (const w of workerMeta) {
    for (let k = 0; k < completedPerWorker[w.index]; k++) {
      // >= 3 days back, so accept -> start -> complete all land before ANCHOR.
      const requestedAt = ANCHOR - Math.floor((3 + rnd() * 85) * DAY) + rint(7 * HOUR, 20 * HOUR);
      const acceptedAt = requestedAt + rint(5, 120) * MINUTE;
      const startedAt = acceptedAt + rint(30, 1440) * MINUTE;
      const completedAt = startedAt + rint(45, 420) * MINUTE;
      const row = makeJob(w, {
        status: 'COMPLETED',
        requestedAt,
        acceptedAt,
        startedAt,
        completedAt,
        priced: 'agreed',
      });
      jobRows.push(row);
      completedByWorker[w.index].push(row.id as string);
    }
  }

  // The one active job each BUSY worker holds. The partial unique index would
  // reject a second one, which is exactly the point.
  const busy = workerMeta.filter((w) => w.status === 'BUSY');
  if (busy.length !== BUSY_COUNT) {
    throw new Error(`expected ${BUSY_COUNT} BUSY workers, built ${busy.length}`);
  }
  busy.forEach((w, i) => {
    const status = ACTIVE_STATUSES[i % ACTIVE_STATUSES.length];
    if (status === 'ACCEPTED') {
      const requestedAt = ANCHOR - rint(2, 30) * HOUR;
      jobRows.push(
        makeJob(w, {
          status,
          requestedAt,
          acceptedAt: requestedAt + rint(5, 90) * MINUTE,
          priced: 'quoted', // he has named a price; she has not confirmed it yet
        }),
      );
    } else if (status === 'PRICE_AGREED') {
      const requestedAt = ANCHOR - rint(4, 40) * HOUR;
      jobRows.push(
        makeJob(w, {
          status,
          requestedAt,
          acceptedAt: requestedAt + rint(5, 60) * MINUTE,
          priced: 'agreed',
        }),
      );
    } else {
      const requestedAt = ANCHOR - rint(15, 60) * HOUR;
      const acceptedAt = requestedAt + rint(5, 60) * MINUTE;
      jobRows.push(
        makeJob(w, {
          status,
          requestedAt,
          acceptedAt,
          startedAt: acceptedAt + rint(30, 600) * MINUTE,
          priced: 'agreed',
        }),
      );
    }
  });

  // Pending requests sit on workers who are NOT busy — REQUESTED does not
  // occupy anybody, so this is legal and it gives the worker inbox content.
  const idleWorkers = shuffled(workerMeta.filter((w) => w.status !== 'BUSY'));
  for (let i = 0; i < REQUESTED_COUNT; i++) {
    jobRows.push(
      makeJob(idleWorkers[i], {
        status: 'REQUESTED',
        requestedAt: ANCHOR - rint(1, 30) * HOUR,
        priced: 'none',
      }),
    );
  }

  // Terminal noise, so the history does not look suspiciously tidy.
  for (let i = 0; i < DECLINED_COUNT; i++) {
    jobRows.push(
      makeJob(pick(workerMeta), {
        status: 'DECLINED',
        requestedAt: ANCHOR - rint(2, 70) * DAY + rint(8 * HOUR, 20 * HOUR),
        priced: 'none',
      }),
    );
  }
  for (let i = 0; i < CANCELLED_COUNT; i++) {
    const requestedAt = ANCHOR - rint(2, 70) * DAY + rint(8 * HOUR, 20 * HOUR);
    const acceptedFirst = chance(0.5);
    jobRows.push(
      makeJob(pick(workerMeta), {
        status: 'CANCELLED',
        requestedAt,
        acceptedAt: acceptedFirst ? requestedAt + rint(10, 240) * MINUTE : undefined,
        priced: acceptedFirst ? 'quoted' : 'none',
      }),
    );
  }

  // --- messages -----------------------------------------------------------
  // Chat history only where a human would still be looking at it: live jobs,
  // and jobs finished recently enough to still be on the customer's screen.
  const messageRows: MessageRow[] = [];
  const RECENT = 21 * DAY;

  for (const job of jobRows) {
    const status = job.status as JobStatus;
    const completedAt = job.completedAt instanceof Date ? job.completedAt.getTime() : null;
    const isLive = status === 'REQUESTED' || ACTIVE_STATUSES.includes(status);
    const isRecentlyDone =
      status === 'COMPLETED' && completedAt !== null && ANCHOR - completedAt <= RECENT;
    if (!isLive && !isRecentlyDone) continue;

    const script = pick(CONVERSATION_SCRIPTS);
    const turns = script.slice(0, rint(2, Math.min(6, script.length)));
    const requestedAt = (job.requestedAt as Date).getTime();
    const endBound = completedAt ?? ANCHOR;
    const span = Math.max(endBound - requestedAt, turns.length * 2 * MINUTE);
    const step = span / (turns.length + 1);
    const priceText = job.agreedPriceAmount != null
      ? String(job.agreedPriceAmount)
      : String(round50(rint(1200, 3500)));

    turns.forEach((turn, k) => {
      messageRows.push({
        id: uuid(),
        jobId: job.id as string,
        sender: turn.sender,
        kind: turn.kind,
        // No audio files are shipped with the seed; the transcripts are the
        // record. A fake URL here would only produce a broken player.
        audioUrl: null,
        durationMs: turn.kind === 'voice' ? turn.durationMs : null,
        transcriptUr: fill(turn.ur, { price: priceText }),
        transcriptEn: fill(turn.en, { price: priceText }),
        aiProvider: 'stub',
        createdAt: at(Math.min(requestedAt + step * (k + 1) + rint(0, 60) * 1000, endBound)),
      });
    });
  }

  // --- reviews ------------------------------------------------------------
  // One per job (enforced by a UNIQUE on reviews.job_id). A handful of
  // completed jobs are left unreviewed, which is what real usage looks like,
  // but never enough to leave a worker without reviews behind his rating.
  const skipped = new Set<string>();
  {
    const donors = shuffled(Array.from({ length: WORKER_COUNT - 1 }, (_, i) => i + 1));
    const toSkip = COMPLETED_COUNT - REVIEW_COUNT;
    for (let i = 0; i < toSkip; i++) {
      const list = completedByWorker[donors[i]];
      skipped.add(list[list.length - 1]);
    }
  }

  const reviewRows: ReviewRow[] = [];
  const starsByWorker = new Map<string, number[]>();
  const tagsByWorker = new Map<string, string[]>();

  for (let wi = 0; wi < WORKER_COUNT; wi++) {
    for (const jobId of completedByWorker[wi]) {
      if (skipped.has(jobId)) continue;
      const job = jobById.get(jobId)!;

      // Skewed high, as a marketplace's ratings genuinely are, but not
      // uniformly glowing — the trust summary needs something to caution about.
      // The scripted demo worker is skewed harder: his profile is the one a
      // judge opens, and PROJECT.md §4 calls for a strong history there.
      const r = rnd();
      const stars =
        wi === 0
          ? r < 0.82 ? 5 : r < 0.97 ? 4 : 3
          : r < 0.55 ? 5 : r < 0.82 ? 4 : r < 0.93 ? 3 : r < 0.98 ? 2 : 1;
      const tone: ReviewTone = stars >= 4 ? 'positive' : stars === 3 ? 'neutral' : 'negative';

      const line = pick(REVIEW_LINES.filter((l) => l.tone === tone));
      const tags =
        stars >= 4
          ? pickMany(POSITIVE_TAGS, rint(stars === 5 ? 2 : 1, 4))
          : stars === 3
            ? [...pickMany(POSITIVE_TAGS, 1), ...pickMany(NEGATIVE_TAGS, 1)]
            : pickMany(NEGATIVE_TAGS, rint(1, 3));

      const completedAt = (job.completedAt as Date).getTime();
      const createdAt = Math.min(completedAt + rint(1, 72) * HOUR, ANCHOR);

      reviewRows.push({
        id: uuid(),
        jobId,
        workerId: job.workerId as string,
        customerId: job.customerId as string,
        stars,
        tags,
        voiceUrl: null, // see the note on messages.audioUrl
        // She spoke it in Urdu; which script we store it in varies, and the
        // English rendering always sits beside it.
        transcriptUr: chance(0.5) ? line.ur : line.roman,
        transcriptEn: line.en,
        createdAt: at(createdAt),
      });

      const workerId = job.workerId as string;
      starsByWorker.set(workerId, [...(starsByWorker.get(workerId) ?? []), stars]);
      tagsByWorker.set(workerId, [...(tagsByWorker.get(workerId) ?? []), ...tags]);
    }
  }

  // --- aggregates ---------------------------------------------------------
  const completedCountByWorker = new Map<string, number>();
  for (const job of jobRows) {
    if (job.status !== 'COMPLETED') continue;
    const id = job.workerId as string;
    completedCountByWorker.set(id, (completedCountByWorker.get(id) ?? 0) + 1);
  }

  workerRows.forEach((w) => {
    const id = w.id as string;
    const stars = starsByWorker.get(id) ?? [];
    w.rating = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0;
    w.jobsCompleted = completedCountByWorker.get(id) ?? 0;
  });

  // --- trust summaries ----------------------------------------------------
  const tagUr = new Map(REVIEW_TAGS.map((t) => [t.en, t.ur]));
  const trustRows: TrustRow[] = [];

  for (const w of workerRows) {
    const id = w.id as string;
    const stars = starsByWorker.get(id) ?? [];
    if (stars.length === 0) continue;

    const avg = stars.reduce((a, b) => a + b, 0) / stars.length;
    const counts = new Map<string, number>();
    for (const t of tagsByWorker.get(id) ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([t]) => t);
    const concerns = stars.filter((s) => s <= 2).length;

    const topEn = top.map((t) => t.toLowerCase()).join(', ');
    const topUr = top.map((t) => tagUr.get(t) ?? t).join('، ');

    trustRows.push({
      workerId: id,
      summaryEn:
        `Averages ${avg.toFixed(1)} stars across ${stars.length} customer reviews. ` +
        `Most often mentioned: ${topEn}. ` +
        (concerns > 0
          ? `${concerns} of ${stars.length} customers raised a concern.`
          : 'No complaints recorded.'),
      summaryUr:
        `${stars.length} گاہکوں کے ریویوز میں اوسط ${avg.toFixed(1)} ستارے۔ ` +
        `زیادہ تر ذکر: ${topUr}۔ ` +
        (concerns > 0
          ? `${stars.length} میں سے ${concerns} گاہکوں نے شکایت کی۔`
          : 'کوئی شکایت درج نہیں۔'),
      sourceReviewCount: stars.length,
      aiProvider: 'stub',
      generatedAt: at(ANCHOR - rint(0, 3) * DAY),
    });
  }

  return {
    tradeRows,
    workerRows,
    workerMeta,
    skillRows,
    photoRows,
    customerRows,
    jobRows,
    messageRows,
    reviewRows,
    trustRows,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function main() {
  const keep = process.argv.includes('--keep');
  const { db, driver, close } = await getDb();

  try {
    console.log(`[seed] driver=${driver} anchor=${new Date(ANCHOR).toISOString().slice(0, 10)}`);

    if (keep) {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(workers);
      if (n > 0) {
        console.log(`[seed] --keep: ${n} workers already present, nothing to do`);
        return;
      }
      console.log('[seed] --keep: database is empty, seeding anyway');
    } else {
      // FK-safe in one statement; CASCADE also resets anything referencing them.
      await db.execute(sql`
        TRUNCATE TABLE reviews, messages, jobs, work_photos, worker_skills,
                       trust_summaries, workers, customers, trades CASCADE
      `);
      console.log('[seed] truncated app tables');
    }

    const data = build();

    // One transaction per logical batch, chunked so PGlite never sees a
    // statement with thousands of parameters.
    await db.transaction(async (tx) => {
      for (const part of chunk(data.tradeRows, CHUNK_SIZE)) await tx.insert(trades).values(part);
      for (const part of chunk(data.workerRows, CHUNK_SIZE)) await tx.insert(workers).values(part);
      for (const part of chunk(data.customerRows, CHUNK_SIZE)) await tx.insert(customers).values(part);
    });

    await db.transaction(async (tx) => {
      for (const part of chunk(data.skillRows, CHUNK_SIZE)) await tx.insert(workerSkills).values(part);
      for (const part of chunk(data.photoRows, CHUNK_SIZE)) await tx.insert(workPhotos).values(part);
    });

    await db.transaction(async (tx) => {
      for (const part of chunk(data.jobRows, CHUNK_SIZE)) await tx.insert(jobs).values(part);
    });

    await db.transaction(async (tx) => {
      for (const part of chunk(data.messageRows, CHUNK_SIZE)) await tx.insert(messages).values(part);
      for (const part of chunk(data.reviewRows, CHUNK_SIZE)) await tx.insert(reviews).values(part);
      for (const part of chunk(data.trustRows, CHUNK_SIZE)) await tx.insert(trustSummaries).values(part);
    });

    report(data);
  } finally {
    await close();
  }
}

function report(data: ReturnType<typeof build>) {
  const statusCount = (s: WorkerStatus) =>
    data.workerRows.filter((w) => w.status === s).length;
  const jobCount = (s: JobStatus) => data.jobRows.filter((j) => j.status === s).length;

  const rows: Array<[string, number]> = [
    ['trades', data.tradeRows.length],
    ['workers', data.workerRows.length],
    ['worker_skills', data.skillRows.length],
    ['work_photos', data.photoRows.length],
    ['customers', data.customerRows.length],
    ['jobs', data.jobRows.length],
    ['messages', data.messageRows.length],
    ['reviews', data.reviewRows.length],
    ['trust_summaries', data.trustRows.length],
  ];

  const line = '-'.repeat(54);
  console.log(`\n${line}\n  Roshan Rozgar — seeded world\n${line}`);
  for (const [name, n] of rows) {
    console.log(`  ${name.padEnd(18)} ${String(n).padStart(6)}`);
  }

  console.log(`${line}\n  worker status mix`);
  for (const s of ['FREE', 'BUSY', 'OFF'] as WorkerStatus[]) {
    const n = statusCount(s);
    console.log(`  ${s.padEnd(18)} ${String(n).padStart(6)}  (${Math.round((n / data.workerRows.length) * 100)}%)`);
  }

  console.log(`${line}\n  job status mix`);
  for (const s of [
    'COMPLETED', 'REQUESTED', 'ACCEPTED', 'PRICE_AGREED', 'IN_PROGRESS', 'DECLINED', 'CANCELLED',
  ] as JobStatus[]) {
    console.log(`  ${s.padEnd(18)} ${String(jobCount(s)).padStart(6)}`);
  }
  const active = data.jobRows.filter((j) => ACTIVE_STATUSES.includes(j.status as JobStatus)).length;
  console.log(`  ${'active total'.padEnd(18)} ${String(active).padStart(6)}  (= BUSY workers)`);

  const aslam = data.workerRows[0];
  const ayesha = data.customerRows[0];
  console.log(`${line}\n  scripted demo accounts  (PIN ${DEMO_PIN} for every seeded account)`);
  console.log(`  worker   ${aslam.name}  ${aslam.phone}`);
  console.log(`           id=${aslam.id}`);
  console.log(`           electrician, ${aslam.area}, ${aslam.status}, ${aslam.yearsExperience}y, ` +
    `rating ${Number(aslam.rating).toFixed(2)}, ${aslam.jobsCompleted} jobs completed`);
  console.log(`  fresh    ${DEMO.freshWorker.name}  ${DEMO.freshWorker.phone}`);
  console.log(`           NOT INSERTED — phone reserved. This is the account onboarded`);
  console.log(`           live by voice during the demo, so it must not exist yet.`);
  console.log(`  customer ${ayesha.name}  ${ayesha.phone}`);
  console.log(`           id=${ayesha.id}`);
  console.log(`           ${ayesha.addressLabel}`);
  console.log(`${line}`);
  console.log('  Every row above is SEEDED DEMO DATA — no real users, no real');
  console.log('  phone numbers; photos are picsum.photos placeholders and all');
  console.log("  AI-derived columns are marked aiProvider='stub'.");
  console.log(`${line}\n`);
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
