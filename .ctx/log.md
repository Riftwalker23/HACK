# ctx log — Roshan Rozgar (CUI Tech Fest / AI Web Forge)

## 2026-11-10T10:30:00Z

Cloned https://github.com/Riftwalker23/HACK and extracted
`Roshan_Rozgar_Problem_Statement.pdf` with pdftotext. Brief: build a web platform
connecting Pakistani households to nearby skilled trade workers, usable by
low-literacy workers. Five required outcomes (onboarding, discovery,
communication, booking, trust), judged 30/20/20/15/15 on technical execution,
problem understanding, use of AI, usability, presentation. AI must be
load-bearing — judges explicitly ask what breaks if it is removed.

Wrote and pushed `Design.md` (commit 51ca79d): a copy-paste master design prompt.
Core design decision — **two skins over one system** rather than one app with a
language toggle, because the worker (cannot read or type) and the customer
(wants speed and trust) have opposite constraints. Added the "squint test" as the
worker-side acceptance bar, a trade colour-coding quadruple (colour + glyph +
Urdu word + spoken label) as the accessibility centrepiece, Naskh-for-body /
Nastaliq-for-display type decision, 12 component specs, 16 screens, and a
bilingual copy deck.

Wrote `PROJECT.md`: outcomes-to-features mapping, the "what breaks without the
AI" table, stack (single Next.js app + Postgres, chosen for reliability over
novelty), data model with a partial unique index enforcing one active job per
worker at the DB level, API surface with an explicit ranking formula, seed plan
with three scripted demo accounts, hour-by-hour one-day timeline with an 18:30
feature freeze, a rehearsed 5-minute demo script, and a risk register.

Remaining: none for the docs. Next step for the team is to initialise the
application repo *after* the official start time (originality rule) and build in
demo-script order.

## 2026-11-10T12:05:00Z — backend built (frontend skipped on request)

Scaffolded `roshan-rozgar/` (Next.js 16 App Router, TS strict) and built the
BACKEND ONLY. Pushed as commit 0b3909a. No frontend beyond the create-next-app
default page — that is the next job.

### Two decisions that shape everything downstream
1. **Runs with zero credentials.** `db/client.ts` uses real Postgres when
   `DATABASE_URL` is set and embedded **PGlite** (Postgres compiled to WASM,
   persisted to `.data/pglite`) when it is not. Partial indexes, enums and
   jsonb behave identically, so a fresh clone works offline with no account.
2. **Runs with no AI keys.** `lib/ai/index.ts` dispatches each capability down
   a provider chain (anthropic -> openai -> stub) and ends at a deterministic
   stub that does real keyword and Urdu-number-word parsing. Every result
   carries `meta.provider`; `"stub"` is the disclosure mechanism the brief
   requires. Add `ANTHROPIC_API_KEY` and the same endpoints upgrade silently.

### Getting started in a new IDE
    cd roshan-rozgar && npm install
    npm run setup     # db:generate + db:migrate + seed
    npm run verify    # 11 database invariant checks
    npm run dev
    npm run smoke     # end-to-end, needs dev running

Demo accounts (PIN 0000): worker `Aslam Khan` +923001234567 (electrician, G-9,
FREE, 15y); customer `Ayesha Siddiqui` +923005551234 (G-11). Phone
+923009999999 is RESERVED and deliberately NOT seeded — that is the account to
onboard live by voice during the demo.

### Verified, not assumed
- `npx tsc --noEmit` clean; `npx next build` clean, 25 dynamic API routes.
- `npm run seed` run twice (idempotent). `npm run verify` 11/11 PASS:
  no worker holds >1 active job, BUSY/FREE/OFF counts agree with the job rows,
  the partial index exists and is scoped to the active statuses, ratings equal
  the true review averages, jobsCompleted matches, timestamps ordered,
  every message has both transcript sides.
- Seeded: 7 trades, 60 workers, 12 customers, 261 jobs, 272 messages, 200 reviews.

