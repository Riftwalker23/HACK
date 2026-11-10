# PROJECT.md — Roshan Rozgar: Complete Build Plan

**Event:** COMSATS University Islamabad · CUI Tech Fest · AI Web Forge Hackathon
**Track:** Full-Stack Web Development & Applied AI
**Venue:** Academic Block II, CUI Islamabad · **Duration:** 9:30 AM to submission deadline
**Source of truth:** [`Roshan_Rozgar_Problem_Statement.pdf`](Roshan_Rozgar_Problem_Statement.pdf)
**Design prompt:** [`Design.md`](Design.md)

---

## 1. The problem in one paragraph

72.1% of Pakistan's non-agricultural employment is informal (Pakistan Bureau of Statistics). Skilled trade
workers — electricians, plumbers, AC technicians, carpenters, mechanics — are a large share of that. They
find work at a street-corner *adda*, through contractors, or by word of mouth. Existing job portals never
reached them because every portal assumes a user who reads comfortably, types into forms, and has a CV.
Meanwhile households, when something breaks, have no reliable way to find a worker who is **nearby**,
**free right now**, **competent for that specific job**, and **safe to let into the home**.

**Build:** a web platform that connects households with nearby skilled trade workers, usable by workers
with limited literacy, that finds an available worker fast, and that gives the customer a real basis for
trust.

The brief defines **outcomes, not features**. Every feature below exists to serve a numbered outcome.

---

## 2. The five required outcomes → what we build

A valid submission demonstrates all five, **working together as one flow, for both roles**.

| # | Outcome (as stated in the brief) | What we build | Demo proof |
|---|---|---|---|
| 1 | **Onboarding.** A trade worker creates a complete, useful profile without reading or typing into a conventional sign-up form. | 4-step **voice interview**. Worker speaks; STT transcribes Urdu/Roman Urdu; an LLM extracts name, trade, years, area, skills, rate. Trade confirmed by icon grid. Work photos auto-tagged by a vision model. Profile read back aloud before publishing. | Judge speaks into the phone in Urdu; a full profile appears. Keyboard never used. |
| 2 | **Discovery.** A customer finds a suitable worker who is nearby and available at the time of the request. | Customer describes the problem by **text, voice, or photo**. LLM classifies trade + urgency + likely fix. Ranked results by `availability → distance → skill match → rating`, with the ranking reason shown. Map + list. | "My geyser is leaking" (or a photo of it) returns 3 free plumbers within 3 km, ranked, with reasons. |
| 3 | **Communication.** Customer and worker communicate and agree on job and price, in a way that suits a user who does not type comfortably. | **Voice-note-first chat.** Worker records Urdu audio; it is transcribed and translated to English for the customer in the same bubble. Quick-reply chips for common turns. **PriceAgreement**: the LLM extracts `{amount, unit, includes}` from the spoken quote; both sides tap to confirm. | Worker speaks a price in Urdu; customer sees English text plus a structured price card; both confirm. |
| 4 | **Booking.** A job is confirmed, and the platform stays consistent about which workers are free and which are engaged. | State machine `REQUESTED → ACCEPTED → PRICE_AGREED → IN_PROGRESS → COMPLETED` (+ `DECLINED`, `CANCELLED`). A DB transaction flips the worker to `BUSY` on acceptance and back to `FREE` on completion. A **partial unique index** makes two concurrent active jobs for one worker impossible at the database level. | Accept a job → the worker disappears from "available now" in the customer's list in real time. Try to double-book → rejected by the DB, not by a UI check. |
| 5 | **Trust.** After the job, the platform captures information that helps the next customer decide. | Star rating + tappable tag chips + **voice review** (spoken, transcribed, translated). An LLM synthesises all reviews for a worker into a short trust summary, shown with its source count. Reputation recomputed on completion. | Leave a spoken review → it appears on the worker's profile and changes the trust summary the next customer sees. |

### 2.1 Where the AI is load-bearing

> The brief is explicit: *"AI that is present only for show will receive no credit. Judges will ask what
> would stop working if the AI component were removed."*

Have this table memorised. One AI capability per column, each tied to a barrier named in the brief.

