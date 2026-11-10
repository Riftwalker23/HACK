# Roshan Rozgar — backend

Hyper-local marketplace connecting Pakistani households with nearby skilled trade
workers, built for workers who cannot read or type comfortably. CUI Tech Fest —
AI Web Forge.

> **Status: backend complete, frontend not started.** This repo holds the API,
> data layer, AI layer and booking state machine. Design for the UI lives in the
> planning repo's `Design.md`; the build plan is `PROJECT.md`.

## The five required outcomes

| # | Outcome | Where it lives |
|---|---|---|
| 1 | Onboarding without forms | `/api/ai/transcribe`, `/api/ai/extract-profile`, `/api/ai/tag-photo`, `POST /api/workers` |
| 2 | Discovery of a nearby, available worker | `/api/ai/classify-problem`, `GET /api/workers` (ranked, with reasons) |
| 3 | Communication and price agreement | `/api/messages` (bilingual voice notes), `/api/ai/extract-price`, `/api/jobs/:id/price` |
| 4 | Booking that stays consistent | `/api/jobs/*` state machine + DB partial unique index |
| 5 | Trust after the job | `/api/reviews`, `/api/ai/summarise-reviews`, trust summary on `/api/workers/:id` |

## Quick start

```bash
cd roshan-rozgar
npm install
npm run setup     # db:generate + db:migrate + seed
npm run verify    # 11 database invariant checks
npm run dev       # http://localhost:3000
npm run smoke     # in a second terminal: walks all five outcomes over HTTP
```

No account, database or API key is needed. Copy `.env.example` to `.env` to add
any of them. `npm run db:reset` wipes the embedded database.

Demo accounts (PIN `0000`):

| Role | Name | Phone |
|---|---|---|
| Worker | Aslam Khan — electrician, G-9, FREE, 15 yrs | `+923001234567` |
| Customer | Ayesha Siddiqui — G-11 | `+923005551234` |
| (reserved, not seeded) | onboard live by voice | `+923009999999` |

## Tech stack

Next.js 16 (App Router, route handlers) · TypeScript strict · Drizzle ORM ·
Postgres (real via `DATABASE_URL`, otherwise embedded **PGlite**) · Zod ·
Anthropic SDK.

## AI services

Each capability tries `anthropic -> openai -> stub`. **Every response carries
`meta.provider`**; `"stub"` means no real model answered and the UI must say so.

| Purpose | Provider | Model | What breaks without it |
|---|---|---|---|
| Urdu speech-to-text (primary) | ElevenLabs | `scribe_v1` | Worker cannot onboard by voice server-side (browser Web Speech API is the client fallback) |
| Urdu speech-to-text (fallback) | OpenAI | `whisper-1` | Used when Scribe is unavailable |
| Read prompts aloud (text-to-speech) | ElevenLabs | `eleven_v3` | Worker who cannot read hears nothing; the frontend falls back to browser speech |
| Profile extraction | Anthropic | `claude-opus-5-5` | Speech is not a searchable profile |
| Problem classification, photo tagging | Anthropic | `claude-sonnet-5-5` | Customer must diagnose the trade herself |
| Translation Urdu <-> English | Anthropic | `claude-sonnet-5-5` | Worker and customer cannot negotiate |
| Spoken quote -> structured price | Anthropic | `claude-sonnet-5-5` | No record of what was agreed |
| Review synthesis | Anthropic | `claude-sonnet-5-5` | Next customer gets raw stars only |

Responses are cached by input hash (`lib/ai/cache.ts`). A `GEMINI_API_KEY` slot
exists in `lib/env.ts` but **no Gemini provider is implemented**.

## Connecting Supabase and ElevenLabs

Everything below is optional; each piece falls back on its own. Put the values in
`.env` (gitignored), then run `npm run check:integrations`.

| Service | `.env` keys | Without it |
|---|---|---|
| Supabase Postgres | `DATABASE_URL` (use the **Session pooler** string; the direct host is IPv6-only) | Embedded PGlite |
| Supabase Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (server-only) | Uploads saved to `.data/uploads` |
| ElevenLabs | `ELEVENLABS_API_KEY` | Speech-to-text falls back to Whisper, then the stub; `/api/ai/speak` returns an error and the UI uses browser speech |