### Three traps found the hard way — do not re-introduce
1. **`cacheComponents: true`** (a create-next-app default in Next 16) makes
   `export const dynamic`/`runtime` a HARD BUILD ERROR — 26 of them. Removed
   from `next.config.ts`. Do not re-enable it.
2. **Drizzle 0.45 wraps driver errors** in `DrizzleQueryError` with the real
   Postgres error on `.cause`, so a top-level `err.code === '23505'` check
   misses every constraint violation. `lib/http.ts` now walks the cause chain;
   without it the booking race returns 500 instead of 409.
3. **PGlite serialises transactions** on one connection, so a `Promise.all`
   race does not interleave locally — the state machine rejects the loser
   before the index can. Both paths were proven separately. If you want judges
   to see the index itself fire, point the demo at a real Postgres URL.

### Not done / known gaps
- No frontend. `Design.md` holds the full design prompt for it.
- Decline/cancel `reason` is accepted and echoed but NOT persisted (no column).
- The STUB TRANSLATOR is phrase-substitution only, so stubbed "English" still
  contains Urdu fragments. **Do not demo translation without a real API key.**
- `scripts/smoke.ts` has not been run against a live dev server yet.
- Auth is phone + PIN 0000, unhashed. Payments and ID verification are out of
  scope per the brief and are not mocked at all yet.

## 2026-11-10 — backend gaps closed (smoke 34/34 live)

- Decline/cancel `reason` now persisted: `jobs.status_reason` + `jobs.ended_by`
  (migration 0001). Surfaced as `ended: { by, reason }` on every job response;
  accept's auto-decline of competing requests records `by: "system"`.
- Added mocked `POST /api/auth/login` (phone + PIN + role, no session/token).
- Fixed `GET /api/customers` leaking `pin` in list/create responses.
- `scripts/smoke.ts` run live for the first time: 34/34. Its earlier failures
  were script bugs (wrong response paths), not backend bugs.
- Wrote real `README.md` and `.env.example`.

### Still not done (hand to the next IDE)
1. Media upload/storage endpoint (audio + photos); URLs are caller-supplied.
2. Real AI keys: verify every /api/ai/* off the stub; stub translator is weak.
   `GEMINI_API_KEY` is read but no Gemini provider exists.
3. Deploy: hosted Postgres, Vercel, smoke against it, and a real-Postgres
   concurrent double-accept test (PGlite serialises the race).

## 2026-11-10 — Supabase + ElevenLabs connected and verified live

- Supabase Postgres via the SESSION POOLER string (the direct `db.<ref>` host is
  IPv6-only and does not resolve on most home networks). Migrated + seeded;
  `npm run verify` 11/11 on real Postgres, smoke 34/34 through the app.
- Migration 0002 enables RLS on every table so Supabase's public REST API cannot
  read them; the app connects directly as owner and is unaffected.
- Supabase Storage: `POST /api/upload` (bucket auto-created, local-disk fallback).
  `SUPABASE_URL` is reduced to its origin, so a pasted ".../rest/v1/" still works.
- ElevenLabs: Scribe (`scribe_v1`) now leads the transcribe chain; TTS at
  `/api/ai/speak` (`eleven_v3`, disk-cached). Free plan = premade voices only
  (default "Alice"); library voices return 402.
- `npm run check:integrations` tests DB, Storage and ElevenLabs without printing keys.
- Seed WITHOUT `--keep` TRUNCATEs all app tables. Use `npm run seed -- --keep`
  on any database that might hold real data.
- Windows gotchas hit while testing: Urdu text on a curl command line is mangled
  (percent-encode it), and `ls -l | awk '{print $5}'` returns the group id here.

### Still not done
1. Anthropic/OpenAI keys not set: extraction, classification, translation,
   summaries, vision still run on the stub (translation is the weak one).
2. No auth/rate limit on /api/upload and /api/ai/speak (spends ElevenLabs credit).
3. Deploy (Vercel), and a true concurrent double-accept test on real Postgres
   (client pool is max:1, so requests still serialise).