| AI component | Barrier it removes | What breaks without it |
|---|---|---|
| **Urdu speech-to-text** | Literacy | The worker cannot onboard at all. There is no other input path he can use. |
| **LLM profile extraction** | Literacy + form-filling | Raw audio is not a searchable profile. No extraction, no discoverability. |
| **Vision auto-tagging of work photos** | No CV, no written proof | Photos become decoration instead of evidence of specific skills. |
| **Photo/text problem classification** | Customer doesn't know the trade name | She must already diagnose her own fault before she can ask for help. |
| **Live voice-note translation** | Language asymmetry | The two users literally cannot negotiate with each other. |
| **Spoken quote to structured price** | Speed + disputes | No record of what was agreed; booking has nothing to confirm. |
| **Review synthesis** | Trust | The next customer is back to "ask a neighbour". |

**Rule for the demo:** never claim an AI feature that is stubbed. The brief penalises *"presenting mocked
functionality as working"* at the judges' discretion. Label mocks in the UI and say so out loud.

---

## 3. Architecture

### 3.1 Recommended stack

Chosen for speed of delivery over novelty — the brief states *"reliability is valued over feature count."*

```
Front end     Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion
Map           Leaflet + OpenStreetMap tiles  (no API key, no billing, works offline-ish)
Back end      Next.js Route Handlers (same repo, one deploy)
Database      Postgres  (Supabase or Neon free tier)
ORM           Drizzle  (fast migrations, no codegen step)
Realtime      Supabase Realtime on the jobs + messages tables; poll every 4s as fallback
Storage       Supabase Storage for audio blobs and work photos
Auth          Phone number + 4-digit PIN, mocked OTP (console-logged). Disclosed in README.
Hosting       Vercel
AI            see 3.2
```

**Why one Next.js app:** a single deploy, no CORS, no second service to debug at 2 AM. The highest-risk
thing in a one-day hackathon is infrastructure, not code.

**If the team is stronger in another stack, use it.** The brief allows any technology. Do not learn a
framework today.

### 3.2 AI services

| Job | Primary | Fallback (ship both — networks fail at venues) |
|---|---|---|
| Urdu / Roman Urdu STT | OpenAI Whisper (`whisper-1`) or ElevenLabs Scribe | Browser **Web Speech API** with `lang="ur-PK"` — free, zero latency, no key |
| Reasoning, extraction, classification, translation, summarisation | **Claude Sonnet 5.5** (`claude-sonnet-5-5`) for speed, **Claude Opus 5.5** (`claude-opus-5-5`) for the harder extraction prompts | Gemini Flash or a GPT mini model |
| Vision (work-photo tagging, fault diagnosis from a photo) | Claude vision (same model, image input) | Gemini Flash vision |
| Text-to-speech (read the UI aloud) | Browser `SpeechSynthesis` with `ur-PK` | ElevenLabs for pre-recorded prompt audio |

**Pre-record the onboarding question audio as MP3 files.** Browser TTS voice availability for `ur-PK`
varies by machine, and the demo laptop is not yours. Ship static audio for the 4 onboarding questions and
the 3 availability labels; use live TTS for everything else.

**Every AI service used must be listed in the README** (brief, §5). Keep the list current as you add them.

### 3.3 Data model

```
trades            id, slug, name_en, name_ur, color, glyph
workers           id, name, phone, trade_id, years_experience, area, lat, lng,
                  status ('FREE'|'BUSY'|'OFF'), rate_min, rate_max, rating, jobs_completed,
                  bio_ur, bio_en, photo_url, onboarded_via ('voice'|'form'), created_at
worker_skills     id, worker_id, label_en, label_ur, source ('speech'|'photo'|'manual'), confidence
work_photos       id, worker_id, url, ai_tags jsonb, created_at
customers         id, name, phone, lat, lng, address_label, rating
jobs              id, customer_id, worker_id, trade_id, status, description_raw,
                  description_source ('text'|'voice'|'photo'), ai_classification jsonb,
                  photo_url, agreed_price_amount, agreed_price_unit, agreed_price_includes,
                  price_confirmed_by_worker bool, price_confirmed_by_customer bool,
                  requested_at, accepted_at, started_at, completed_at
messages          id, job_id, sender ('worker'|'customer'), kind ('voice'|'text'|'chip'),
                  audio_url, duration_ms, transcript_ur, transcript_en, created_at
reviews           id, job_id, worker_id, customer_id, stars, tags text[],
                  voice_url, transcript_ur, transcript_en, created_at
trust_summaries   worker_id, summary_en, summary_ur, source_review_count, generated_at
```

