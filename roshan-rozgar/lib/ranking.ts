/**
 * The published ranking formula (PROJECT.md §3.4), implemented literally:
 *
 *   score = 0.40 * available_now
 *         + 0.25 * distance_decay(km)      // exp(-km / 4), from lib/geo
 *         + 0.20 * skill_match(keywords)   // worker_skills + photo tags + trade
 *         + 0.15 * normalised_rating       // rating / 5
 *
 * Two things are deliberate here.
 *
 * 1. Nothing is hidden. Every term returns its raw value, its weight and its
 *    contribution, so the API can hand the whole breakdown to the UI and the
 *    team can defend the weights out loud.
 *
 * 2. `rankingReason` turns the dominant term into one human sentence. A visible
 *    reason is worth more at the judging table than a better hidden algorithm,
 *    so the sentence is built from the SAME numbers that produced the ordering —
 *    it can never drift from the score.
 */

import type { WorkerStatus } from '@/db/schema';
import { distanceDecay, formatDistance } from '@/lib/geo';

// ---------------------------------------------------------------------------
// Weights — the single source of truth, exported so /api/workers can publish them
// ---------------------------------------------------------------------------

export const RANKING_WEIGHTS = {
  availableNow: 0.4,
  distance: 0.25,
  skillMatch: 0.2,
  rating: 0.15,
} as const;

export const RANKING_FORMULA =
  'score = 0.40*available_now + 0.25*distance_decay(km) + 0.20*skill_match(keywords) + 0.15*(rating/5)';

/** Half-life of the distance term, in km. Mirrors `distanceDecay` in lib/geo. */
export const DISTANCE_HALF_LIFE_KM = 4;

export type RankingTerm = 'availability' | 'distance' | 'skill' | 'rating';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * The minimum a candidate must carry to be ranked. Structural on purpose: the
 * search route passes its full joined row and gets the same object back.
 */
export type RankCandidate = {
  id: string;
  name: string;
  area: string;
  status: WorkerStatus;
  /** 0..5 as stored on `workers.rating`. */
  rating: number;
  jobsCompleted: number;
  /** Exact haversine distance from the customer, computed by the caller. */
  distanceKm: number;
  tradeSlug: string;
  tradeNameEn: string;
  /** Keyword list of the worker's trade — generic, trade-level evidence. */
  tradeKeywords: string[];
  /** `worker_skills.label_en` (+ Urdu label) — the worker's own words. */
  skillLabels: string[];
  /** Vision-model labels off his work photos — specific, photographic evidence. */
  photoTags: string[];
};

export type RankRequest = {
  /** Problem keywords, usually straight from the AI problem classifier. */
  keywords?: string[];
  /** The trade the customer picked, if any. */
  tradeSlug?: string | null;
};

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

type Term = { raw: number; weight: number; contribution: number };

export type ScoreBreakdown = {
  score: number;
  weights: typeof RANKING_WEIGHTS;
  formula: string;
  terms: {
    availableNow: Term & { status: WorkerStatus };
    distance: Term & { km: number; halfLifeKm: number };
    skillMatch: Term & {
      /** Which of the requested keywords this worker actually answers. */
      matchedKeywords: string[];
      /** The worker-side labels that produced those matches, best first. */
      evidence: string[];
      /** True when a match came from his own skills/photos, not just his trade. */
      specific: boolean;
      /** False when the customer gave us nothing to match on. */
      active: boolean;
    };
    rating: Term & { stars: number; jobsCompleted: number };
  };
  /** The term that contributed most — what `rankingReason` leads with. */
  dominant: RankingTerm;
};

export type RankedWorker<T extends RankCandidate = RankCandidate> = {
  worker: T;
  score: number;
  breakdown: ScoreBreakdown;
  /** One sentence, shown on every result card. */
  reason: string;
};

// ---------------------------------------------------------------------------
// Keyword matching
// ---------------------------------------------------------------------------

/** Evidence from the worker himself beats evidence that is merely trade-wide. */
const SPECIFIC_WEIGHT = 1;
const TRADE_WEIGHT = 0.5;

