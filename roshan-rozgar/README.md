# Roshan Rozgar — روشن روزگار

**A hyper-local marketplace for skilled trade workers.**
CUI Tech Fest · AI Web Forge Hackathon · COMSATS University Islamabad

> 72.1% of Pakistan's non-agricultural employment is informal (Pakistan Bureau of Statistics).
> An electrician with fifteen years of experience finds work by standing at a street-corner *adda*,
> because every job portal ever built asks him to fill in a form and upload a CV.
> **This is the version that does not ask him to read.**

---

## What it does

Five outcomes, both roles, one flow:

| # | Outcome | How |
|---|---|---|
| 1 | **Onboarding** — a worker builds a complete profile without reading or typing | A four-step **voice interview**. Speech is transcribed, then an LLM extracts name, trade, years, area, skills and rate band. Trade is confirmed from an icon grid. Work photos are auto-tagged and the tags become searchable skills. |
| 2 | **Discovery** — a customer finds someone nearby and free *now* | She describes the problem by **text, voice, or photo**. The AI classifies trade, urgency and likely fix. Results are ranked `availability → distance → skill match → rating`, and **each card shows the reason it ranked there**. |
| 3 | **Communication** — both sides agree a job and a price without typing | Voice-note-first chat. Every message row carries **both** an Urdu and an English transcript, so he speaks and she reads off the same row. A spoken quote is parsed into a structured price both sides confirm. |
| 4 | **Booking** — confirmed, and availability stays honest | A state machine with transactional transitions, and a **partial unique index** that makes two concurrent active jobs for one worker impossible *in the database*. |
| 5 | **Trust** — the next customer gets something better than a neighbour's guess | Stars, tappable tag chips, and a **spoken review**. All of a worker's reviews are synthesised into a trust summary shown *with its source count*. |

### Current state: backend complete, frontend not started

This repository is the **backend**. There is no UI beyond the default Next.js page. The full
front-end design specification is in [`../Design.md`](../Design.md), written to be used directly as a
build prompt. Planning and architecture are in [`../PROJECT.md`](../PROJECT.md); the running
engineering log is [`../.ctx/log.md`](../.ctx/log.md).

---

## Quick start

No accounts, no credentials, no network required.

```bash
cd roshan-rozgar
npm install
npm run setup     # db:generate + db:migrate + seed
npm run dev
```

Then in a second terminal:

```bash
npm run verify    # 11 database invariant checks
npm run smoke     # end-to-end walk of all five outcomes over HTTP
```

**Why it works with nothing configured.** Two deliberate fallbacks:

1. **Database.** `DATABASE_URL` set → real Postgres. Unset → **PGlite**, an embedded Postgres
   compiled to WASM, persisted to `.data/pglite`. It is real Postgres, so partial unique indexes,
   enums and `jsonb` behave exactly as in production.
2. **AI.** Each capability walks a provider chain (`anthropic → openai → stub`) ending at a
   deterministic offline stub. Every response carries `meta.provider`, and `"stub"` is how the system
   discloses that no model was involved. Add a key and the same endpoints upgrade silently.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run setup` | Generate migration, apply it, seed |
| `npm run db:reset` | Delete `.data/` (embedded DB + uploads + AI cache) |
| `npm run verify` | 11 DB invariant checks — run before demoing |
| `npm run smoke` | End-to-end HTTP walk of the demo script (needs `dev` running) |
| `npm run race` | Concurrent double-accept test against the booking index |
| `npm run ai:check` | Per-endpoint AI report: provider, latency, pass/fail |
| `npm run ai:check:real` | Same, but **fails** if anything was served by the stub |
| `npm run check:integrations` | Tests the real Supabase DB, Supabase Storage and ElevenLabs from your `.env` (never prints keys) |
| `npm run preflight` | typecheck + build + verify + race + ai:check |

---

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.4** (App Router), TypeScript strict | One repo, one deploy, API routes beside the future UI |
| Database | **Postgres**; **PGlite 0.5** embedded fallback | Zero-credential local runs with production semantics |
| ORM / migrations | **Drizzle ORM 0.45** + drizzle-kit | Fast migrations, no codegen step |
| Validation | **Zod 4** | One schema per boundary, field-level 400s |
| Media | Local disk, or **Supabase Storage** when configured | Vercel's filesystem is ephemeral, so a deployed demo needs Supabase |
| Hosting | Vercel (plus a local instance as demo backup) | |

> `next.config.ts` deliberately does **not** set `cacheComponents`. It is a `create-next-app`
> default in Next 16 and makes `export const dynamic` a hard build error — 26 of them here. Every
> route in this API must execute per request against the database. Do not re-enable it.

### API surface — 29 routes

```
GET  /api/health                      driver, providers, counts, stubbed?
GET  /api/trades                      7 trades + live free-worker counts