**The consistency guarantee for Outcome 4** — put this in the migration and show it to the judges:

```sql
-- A worker can have at most one active job. Enforced by the database, not by the UI.
CREATE UNIQUE INDEX one_active_job_per_worker
  ON jobs (worker_id)
  WHERE status IN ('ACCEPTED', 'PRICE_AGREED', 'IN_PROGRESS');
```

Then wrap accept-job in a transaction: insert/update the job **and** set `workers.status = 'BUSY'`
together, or neither. The index turns a race condition into a clean error instead of a corrupt state.
This is the single most impressive thing you can show under "architecture is sound" (30% of the score).

### 3.4 API surface

```
POST /api/ai/transcribe            audio blob            -> { text_ur, text_roman, confidence }
POST /api/ai/extract-profile       transcript            -> { name, trade, years, area, skills[], rate }
POST /api/ai/tag-photo             image                 -> { tags[], trade_guess, confidence }
POST /api/ai/classify-problem      text | audio | image  -> { trade, urgency, likely_fix, keywords[] }
POST /api/ai/translate             text, from, to        -> { text }
POST /api/ai/extract-price         transcript            -> { amount, unit, includes[], confidence }
POST /api/ai/summarise-reviews     worker_id             -> { summary_en, summary_ur, count }

GET  /api/workers?lat&lng&trade&available&radius         -> ranked WorkerCard[] + ranking reasons
GET  /api/workers/:id
POST /api/workers                  create from extracted profile

POST /api/jobs                     create request
POST /api/jobs/:id/accept          transactional: job ACCEPTED + worker BUSY
POST /api/jobs/:id/decline
POST /api/jobs/:id/price           propose / confirm
POST /api/jobs/:id/start
POST /api/jobs/:id/complete        transactional: job COMPLETED + worker FREE + recompute rating
GET  /api/jobs/:id                 poll fallback for realtime

POST /api/messages                 voice note or text; transcribes + translates server-side
POST /api/reviews                  stars + tags + optional voice; triggers summary regeneration
```

**Ranking function** (keep it explicit and explainable — judges will ask):

```
score = 0.40 * available_now
      + 0.25 * distance_decay(km)        // exp(-km / 4)
      + 0.20 * skill_match(keywords)     // overlap with worker_skills + photo tags
      + 0.15 * normalised_rating
```

Return the dominant term as a human sentence per card: *"Closest electrician who has done 12 geyser jobs."*
A visible reason is worth more at the judging table than a better hidden algorithm.

Distance: plain haversine in SQL. No PostGIS. The dataset is a few hundred rows.

---

## 4. Seed data

The brief states there will be **no real users**, that *"seeded workers, jobs and reviews are expected"*,
and that the **README must state what is seeded or simulated**. So seed generously and disclose precisely.

- **60 workers** across 7 trades, with real Islamabad/Rawalpindi coordinates: G-9, G-11, F-10, F-11, I-8,
  I-10, Bahria Town, Saddar, Satellite Town, Chaklala, Raja Bazaar. Spread them so distance filtering is
  visibly meaningful.
- **Realistic names and bios in Urdu**, varied experience (2–30 years), varied rate bands
  (PKR 800–5,000), a plausible status mix (~40% FREE, ~25% BUSY, ~35% OFF).
- **Work photos**: 3–5 per worker. Use Unsplash/Pexels trade photos (credit them in the README as the
  brief requires) and run them through the real tagging endpoint once at seed time, so the tags are
  genuine model output, not hand-written.
- **~150 completed jobs** and **~200 reviews**, with real Urdu review text, so the trust summaries have
  something true to synthesise.
- **Three scripted demo accounts**, so nothing is improvised in front of judges:
  - `Aslam Electrician` — pre-onboarded, FREE, strong history. The worker you accept a job on.
  - `Fresh Worker` — empty. **The account you onboard live by voice.**
  - `Ayesha (customer)` — in G-11, so the seeded workers are plausibly nearby.

