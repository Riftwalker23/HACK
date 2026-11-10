/**
 * The canonical review chips (Outcome 5).
 *
 * This is how a customer who does not read comfortably — or who simply will
 * not type a paragraph — leaves a review that the next customer can use. A
 * star alone says "good"; "on time" and "overcharged" say what to expect.
 *
 * Design constraints, in order:
 *  - SMALL. Nine chips fit one screen at 56px touch targets and can all be
 *    read aloud in about fifteen seconds.
 *  - CONCRETE. Every chip names an observable event, not a feeling, so the
 *    trust summary has facts to synthesise rather than adjectives.
 *  - BALANCED. Praise and complaint are both one tap away. A chip set that
 *    only flatters is not trust information.
 *
 * Each chip ships three labels — English for the customer, Urdu for the worker
 * reading his own profile, Roman Urdu for the spoken/Roman UI mode. `id` is
 * what gets stored in `reviews.tags`, so these ids are a stable contract.
 */

import { handle, ok } from '@/lib/http';

// No `runtime` / `dynamic` exports: next.config.ts sets `cacheComponents: true`,
// and Next 16 rejects both route segment configs outright under it ("Route
// segment config ... is not compatible with nextConfig.cacheComponents"). This
// list is constant, so letting it prerender is also the right answer.

export type ReviewTag = {
  id: string;
  labelEn: string;
  labelUr: string;
  labelRoman: string;
  sentiment: 'positive' | 'negative';
};

const REVIEW_TAGS: ReviewTag[] = [
  {
    id: 'on-time',
    labelEn: 'On time',
    labelUr: 'وقت پر آیا',
    labelRoman: 'waqt par aaya',
    sentiment: 'positive',
  },
  {
    id: 'late',
    labelEn: 'Came late',
    labelUr: 'دیر سے آیا',
    labelRoman: 'der se aaya',
    sentiment: 'negative',
  },
  {
    id: 'clean-work',
    labelEn: 'Clean work',
    labelUr: 'کام صاف کیا',
    labelRoman: 'kaam saaf kiya',
    sentiment: 'positive',
  },
  {
    id: 'fair-price',
    labelEn: 'Fair price',
    labelUr: 'مناسب قیمت',
    labelRoman: 'munaasib qeemat',
    sentiment: 'positive',
  },
  {
    id: 'overcharged',
    labelEn: 'Charged more than agreed',
    labelUr: 'طے شدہ سے زیادہ پیسے لیے',
    labelRoman: 'tay shuda se ziyada paise liye',
    sentiment: 'negative',
  },
  {
    id: 'polite',
    labelEn: 'Polite',
    labelUr: 'خوش اخلاق',
    labelRoman: 'khush akhlaaq',
    sentiment: 'positive',
  },
  {
    id: 'explained-problem',
    labelEn: 'Explained the problem',
    labelUr: 'مسئلہ سمجھایا',
    labelRoman: 'masla samjhaya',
    sentiment: 'positive',
  },
  {
    id: 'own-tools',
    labelEn: 'Brought own tools',
    labelUr: 'اپنے اوزار لایا',
    labelRoman: 'apne auzaar laaya',
    sentiment: 'positive',
  },
  {
    id: 'had-to-call-again',
    labelEn: 'Had to call again',
    labelUr: 'دوبارہ بلانا پڑا',
    labelRoman: 'dobara bulana para',
    sentiment: 'negative',
  },
];

export const GET = handle(async () =>
  ok(
    {
      tags: REVIEW_TAGS,
      // Pre-split so the review screen can group praise and complaint without
      // filtering on the client (and without inventing its own order).
      positive: REVIEW_TAGS.filter((t) => t.sentiment === 'positive').map((t) => t.id),
      negative: REVIEW_TAGS.filter((t) => t.sentiment === 'negative').map((t) => t.id),
    },
    {
      count: REVIEW_TAGS.length,
      // Hand-written labels, not model output. Nothing here is AI-generated.
      provider: 'none',
    },
  ),
);
