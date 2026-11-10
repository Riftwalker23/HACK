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
| Urdu speech-to-text | OpenAI | `whisper-1` | Worker cannot onboard by voice server-side (browser Web Speech API is the client fallback) |
| Profile extraction | Anthropic | `claude-opus-5-5` | Speech is not a searchable profile |
| Problem classification, photo tagging | Anthropic | `claude-sonnet-5-5` | Customer must diagnose the trade herself |
| Translation Urdu <-> English | Anthropic | `claude-sonnet-5-5` | Worker and customer cannot negotiate |
| Spoken quote -> structured price | Anthropic | `claude-sonnet-5-5` | No record of what was agreed |
| Review synthesis | Anthropic | `claude-sonnet-5-5` | Next customer gets raw stars only |

Responses are cached by input hash (`lib/ai/cache.ts`). A `GEMINI_API_KEY` slot
exists in `lib/env.ts` but **no Gemini provider is implemented**.

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
- No media upload or storage: `audioUrl` / `photoUrl` are caller-supplied strings.
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