Keep it in `db/seed.ts`, idempotent, one command: `npm run seed`.

---

## 5. Build timeline (one day, 3 people)

Adjust to your team size, but keep the **ordering**: the end-to-end skeleton must exist before anything
is polished. A beautiful half-flow scores worse than a plain complete one — the brief says reliability
over feature count, and the outcomes must work *"together as a single flow."*

| Time | Person A — Backend/AI | Person B — Worker app | Person C — Customer app + demo |
|---|---|---|---|
| **9:30–10:30** | Repo, Next.js, DB, schema, migrate | Tokens from `Design.md`, base components | Read brief aloud to team; write the demo script *first* |
| **10:30–12:30** | `/transcribe`, `/extract-profile` working against real audio | Role choice + voice onboarding steps 1–2 | Problem-description screen (text + voice + photo) |
| **12:30–13:30** | `/classify-problem`, `/tag-photo` | Onboarding steps 3–4, profile preview + read-aloud | Results list + ranking reasons |
| **13:30–14:30** | Seed script, worker search + ranking | Worker home, availability switch | Map, filters, worker profile |
| **14:30–16:00** | Jobs state machine + the unique index + transactions | Incoming request screen, BigChoice | Booking confirm, live status |
| **16:00–17:30** | Messages: voice upload, transcribe, translate | Voice chat (worker side) | Voice chat (customer side) |
| **17:30–18:30** | `/extract-price`, `/summarise-reviews` | PriceAgreement (worker) | PriceAgreement (customer), review screen |
| **18:30–19:30** | **FREEZE FEATURES.** Write the README. | Accessibility sweep: Appendix B of `Design.md` | Dark mode, empty/error states |
| **19:30–20:30** | Deploy to Vercel, verify prod, re-seed prod | Squint test on all 9 worker screens | **Rehearse the demo 3 times, on the real device, on venue wifi** |
| **20:30+** | Buffer. Fix only what is broken. | Buffer. | Buffer. Record a backup screen capture of the full flow. |

**Hard rules**
- The **end-to-end flow must be walkable by 16:00**, even if ugly. Polish after, never before.
- Commit every 20–30 minutes. The brief requires *"commit history must begin after the official start
  time"* — frequent commits are also your proof of originality.
- **Feature freeze at 18:30.** Everything after that is README, deploy, accessibility, rehearsal.
- Record a **backup video** of the full flow. If the venue network dies during judging, you still demo.

---

## 6. Deliverables checklist (from the brief, §6)

- [ ] **Source code** — public Git repo. Commit history begins after the official start time.
- [ ] **Working demo** — a deployed URL, *or* a local instance already running when judges arrive.
      Have both. Deployed is less fragile for a crowd; local is immune to venue wifi.
- [ ] **README** — must contain, explicitly:
      - [ ] Setup instructions that a judge could actually follow (clone → env → migrate → seed → run)
      - [ ] Technology stack
      - [ ] **Every AI service and tool used** (each API, each model id)
      - [ ] **AI coding assistants used** — disclosure is required and permitted. State it plainly.
      - [ ] **What is seeded or mocked** — workers, jobs, reviews, OTP, payments, ID verification
      - [ ] Known limitations
      - [ ] Credits for open-source libraries, UI kits, datasets, photo sources
- [ ] **Presentation** — live demo of the full flow across **both** roles, then Q&A. Slides optional.

### 6.1 README skeleton

```markdown
# Roshan Rozgar
Hyper-local marketplace for skilled trade workers. CUI Tech Fest — AI Web Forge.

## What it does           # the five outcomes, one line each
## Live demo              # URL + the three demo logins
## Quick start            # clone, cp .env.example .env, npm i, npm run db:migrate, npm run seed, npm run dev
## Tech stack
## AI services used       # table: purpose | provider | model id | what breaks without it
## AI coding assistants   # disclosed per the rules
## What is seeded or mocked
   - Seeded: 60 workers, 150 jobs, 200 reviews (db/seed.ts)
   - Mocked: OTP (printed to console), payments (out of scope per brief),
     ID verification (out of scope per brief)
   - Real: all AI calls, all geo, all booking state transitions
## Accessibility           # the squint test, contrast targets, RTL, screen-reader support
## Known limitations
## Credits
```

