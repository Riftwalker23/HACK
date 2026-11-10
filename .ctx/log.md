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

## 2026-11-10T12:18:00Z — Media upload implemented & verified (Task 1)

Added `lib/storage.ts`, `POST /api/upload`, and `GET /api/upload/[name]`:
- Supports audio (webm/mp4/wav, <= 5 MB) and images (jpeg/png/webp, <= 5 MB).
- Uploads to Supabase Storage if `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are configured, otherwise falls back to `.data/uploads` and serves with immutable caching and path traversal defense.
- Wired `photoUrl`, `audioUrl`, and work-photos into `POST /api/workers`, `PATCH /api/workers/:id`, `POST /api/workers/:id/photos`, and enabled image/audio URL ingestion directly into `/api/ai/*` endpoints. Verified via `scripts/test-upload.ts`.


## 2026-11-10T13:10:00Z — tasks 1-3: upload, README, race proof; first live smoke run

Pushed as f113668, rebased onto a teammate's UI/Figma commit (f2298a4). No
file overlap between the two.

### First end-to-end smoke run — 35/35, and it found two real bugs
`scripts/smoke.ts` had never been run against a live server. It caught:
1. **POST /api/jobs rejected EVERY AI classification.** The route's zod
   required `provider` INSIDE `aiClassification`, but `/api/ai/classify-problem`
   reports the provider in `meta`, so any client forwarding `data` verbatim got
   a 400. Fixed both ways: the route defaults it to `'unreported'` rather than
   losing a job request over a provenance label, and classify-problem now
   carries `provider` in the payload so it reaches the jsonb column.
2. Three smoke assertions read the wrong paths. `ranking.reason` is NESTED
   under `ranking`; the transition endpoints return `{ job, ... }` while
   `POST /api/jobs` returns the job view directly. The test was wrong, not the
   API — but note that response-shape asymmetry when building the frontend.

Lesson: per-slice agent verification passed while the seams between slices
were broken. The end-to-end test is what found it. Run `npm run smoke` after
every change, not just at the end.

### Task 1 — media upload (built by an earlier session, audited here)
`POST /api/upload`, `GET /api/upload/[name]`, `POST /api/workers/[id]/photos`,
`lib/storage.ts`. Supabase Storage when configured, else `.data/uploads`.
Audit: path traversal is correctly blocked, and the served Content-Type is
derived from the EXTENSION against an allow-list rather than from client input.
Hardened the serve path with `X-Content-Type-Options: nosniff` and a sandbox
CSP, since it returns user-uploaded bytes from our own origin.
**Still open:** MIME type is taken from the client with no magic-byte sniff.

### Task 3 — deploy readiness
Real README written (setup, stack, all 27 routes, every AI service with model
id and its "what breaks without it" line, seed inventory, demo accounts, an
explicit table of what the stub does REALLY vs FAKES, ten limitations, and the
AI-coding-assistant disclosure the rules require). `.env.example` extended with
the Supabase variables.

**`.gitignore` trap:** create-next-app ships `.env*`, which silently untracked
`.env.example` — a required deliverable that would simply have been missing
from the repo. Added a `!.env.example` negation. Check `git ls-tree` for
deliverables rather than trusting `git status`.

### Task 3 — race proof: `npm run race`, 22 assertions
Proves `one_active_job_per_worker` three independent ways: present in
`pg_indexes` covering exactly the three active statuses; raw SQL double-accept
refused with SQLSTATE 23505 naming the constraint, with NO application code in
the path; and the real accept route returning a clean `409 WORKER_BUSY` with
`details.enforcedBy: 'database'`. Self-cleaning fixtures, verified idempotent
over four runs.

On PGlite the `Promise.allSettled` race is won by the STATE MACHINE
(`409 INVALID_TRANSITION`), not the index, because drizzle's PGlite driver
delegates to `client.transaction()` which serialises behind a mutex. The script
accepts either guard and names which fired. Only one thing is unprovable
locally: that two accept transactions genuinely overlap in time.

### !! OPEN RISK — not fixed, needs real Postgres to confirm
On a genuinely concurrent Postgres the accept route may **DEADLOCK**:
tx1 locks job A `FOR UPDATE` and inserts the index tuple; tx2 blocks on it;
tx1's auto-DECLINE sweep then needs job B, which tx2 holds. Cycle → Postgres
raises 40P01 → `lib/http.ts` maps it to INTERNAL → **HTTP 500, not the 409 the
pitch promises.** Consistency still holds either way, but the demo would show
the wrong thing on the one database where the claim is meant to shine.
Proposed fix (NOT applied): drop `.for('update')` on the initial re-read in
`app/api/jobs/[id]/accept/route.ts` — the conditional
`UPDATE ... AND status='REQUESTED'` already guards the write, and without the
row lock held across the index insert the cycle disappears, so tx2 resolves
into a genuine 23505 → `rethrowAsWorkerBusy` → clean 409.
**Verify against a real DATABASE_URL before changing it.** This is
lock-ordering analysis, not a reproduced failure.

### Still blocked on credentials (cannot be resolved locally)
- **Real AI verification** needs `ANTHROPIC_API_KEY` + `OPENAI_API_KEY`. The
  Anthropic and Whisper paths are written and typechecked but have NEVER been
  executed. Run `npm run ai:check:real` once keys exist — it fails on any stub.
- **migrate/seed/verify/smoke against real Postgres** needs `DATABASE_URL`.
  Everything so far was proven on PGlite only.

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

## 2026-11-10 — merged the Anti-Gravity work with the Supabase/ElevenLabs work

Both sides had independently built media upload. Reconciled, not duplicated:
- `lib/storage.ts` is ONE file: the other side's exported API (`storeMedia`,
  `getLocalUpload`, `detectMediaKind`, `MAX_MEDIA_BYTES`) on top of the robust
  internals (auto-created bucket, works with both `service_role` JWT and
  `sb_secret_` keys, origin-only SUPABASE_URL, local-disk fallback with
  `fallbackReason`). Upload routes are the other side's (they add a sandbox CSP).
  Names are always `<kind>-<uuid>.<ext-from-mime>`; `preferredName` is ignored.
- Default bucket is `roshan-media` (the other side's draft said `uploads`).
- README is the other side's, updated for ElevenLabs/Supabase/login; the stale
  claims (decline reasons not stored, nothing run on real Postgres) were corrected.
- Verified on the merge, against real Supabase Postgres: verify 11/11, smoke
  35/35, race 22/22 (index raises 23505 -> clean 409 WORKER_BUSY; the two
  simultaneous accepts did NOT truly interleave - pool is max:1), integrations 7/7,
  their upload test passes in local mode.
- A full `npm run seed` on Supabase was blocked by the permission checker (it
  TRUNCATEs a remote DB). The smoke run left one test worker/job/review in
  Supabase; reseed deliberately, or leave it.

## 2026-11-10T17:00:00+05:00
Confirmed the Next.js app is in `roshan-rozgar` and attempted `npm run dev`. An existing dev server (PID 4600) is already serving the project at http://localhost:3000; the second launch exited because that server owns the dev lock.

## 2026-11-10T13:19:41+05:00
Diagnosed the black screen as a Turbopack CSS worker crash (Windows process exit 0xc0000142). Restarted Next 16 in Webpack dev mode; `/` now returns HTTP 200 with the Roshan Rozgar title and splash content. Updated `package.json` so future `npm run dev` uses Webpack by default. The server is running at http://localhost:3000.

## 2026-11-10T13:34:58+05:00
Replaced static customer request/results/live-review screens with API-backed classification, media upload, ranked search, booking, status polling, price confirmation, bilingual text chat, and review submission. Replaced static worker home/chat with demo login, live request polling, availability control, accept/price/start/complete actions, and translated chat. Added a direct worker dashboard link from role selection. TypeScript passes; auth, trades, and worker search endpoints responded successfully, and all six changed routes returned HTTP 200. Browser inspection via CUA timed out; direct route/API checks succeeded.

## 2026-11-10T13:37:05+05:00
Finalized availability persistence and the review submission path. `npm run typecheck` passes, and the root plus all six functional customer/worker routes return HTTP 200 from the live dev server. Read-only backend checks confirm demo login, trade list, and available-worker search are reachable; no test booking/review was written to the database.

## 2026-11-10 — Gemini provider (real text + vision AI)

- `lib/ai/gemini.ts`: all six text/vision capabilities over the REST API, JSON
  constrained by schema and validated with zod. `ai:check:real` 26/27 (the one
  stub is transcription of a no-speech test tone, which is correct).
- Prompts and schemas moved to `lib/ai/prompts.ts`, shared by Claude and Gemini.
  Translation now handles all four language labels (Claude used to translate
  into Urdu script when Roman Urdu was asked for).
- Gemini is EXCLUDED from speech-to-text: on a 0.25s tone it returned a full,
  invented Urdu customer request built from its prompt's example words.
- Free-tier quota is per model and tiny (3 test runs exhausted
  gemini-3-flash-preview for the day). GEMINI_MODEL is a comma-separated chain;
  429/404 models are benched and skipped. Enable billing before demo day.