After setting `DATABASE_URL`, run `npm run db:migrate && npm run seed` once so the
Supabase database has the schema and demo data. The migrations also enable
row-level security on every table, so Supabase's public REST API cannot read
them; the app connects directly as the table owner and is unaffected.

New endpoints: `POST /api/upload` (multipart `file`; audio up to 8 MB, jpeg/png/webp
up to 5 MB; returns `{ url, driver }`), `GET /api/upload/:name` (local-disk files
only), and `GET|POST /api/ai/speak` (text up to 500 chars, returns `audio/mpeg`,
cached on disk by text hash). `GET /api/health` reports which service each path
is using under `services`.

## Booking consistency (Outcome 4)

`db/schema.ts` defines a partial unique index:

```sql
CREATE UNIQUE INDEX one_active_job_per_worker
  ON jobs (worker_id) WHERE status IN ('ACCEPTED','PRICE_AGREED','IN_PROGRESS');
```

Accepting a job runs in one transaction: job -> `ACCEPTED`, worker -> `BUSY`, and
every other `REQUESTED` job for that worker is auto-declined (`ended.by =
"system"`). Completing flips the worker back to `FREE`. A lost race returns
`409 WORKER_BUSY`. Legal transitions are in `lib/jobs-state.ts`.

Declined and cancelled jobs store `statusReason` and `endedBy`, returned as
`ended: { by, reason }` on every job response.

## API

All responses use one envelope: `{ ok: true, data, meta? }` or
`{ ok: false, error: { code, message, details? } }`.

```
GET  /api/health                    driver, AI providers, row counts
GET  /api/trades
POST /api/auth/login                { phone, pin, role }  (MOCKED, no session)
GET  /api/customers   POST /api/customers
GET  /api/workers     POST /api/workers
GET  /api/workers/:id PATCH /api/workers/:id
POST /api/jobs        GET  /api/jobs/:id
POST /api/jobs/:id/{accept,decline,price,start,complete,cancel}
GET  /api/messages?jobId&after      POST /api/messages     (poll for realtime)
POST /api/messages/transcribe
POST /api/reviews     GET  /api/reviews/tags
POST /api/ai/{transcribe,extract-profile,tag-photo,classify-problem,
              translate,extract-price,summarise-reviews}
```

`GET /api/workers` params: `lat`, `lng`, `trade`, `available`, `radiusKm`,
`keywords`, `limit`. Each result carries `distanceKm` and `ranking.reason`.
Score: `0.40*available + 0.25*exp(-km/4) + 0.20*skill_match + 0.15*rating/5`.

## What is seeded, mocked and real

- **Seeded:** 7 trades, 60 workers, 12 customers, 261 jobs, 272 messages,
  200 reviews. Idempotent (`npm run seed`). Photos are `picsum.photos`
  placeholders, not real work photos.
- **Mocked:** phone + PIN auth (plaintext PIN, no sessions or tokens, endpoints
  do not enforce identity); OTP; payments; ID verification. The last three are
  out of scope per the brief and not built at all.
- **Real:** geo/ranking, all booking transitions and the DB constraint, review
  aggregation.
- **AI:** real only when keys are set. Otherwise a rule-based stub (keyword and
  Urdu number-word parsing) answers, labelled `provider: "stub"`.

## Known limitations

- No frontend yet.
- Uploads are unauthenticated and `/api/ai/speak` spends ElevenLabs credit on any
  caller; both are capped by size/length but have no rate limit.
- The stub translator is phrase substitution; stubbed "English" still contains
  Urdu fragments. Do not demo translation without a real key.
- PGlite serialises transactions, so a local `Promise.all` race never reaches the
  index; point `DATABASE_URL` at real Postgres to watch it fire.
- No auth enforcement: any caller can act as any actor.
- Not deployed.

## Scripts

`dev`, `build`, `typecheck`, `lint`, `db:generate`, `db:migrate`, `db:reset`,
`seed`, `setup`, `verify`, `smoke` (`BASE_URL=... npm run smoke` for a deployed
instance).

## AI coding assistants

Built with Claude Code (Anthropic). Disclosed per the event rules.

## Credits

Next.js, Drizzle ORM, PGlite (ElectricSQL), Zod, Anthropic SDK. Placeholder
photos from picsum.photos.