Write the "what breaks without it" column honestly. It is the exact question the judges said they will
ask, and a README that answers it before they ask reads as a team that understood the brief.

---

## 7. Demo script (5 minutes, rehearse it three times)

One narrator, one driver, two phones or two browser windows side by side. Worker on the left, customer on
the right, so the judges see both roles at once.

**0:00 — The problem (30s).**
"72% of Pakistan's non-agricultural work is informal. An electrician with 15 years of experience finds
jobs standing at an adda, because every job portal ever built asks him to fill in a form and upload a CV.
We built the version that doesn't ask him to read."

**0:30 — Worker onboarding, live, in Urdu (90s).**
Hand the phone to a judge. Tap the amber card. The app asks aloud, *"آپ کیا کام کرتے ہیں؟"* Let the judge
or a teammate answer in Urdu. The transcript appears; the profile fills itself in; the trade is
pre-selected; skills appear as chips. Photograph something; the tags appear. The profile is read back
aloud. Publish.
**Say this out loud:** "No keyboard was used. That's not a convenience feature — it's the only way this
user gets onto the platform at all."

**2:00 — Customer discovery (60s).**
Right-hand screen. Photograph a leaking tap (bring a printed photo as backup). The AI names the fault and
the trade. Three plumbers appear, nearest and free, each card showing *why* it ranked there. Request the
one you just created.

**3:00 — Communication and booking (60s).**
Left screen: the request takes over the whole display and is spoken aloud. Accept with one big green tap.
Record a voice note in Urdu quoting a price. Right screen: the customer sees the English translation and a
structured price card. Both confirm. Point at the worker's status flipping to BUSY — **and refresh the
customer's list to show he is gone from "available now."**

**4:00 — Trust (40s).**
Complete the job. Customer leaves a spoken review. Show it appear on the profile and change the AI trust
summary. "This is what the next customer gets instead of asking a neighbour."

**4:40 — Close (20s).**
"Five outcomes, both roles, one flow. The AI isn't a feature here — remove the speech layer and the worker
cannot use the product, remove the translation layer and the two of them cannot talk." Then state what is
seeded and what is mocked, **before** they ask.

### 7.1 Questions the judges will ask — have the answers ready

1. *"What stops working if we remove the AI?"* → the table in §2.1. Answer per component, not in general.
2. *"How do you keep availability consistent?"* → §3.3. Show the partial unique index and the transaction.
3. *"What's seeded?"* → §4, exactly, including the three demo accounts.
4. *"Why Urdu STT rather than just a form in Urdu?"* → a form in Urdu still requires reading and typing.
   Literacy, not language, is the barrier. Urdu-only is a translation; voice-first is an access change.
5. *"Why Naskh for body text and Nastaliq only for display?"* → §3.4 of `Design.md`. Legibility at UI
   sizes beats authenticity for a user who reads slowly.
6. *"What would you do with another week?"* → have one honest, specific answer ready (e.g. offline-first
   job queue with background sync for 3G dead zones; an adda-level worker verification graph where
   existing workers vouch for new ones).
7. *"How accurate is the Urdu transcription?"* → know your real number from testing. Say the number, say
   the fallback (the worker reviews the extracted profile aloud before publishing, so an error is caught
   by the user, not shipped into the data).

---

## 8. Evaluation criteria → where the points come from

| Criterion | Weight | How we earn it | Where |
|---|---|---|---|
| Technical execution | 30% | All five outcomes live, end to end, no dead buttons. Transactional booking with a DB-level constraint. One deploy, few moving parts. Team can defend every decision. | §3, §5 |
| Problem understanding & impact | 20% | The two-skin thesis. Addressing *literacy*, not language. Dignity, not pity. The *adda* framing in the pitch. | `Design.md` §0, §1 |
| Innovation & use of AI | 20% | Seven AI surfaces, each tied to a named barrier, each labelled in the UI, each with a "what breaks" answer. | §2.1 |
| Usability & accessibility | 15% | The squint test. 56px targets. Voice-first. Icon+colour+shape+motion for every state. WCAG AAA on worker text. Read-aloud on every screen. | `Design.md` §2, §7, App. B |
| Presentation | 15% | A rehearsed 5-minute script covering both roles. Honest disclosure of mocks before being asked. Prepared trade-off answers. | §7 |