POST /api/ai/transcribe               audio        -> { textUr, textRoman, confidence }
POST /api/ai/extract-profile          transcript   -> structured profile + `missing[]`
POST /api/ai/tag-photo                image        -> { tags[], tradeGuess }
POST /api/ai/classify-problem         text|image   -> { tradeSlug, urgency, likelyFix, keywords[] }
POST /api/ai/translate                text, from, to
POST /api/ai/extract-price            transcript   -> { amount, unit, includes[], ambiguous }
POST /api/ai/summarise-reviews        workerId     -> trust summary (upserted)
GET|POST /api/ai/speak                text (<=500 chars) -> audio/mpeg (ElevenLabs TTS, disk-cached)

POST /api/auth/login                  { phone, pin, role } -> user (MOCKED: no session or token)

GET  /api/workers                     ranked search: lat, lng, trade, available, radiusKm, keywords
POST /api/workers                     create from an extracted voice profile (transactional)
GET  /api/workers/[id]                full profile + skills + photos + trust + recent reviews
PATCH /api/workers/[id]               availability + editable fields (refuses to lie about status)
POST /api/workers/[id]/photos         attach work photos

POST /api/jobs                        create request      GET /api/jobs  list (polling fallback)
GET  /api/jobs/[id]
POST /api/jobs/[id]/accept            transactional: job ACCEPTED + worker BUSY + auto-decline rest
POST /api/jobs/[id]/decline           optional { reason } — stored; job responses carry ended: { by, reason }
POST /api/jobs/[id]/price             propose / confirm -> PRICE_AGREED when both agree
POST /api/jobs/[id]/start
POST /api/jobs/[id]/complete          transactional: COMPLETED + worker FREE + jobsCompleted++
POST /api/jobs/[id]/cancel

GET  /api/messages                    ?jobId&after&limit — oldest-first polling fallback
POST /api/messages                    voice / text / chip; always stores BOTH transcript sides
POST /api/messages/transcribe         one-call path: audio -> transcript -> translation -> message
GET  /api/reviews                     ?workerId — with star distribution + tag frequency
POST /api/reviews                     stars + tags + spoken review; recomputes rating
GET  /api/reviews/tags                the 9 canonical tag chips (en / ur / roman)