/** Lowercase, strip punctuation, collapse spaces. Keeps Urdu letters intact. */
function normalise(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Does `needle` (a requested keyword) appear in `hay` (a worker-side label)?
 *
 * Partial matches are only allowed for words of 5+ characters, so short but
 * real trade keywords like "ac" or "tap" can never match inside "back"/"tape".
 */
function phraseMatches(needle: string, hay: string): boolean {
  if (!needle || !hay) return false;
  if (needle === hay) return true;

  if (needle.includes(' ')) return hay.includes(needle);

  const tokens = hay.split(' ');
  if (tokens.includes(needle)) return true;
  if (needle.length >= 5) {
    return tokens.some((t) => t.includes(needle) || (t.length >= 5 && needle.includes(t)));
  }
  return false;
}

type SkillMatch = {
  value: number;
  matchedKeywords: string[];
  evidence: string[];
  specific: boolean;
  active: boolean;
};

/**
 * Overlap between the requested keywords and everything we know this worker can
 * do, normalised to [0,1]: the mean per-keyword best evidence weight.
 *
 * With no keywords the term cannot discriminate between candidates. Rather than
 * zeroing every card (which would make a perfect match look like a 0.80), we
 * credit an exact trade hit — the customer did tell us the trade — and mark the
 * term `active: false` so the UI can say the skill signal was not used.
 */
function skillMatch(candidate: RankCandidate, request: RankRequest): SkillMatch {
  const specificLabels = [...candidate.skillLabels, ...candidate.photoTags]
    .map((l) => ({ label: l, norm: normalise(l), weight: SPECIFIC_WEIGHT }))
    .filter((l) => l.norm.length > 0);

  const tradeLabels = candidate.tradeKeywords
    .map((l) => ({ label: l, norm: normalise(l), weight: TRADE_WEIGHT }))
    .filter((l) => l.norm.length > 0);

  const vocabulary = [...specificLabels, ...tradeLabels];

  const keywords = Array.from(
    new Set((request.keywords ?? []).map(normalise).filter((k) => k.length >= 2)),
  );

  if (keywords.length === 0) {
    const tradeHit = Boolean(request.tradeSlug) && request.tradeSlug === candidate.tradeSlug;
    return {
      value: tradeHit ? 1 : 0,
      matchedKeywords: [],
      evidence: [],
      specific: false,
      active: false,
    };
  }

  const scored: Array<{ keyword: string; weight: number; evidence: string }> = [];

  for (const keyword of keywords) {
    let best = 0;
    let bestLabel = '';
    for (const entry of vocabulary) {
      if (entry.weight <= best) continue; // already have evidence at least as strong
      if (phraseMatches(keyword, entry.norm)) {
        best = entry.weight;
        bestLabel = entry.label;
      }
    }
    if (best > 0) scored.push({ keyword, weight: best, evidence: bestLabel });
  }

  scored.sort((a, b) => b.weight - a.weight);
  const total = scored.reduce((sum, s) => sum + s.weight, 0);

  return {
    value: Math.min(1, total / keywords.length),
    matchedKeywords: scored.map((s) => s.keyword),
    evidence: Array.from(new Set(scored.map((s) => s.evidence))),
    specific: scored.some((s) => s.weight === SPECIFIC_WEIGHT),
    active: true,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const term = (raw: number, weight: number): Term => ({
  raw,
  weight,
  contribution: raw * weight,
});

const round = (n: number, places = 4) => Number(n.toFixed(places));

/** Ties go to the more informative term, so cards do not all read the same. */
const TIE_PREFERENCE: RankingTerm[] = ['skill', 'distance', 'rating', 'availability'];

export function scoreWorker(candidate: RankCandidate, request: RankRequest): ScoreBreakdown {
  const availableNow = candidate.status === 'FREE' ? 1 : 0;
  const decay = distanceDecay(Math.max(0, candidate.distanceKm));
  const skill = skillMatch(candidate, request);
  const normalisedRating = Math.min(1, Math.max(0, candidate.rating / 5));

  const availabilityTerm = term(availableNow, RANKING_WEIGHTS.availableNow);
  const distanceTerm = term(decay, RANKING_WEIGHTS.distance);
  const skillTerm = term(skill.value, RANKING_WEIGHTS.skillMatch);
  const ratingTerm = term(normalisedRating, RANKING_WEIGHTS.rating);

  const score =
    availabilityTerm.contribution +
    distanceTerm.contribution +
    skillTerm.contribution +
    ratingTerm.contribution;

  const contributions: Array<[RankingTerm, number]> = [
    ['availability', availabilityTerm.contribution],
    ['distance', distanceTerm.contribution],
    ['skill', skillTerm.contribution],
    ['rating', ratingTerm.contribution],
  ];

  let dominant: RankingTerm = 'availability';
  let best = -1;
  for (const [name, value] of contributions) {
    const better =
      value > best + 1e-9 ||
      (Math.abs(value - best) <= 1e-9 &&
        TIE_PREFERENCE.indexOf(name) < TIE_PREFERENCE.indexOf(dominant));
    if (better) {
      best = Math.max(best, value);
      dominant = name;
    }
  }

  return {
    score: round(score),
    weights: RANKING_WEIGHTS,
    formula: RANKING_FORMULA,
    terms: {
      availableNow: {
        ...availabilityTerm,
        contribution: round(availabilityTerm.contribution),
        status: candidate.status,
      },
      distance: {
        raw: round(distanceTerm.raw),
        weight: distanceTerm.weight,
        contribution: round(distanceTerm.contribution),
        km: round(candidate.distanceKm, 2),
        halfLifeKm: DISTANCE_HALF_LIFE_KM,
      },
      skillMatch: {
        raw: round(skillTerm.raw),
        weight: skillTerm.weight,
        contribution: round(skillTerm.contribution),
        matchedKeywords: skill.matchedKeywords,
        evidence: skill.evidence,
        specific: skill.specific,
        active: skill.active,
      },
      rating: {
        raw: round(ratingTerm.raw),
        weight: ratingTerm.weight,
        contribution: round(ratingTerm.contribution),
        stars: round(candidate.rating, 2),
        jobsCompleted: candidate.jobsCompleted,
      },
    },
    dominant,
  };
}

// ---------------------------------------------------------------------------
// The sentence on the card
// ---------------------------------------------------------------------------

const STATUS_CAVEAT: Record<WorkerStatus, string> = {
  FREE: '',
  BUSY: 'on another job right now',
  OFF: 'off duty right now',
};

function stars(breakdown: ScoreBreakdown): string {
  return breakdown.terms.rating.stars.toFixed(1);
}

/** Lead clause: the full phrasing for whichever term won. */
function lead(worker: RankCandidate, breakdown: ScoreBreakdown): string {
  const { terms, dominant } = breakdown;
  const trade = worker.tradeNameEn.toLowerCase();

  if (dominant === 'availability' && terms.availableNow.raw === 1) return 'Free right now';

  if (dominant === 'distance' && terms.distance.km >= 0) {
    return `Nearby ${trade}, ${formatDistance(terms.distance.km)} away`;
  }

  if (dominant === 'skill' && terms.skillMatch.evidence.length > 0) {
    const what = terms.skillMatch.evidence.slice(0, 2).join(' and ');
    return terms.skillMatch.specific
      ? `Has done ${what.toLowerCase()} work before`
      : `${worker.tradeNameEn} who handles ${what.toLowerCase()}`;
  }

  if (dominant === 'rating' && terms.rating.stars > 0) {
    return worker.jobsCompleted > 0
      ? `${stars(breakdown)} stars across ${worker.jobsCompleted} jobs`
      : `${stars(breakdown)} stars`;
  }

  // Nothing scored: say what he is and where, rather than inventing a merit.
  return `${worker.tradeNameEn} in ${worker.area}`;
}

/** Short supporting clauses for the runner-up terms. */
function support(
  worker: RankCandidate,
  breakdown: ScoreBreakdown,
  name: RankingTerm,
): string | null {
  const { terms } = breakdown;
  switch (name) {
    case 'availability':
      return terms.availableNow.raw === 1 ? 'free now' : null;
    case 'distance':
      return `${formatDistance(terms.distance.km)} away`;
    case 'skill': {
      if (!terms.skillMatch.active || terms.skillMatch.evidence.length === 0) return null;
      const what = terms.skillMatch.evidence[0].toLowerCase();
      // Trade-level evidence only proves he CAN do it, never that he has.
      return terms.skillMatch.specific ? `${what} experience` : `does ${what} jobs`;
    }
    case 'rating':
      if (terms.rating.stars <= 0) return null;
      return worker.jobsCompleted > 0
        ? `${stars(breakdown)} stars from ${worker.jobsCompleted} jobs`
        : `${stars(breakdown)} stars`;
  }
}

/**
 * ONE sentence explaining why this worker ranked where it did.
 *
 * Built from the dominant term plus the two next-strongest, then an honest
 * caveat when he is not actually free — e.g.
 *   "Free right now, 1.2 km away, 4.8 stars from 23 jobs."
 *   "Has done geyser installation work before, 0.6 km away — on another job right now."
 */
export function rankingReason(worker: RankCandidate, breakdown: ScoreBreakdown): string {
  const ordered = (
    [
      ['availability', breakdown.terms.availableNow.contribution],
      ['distance', breakdown.terms.distance.contribution],
      ['skill', breakdown.terms.skillMatch.contribution],
      ['rating', breakdown.terms.rating.contribution],
    ] as Array<[RankingTerm, number]>
  )
    .filter(([name]) => name !== breakdown.dominant)
    .sort((a, b) => b[1] - a[1]);

  const clauses = [lead(worker, breakdown)];
  for (const [name] of ordered) {
    if (clauses.length >= 3) break;
    const clause = support(worker, breakdown, name);
    if (clause) clauses.push(clause);
  }

  const caveat = STATUS_CAVEAT[worker.status];
  return `${clauses.join(', ')}${caveat ? ` — ${caveat}` : ''}.`;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Score, explain and order the candidates. Ties break on real distance, then
 * rating, then experience, then id — so the same query always returns the same
 * order, which matters when the demo is run twice on stage.
 */
export function rankWorkers<T extends RankCandidate>(
  candidates: T[],
  request: RankRequest = {},
): Array<RankedWorker<T>> {
  return candidates
    .map((worker) => {
      const breakdown = scoreWorker(worker, request);
      return {
        worker,
        score: breakdown.score,
        breakdown,
        reason: rankingReason(worker, breakdown),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.worker.distanceKm - b.worker.distanceKm ||
        b.worker.rating - a.worker.rating ||
        b.worker.jobsCompleted - a.worker.jobsCompleted ||
        a.worker.id.localeCompare(b.worker.id),
    );
}