**Scoring mechanics:** each judge scores every criterion 1–10, weighted as above, averaged across judges.
Mocked or hard-coded parts are acceptable **if disclosed**; presenting mocked work as real draws a penalty
at the judges' discretion. Disclose early, disclose cheerfully.

---

## 9. Scope guardrails (from the brief, §4)

**In scope:** Pakistani urban setting (Islamabad/Rawalpindi default, any city allowed). Urdu or Roman Urdu
input strongly encouraged — English-only is permitted but must be justified, so just support Urdu.

**Out of scope — do not build these:**
- Payment processing
- Identity verification against government databases
- Native mobile applications

Mock them if a flow depends on them, and say so. A "Pay cash on completion" line and a mocked
"ID on file" badge are both fine and both must be labelled.

**Also out of scope by judgement, not by the brief** — resist these; they cost hours and earn nothing:
real OTP/SMS delivery, admin dashboards, multi-city switching, worker earnings analytics, push
notifications, a chatbot that nothing depends on.

---

## 10. Rules that can disqualify you

From §8 of the brief. Read these to the team at 9:30.

- Teams must register before the hacking window opens; **no roster changes after the start**.
- **Work started before the official start time, or code copied from a prior project, leads to
  disqualification.** Generic boilerplate and UI kits are fine; anything specific to this problem must be
  written during the event.
- Mentors, documentation and online resources may be consulted at any time.
- **Late submissions are not judged.**
- Judges' decisions are final.

**Operational consequence:** initialise the project repo *after* the start time, commit continuously, and
keep this planning repo (`Design.md`, `PROJECT.md`, the PDF) clearly separate from the application repo.
Planning documents are not project-specific code, but do not create any ambiguity for a judge reading
`git log` — state in the README which repo holds the implementation and when its first commit landed.

---

## 11. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Venue wifi fails during judging | High | Local instance ready + a recorded backup video of the full flow. |
| Urdu STT accuracy is poor on the demo laptop's mic | High | Web Speech API fallback; pre-recorded onboarding prompts; profile read-aloud confirmation so the user catches errors; test on the actual device. |
| AI API rate limits or a dead key mid-demo | Medium | Two providers configured behind one interface; cache every AI response by input hash; seed data already contains real model output. |
| Realtime (websockets) blocked on venue network | Medium | 4-second polling fallback, on by default if the socket fails to connect. |
| Scope creep past 18:30 | High | Hard feature freeze. Written into the timeline. Anything new goes on a "next week" list for question 6. |
| Both roles not demoable | Fatal | The demo script is written *first*, at 9:30, and rehearsed three times from 19:30. |
| Browser TTS has no `ur-PK` voice on the judging machine | Medium | Static MP3s for all fixed strings. |
| Photo upload too slow on 3G | Medium | Client-side resize to 1280px before upload; optimistic UI. |

---

## 12. First commands

```bash
npx create-next-app@latest roshan-rozgar --ts --tailwind --app --eslint
cd roshan-rozgar
npm i drizzle-orm postgres framer-motion leaflet react-leaflet @anthropic-ai/sdk zod
npm i -D drizzle-kit @types/leaflet
```

Then, in order:
1. `db/schema.ts` — the model in §3.3, including the partial unique index.
2. `app/globals.css` — the token layer from `Design.md` §3.2, light and dark, both skins.
3. `lib/ai.ts` — one module, one function per endpoint in §3.4, each with its fallback provider and a
   response cache keyed by input hash.
4. `db/seed.ts` — §4.
5. Then screens, in the order they appear in the demo script (§7). Build the demo, not the product.

---

## 13. Document index

| File | Purpose |
|---|---|
| `Roshan_Rozgar_Problem_Statement.pdf` | The official brief. Final authority on every requirement. |
| `Design.md` | The master design prompt: thesis, tokens, components, 16 screens, accessibility, copy deck. |
| `PROJECT.md` | This file: outcomes mapping, architecture, data model, AI plan, timeline, demo script, risks. |

**Rule of thumb for the whole event:** when a decision is unclear, re-read §3 (Required Outcomes) of the
PDF. The brief judges *results*, not features. Anything that does not move one of the five outcomes
forward is not worth an hour today.