POST /api/upload                      multipart audio/image, max 5 MB -> { url, driver: supabase|local }
GET  /api/upload/[name]               serves local-disk uploads (Supabase files are served by Supabase)
GET  /api/customers    POST /api/customers
```

Every response uses one envelope: `{ ok: true, data, meta? }` or
`{ ok: false, error: { code, message, details? } }`.

---

## AI services used

Every service, with the exact model id and — the question the judges said they will ask — what
stops working without it.

| Capability | Provider | Model id | Barrier removed | What breaks without it |
|---|---|---|---|---|
| Speech-to-text (Urdu) | ElevenLabs Scribe, then OpenAI Whisper | `scribe_v1`, `whisper-1` | Literacy | **The worker cannot onboard at all.** There is no other input path he can use. |
| Profile extraction | Anthropic | `claude-opus-5-5` | Literacy + forms | Raw audio is not a searchable profile. No extraction, no discoverability. |
| Work-photo tagging | Anthropic (vision) | `claude-sonnet-5-5` | No CV, no written proof | Photos become decoration instead of evidence of a specific skill. |
| Problem classification | Anthropic (text + vision) | `claude-sonnet-5-5` | She doesn't know the trade name | She must diagnose her own fault before she can ask for help. |
| Urdu ↔ English translation | Anthropic | `claude-sonnet-5-5` | Language asymmetry | The two users literally cannot negotiate. |
| Spoken-quote → structured price | Anthropic | `claude-sonnet-5-5` | Speed, disputes | No record of what was agreed out loud. |
| Review synthesis | Anthropic | `claude-sonnet-5-5` | Trust | The next customer is back to asking a neighbour. |
| Text-to-speech | ElevenLabs (falls back to browser `SpeechSynthesis`) | `eleven_v3` | Literacy | Nothing is read aloud; the worker flow stops being usable. |

Configured via `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_HEAVY`, `OPENAI_STT_MODEL`, `ELEVENLABS_STT_MODEL`,
`ELEVENLABS_TTS_MODEL` and `ELEVENLABS_VOICE_ID` — see `.env.example`. A Gemini slot exists as a second fallback but is not implemented.

Run `npm run ai:check` for a live per-endpoint report of provider, latency and pass/fail.

### Connecting Supabase and ElevenLabs

Both are optional and each falls back on its own. Put the values in `.env` (gitignored), then run
`npm run check:integrations`.

| Service | `.env` keys | Without it |
|---|---|---|
| Supabase Postgres | `DATABASE_URL` — use the **Session pooler** string (Connect → Session pooler). The *direct* host is IPv6-only and fails on most home networks | Embedded PGlite |
| Supabase Storage | `SUPABASE_URL` (bare project URL), `SUPABASE_SERVICE_KEY` (server-only), optional `SUPABASE_BUCKET` (default `roshan-media`, created automatically) | Uploads saved to `.data/uploads` |
| ElevenLabs | `ELEVENLABS_API_KEY` | Speech-to-text falls back to Whisper, then the stub; `/api/ai/speak` returns an error and the UI uses browser speech |

After pointing `DATABASE_URL` at Supabase run `npm run db:migrate` and then `npm run seed -- --keep`
(`--keep` does nothing if the database already has workers; a plain `npm run seed` **truncates** the app
tables first). Migration `0002_enable_rls` turns on row-level security for every table so Supabase's
public REST API cannot read them; the app connects directly as the table owner and is unaffected.

ElevenLabs free plans can only use *premade* voices over the API (library voices return 402); the default
voice is the premade "Alice". `eleven_v3` is the model family that covers Urdu.

### AI coding assistants — disclosure

Per the rules, this is disclosed in full: **this project was built with Claude (Claude Code)**,
used for architecture, implementation, test authoring and documentation, including parallel agents
for independent backend slices. All project-specific code was written during the hacking window.
Design and architecture decisions are recorded with their reasoning in `../.ctx/log.md`.

---

## What is seeded, mocked, or faked

The brief requires this to be explicit, and that mocked functionality is never presented as
working. Deterministic seed (fixed PRNG, identical every run):

| | Count |
|---|---|
| Trades | 7 |
| Workers | 60 (≈40% FREE, 25% BUSY, 35% OFF) |
| Customers | 12 |
| Jobs | 261 (220 COMPLETED, 15 active, rest declined/cancelled/requested) |
| Messages | 272 (bilingual) |
| Reviews | 200 |

**Scripted demo accounts** — PIN `0000`:

| Role | Name | Phone | Notes |
|---|---|---|---|
| Worker | Aslam Khan | `+923001234567` | Electrician, G-9 Islamabad, **FREE**, 15y, strong history |
| Worker | *(reserved)* | `+923009999999` | **Deliberately not seeded** — the account onboarded live by voice during the demo |
| Customer | Ayesha Siddiqui | `+923005551234` | G-11 Islamabad, so seeded workers are plausibly nearby |

### Mocked

- **Auth** — `POST /api/auth/login` checks phone + 4-digit PIN (`0000` for seeded accounts), stored unhashed. It issues no session or token and no endpoint enforces it. No OTP is sent; nothing is verified. PINs are never returned by any endpoint.
- **Payments** — out of scope per the brief. Not implemented, not even mocked.
- **Identity verification** against government databases — out of scope per the brief.
- **Work photos** — `picsum.photos` placeholders, not real work.
- **Seeded AI columns** — every AI-derived column in the seed is marked `aiProvider: 'stub'`.

### Faked, and labelled as such

With no API keys present the stub serves every AI endpoint. Some of it does real work; some is a
placeholder. Honest breakdown:

| Stub capability | Real work, or fake? |
|---|---|
| `classifyProblem` | **Real.** Keyword scoring across English, Urdu script and Roman Urdu. Genuinely useful offline. |
| `extractPrice` | **Real.** Parses digits plus Urdu number words (`hazaar`, `sau`, `dhai`, `saarhay`, `lakh`) and detects ranges. |
| `extractProfile` | **Real.** Keyword and regex extraction of trade, years, area and skills. |
| `summariseReviews` | **Real.** Computed from the actual rows — average, tag frequency, counts. |
| `transcribe` | **FAKE.** Cannot transcribe audio. Returns a deterministic placeholder sentence chosen by hashing the bytes. |
| `tagPhoto` | **FAKE.** Cannot see the image. Returns deterministic plausible tags from a hash. |
| `translate` | **Substitution only.** A small phrase dictionary plus passthrough. Stubbed "English" still contains Urdu fragments. |

> **Do not demonstrate transcription, photo tagging or translation on stub output.** Those three need
> a real key. Everything else is genuinely functional offline. `GET /api/health` returns
> `stubbed: true/false` so you always know which mode you are in.

---

## Known limitations

1. **No frontend.** Backend only. `../Design.md` holds the full UI specification.
2. **Translation under the stub is unusable** for a demo (see above). Needs `ANTHROPIC_API_KEY`.
3. **Only the ElevenLabs paths are verified against a live API.** Scribe speech-to-text and `eleven_v3`
   text-to-speech were exercised for real (Urdu round trip, 0.95 confidence). The Anthropic and Whisper paths
   are written and type-checked but have not run against live APIs — no keys were available. Run
   `npm run ai:check:real` once keys are set; it fails loudly on any stub.
4. **PGlite serialises transactions** on a single connection, so a local `Promise.all` race does not
   truly interleave: the state machine rejects the loser before the index can. `npm run race` proves
   the index separately with raw SQL and proves the clean 409 end to end. For judges to watch the
   index itself fire under real concurrency, point `DATABASE_URL` at a real Postgres.
5. **Real Postgres is verified, but not under real concurrency.** Migrate + seed + `verify` (11/11) and the
   full smoke test pass against Supabase Postgres. The client pool is `max: 1`, so concurrent requests are
   still serialised there too.
6. **Spend is uncapped.** `/api/upload` and `/api/ai/speak` are unauthenticated; the latter spends ElevenLabs
   credit for any caller (capped at 500 characters per request, and cached by text hash).
7. **Local uploads do not survive a Vercel redeploy** (ephemeral filesystem). Set the Supabase
   Storage variables for a deployed demo.
8. **Upload MIME type is taken from the client.** Size, extension and type are validated against an
   allow-list and the serve path sets `nosniff` + a sandbox CSP, but there is no magic-byte sniff.
9. **No rate limiting and no authorisation checks.** Any caller may act as any role; the `actor`
   field on job transitions is asserted against the state machine, not against a session.
10. **Image resizing to 1280px is specified as client-side** and is therefore not enforced server
    side beyond the 5 MB cap.

---

## Credits

- **Next.js**, **React** — Vercel (MIT)
- **Drizzle ORM** / drizzle-kit (Apache-2.0)
- **PGlite** — ElectricSQL (Apache-2.0)
- **Zod** (MIT) · **postgres.js** (Unlicense) · **tsx** (MIT)
- **Anthropic SDK** (MIT); Claude models by Anthropic
- **Whisper** — OpenAI
- **Scribe** speech-to-text and **eleven_v3** text-to-speech — ElevenLabs
- **Supabase** — Postgres and Storage
- Seed photo placeholders — [picsum.photos](https://picsum.photos)
- Urdu typography intended for the UI — **Noto Naskh Arabic** and **Noto Nastaliq Urdu**, Google (OFL)
- Statistic in the opening quote — Pakistan Bureau of Statistics, Labour Force Survey
- Area coordinates — Islamabad and Rawalpindi, OpenStreetMap data (ODbL)

No code was copied from any prior project. All project-specific code in this repository was written
during the hackathon window.
