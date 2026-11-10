# Roshan Rozgar — pitch deck: slide guide & speaker script

Deck: `Roshan_Rozgar_Pitch.pptx` (editable) · `Roshan_Rozgar_Pitch.pdf` (backup). All product images in `screenshots/` are real captures of the app in this repo, run locally with seeded data and no AI keys (so AI results show the app's own "demo data" label).

**Team:** Compiler Society. Target time: about 5 minutes for slides, then the live demo.

## Slide 1
**What it shows:** Title — name, Urdu wordmark, tagline, hackathon, team; real role-choice and results screens.

**Say:**

> Assalam-o-Alaikum. We are Compiler Society, and this is Roshan Rozgar.
>
> In one sentence: it is the job platform that doesn't ask a worker to read.
>
> On the left of the phones you see the worker's world — Urdu-first and spoken. On the right, the customer's world — fast results for a household that needs help now. Both run on the same system, and in the next few minutes we'll show you every step working.

## Slide 2
**What it shows:** Problem — the 72.1% informal-work statistic (PBS), the worker's and household's pain, and the key insight: literacy, not language.

**Say:**

> 72 percent of Pakistan's non-agricultural work is informal. A plumber with 15 years of experience still finds work by standing at an adda, because every job portal ever built asks him to fill in a form and upload a CV.
>
> On the other side, a household with a leaking geyser has four questions: who is nearby, who is free right now, who can actually do this job, and who is safe to let in.
>
> Our key insight: the barrier is literacy, not language. Translating a form into Urdu doesn't help someone who doesn't read comfortably.

## Slide 3
**What it shows:** Solution — 'two skins over one system' and the six-step journey from speaking a profile to leaving a review.

**Say:**

> Our design idea is "two skins over one system".
>
> The worker skin is Urdu-first and voice-first: he speaks, the app listens, and it reads everything back to him.
>
> The customer skin is faster and denser: describe the problem in your own words, by voice or with a photo, and get ranked workers nearby.
>
> Underneath is a single backend: one database, one booking engine, one AI layer — which is why the two sides always agree on who is free.
>
> The strip at the bottom is the full journey: speak, describe, match, agree, book, review.

## Slide 4
**What it shows:** Overview — the five required outcomes mapped to roles, beside the real role-choice screen.

**Say:**

> Here is the platform in one view. The brief asked for five outcomes working together as one flow, for both roles — and that's how we built it.
>
> Onboarding is the worker side. Discovery is the customer side. Communication and booking involve both. Trust closes the loop for the next customer.
>
> Everything opens from this one screen: an amber card for "I do work", a teal card for "I need work done". You pick by colour and icon, and the speaker button reads it out.

## Slide 5
**What it shows:** Main features — eight implemented features, each with an icon and one-line description.

**Say:**

> These are the eight things we built. Each one exists because of a specific barrier in the brief.
>
> Voice onboarding removes the literacy barrier. AI classification means the customer doesn't need to know the name of the trade. The ranking is explainable — every card says why it ranked there. The whole app is trilingual and can read itself aloud.
>
> On the transaction side: a price offer and two-sided agreement, and booking that the database itself protects from double-booking. Then reviews feed an AI trust summary.
>
> And one feature judges should notice: honest AI labels. If a real model answered, you see an "AI" chip. If the offline fallback answered, it says "demo data".

## Slide 6
**What it shows:** Feature 1 — voice onboarding: three real screens (speak, confirm trade, skills) with numbered steps.

**Say:**

> Feature one: onboarding by voice. These are real screens from our app.
>
> Screen one: the app asks, in Urdu, "What work do you do?" He answers aloud. The transcript appears and the AI pulls out name, trade, years, area and skills. Anything missing gets a spoken follow-up question.
>
> Screen two: the trade is already selected — "Are you a plumber?" — he taps yes, or picks another icon.
>
> Screen three: his years and skills, quoted from his own words. Step four adds work photos, reads the whole profile back to him, and publishes.
>
> Honesty note: speech goes to ElevenLabs Scribe, with Whisper as fallback. For these screenshots we used the typed fallback, because the capture browser has no microphone.

## Slide 7
**What it shows:** Feature 2 — discovery: describe screen, ranked results, the 'reason' callout and the 40/25/20/15 ranking weights.

**Say:**

> Feature two: discovery. The customer types, speaks, or photographs the problem. Here she typed "Kitchen tap is leaking under the sink".
>
> The AI classifies it as plumbing, with a likely fix — replace the washer or cartridge — and searches for plumbers who are free right now.
>
> Our ranking is a simple, explainable formula: 40 percent availability, 25 percent distance, 20 percent skill match, 15 percent rating. And every card shows its reason in plain words — "free right now, water tap experience, 5 stars from 3 jobs".
>
> A visible reason builds more trust than a clever hidden algorithm.

## Slide 8
**What it shows:** Feature 3 — profile → booking with price offer → two-sided price agreement (real booking run).

**Say:**

> Feature three: from profile to price. These are screens from a real booking we made against our backend.
>
> One: she checks the worker — rating, tags like "came quickly" and "good materials", and an AI trust summary that says how many reviews it is based on.
>
> Two: she picks a time, confirms the address and can offer a price — here two thousand rupees.
>
> Three: the worker accepted and proposed 2,200 including the washer and tape. She taps "This price is right" and the job moves to PRICE_AGREED.
>
> Each chat message is stored in both Urdu and English. To be clear: today the chat is text-only, and the worker proposes his price from his home screen; a spoken price quote is on our next-steps list.

## Slide 9
**What it shows:** Feature 4 — job state machine, the partial unique index SQL, test results (11/11 verify, 22/22 race), worker 'Busy' screen.

**Say:**

> Feature four is the one we are most proud of technically. Availability must be honest — if a worker accepts a job, he must disappear from "available now".
>
> Every job moves through this state machine. Accepting is a single database transaction: the job becomes ACCEPTED, the worker becomes BUSY, and his other pending requests are declined.
>
> And we don't trust the UI to prevent double-booking. This partial unique index means Postgres itself refuses a second active job for the same worker. A race condition becomes a clean error, not corrupt data.
>
> We test it: 11 out of 11 invariant checks and 22 out of 22 race-test checks pass.
>
> On the right, the worker's home screen after the price was agreed: status Busy.

## Slide 10
**What it shows:** Feature 5 — review with stars/tags, and the trust summary updating from 2 to 3 reviews.

**Say:**

> Feature five: trust. After the job is complete, the customer rates in seconds — stars, tap chips, and an optional review, which can be spoken.
>
> Submitting regenerates the worker's trust summary. You can see it here: it now says "3 reviews" — before this review it said 2. We always show the source count, so the customer knows how much evidence is behind the summary.
>
> In this run, no AI key was configured, so the summary is computed by our offline fallback from the real review rows — and the app labels it "demo data" instead of pretending. With a key, the same endpoint uses Claude or Gemini to write it.

## Slide 11
**What it shows:** How it works — five-stage swimlane (worker / customer) joined by one shared job record.

**Say:**

> Here is the full workflow in five stages, worker on top, customer below.
>
> Join: the worker speaks his profile; the customer sets a location.
>
> Ask: the customer describes the problem, and AI turns it into a trade.
>
> Match: free workers nearby are ranked; the worker sees the request and accepts with one tap, which marks him busy.
>
> Agree and book: price offered, proposed and confirmed; the job starts.
>
> Finish and trust: completing frees the worker; the customer's review updates his trust summary.
>
> In the middle, the key point: both sides read one shared job record, so they never disagree about what's happening.

## Slide 12
**What it shows:** Tech stack — frontend, backend, data, AI services, hosting, and AI-assistant disclosure.

**Say:**

> Our stack was chosen for reliability, because the brief says reliability is valued over feature count.
>
> One Next.js 16 app holds both front ends and all 29 API routes — one deploy, no CORS, fewer things to break.
>
> Data is Postgres on Supabase. If there's no cloud database, it falls back to PGlite — real Postgres compiled to WebAssembly — so the same constraints apply even offline.
>
> For AI: Claude and Gemini handle extraction, classification, photo tagging, translation, price parsing and review summaries. ElevenLabs and Whisper handle Urdu speech-to-text, and ElevenLabs reads screens aloud.
>
> We disclose that we used Claude Code as our coding assistant.

## Slide 13
**What it shows:** Architecture — clients → Next.js API routes → Postgres, storage, AI and speech APIs, with the provider fallback chain.

**Say:**

> This is the actual architecture in the repository.
>
> Two front ends — the worker skin and the customer skin — run in the phone's browser and talk to one Next.js app through JSON API routes. Live status is kept in sync by polling every four to five seconds.
>
> Inside the app: AI routes, ranked worker search, the job state machine, messages and reviews, and uploads.
>
> The AI layer is a provider chain: Claude first, then Gemini, then OpenAI, and finally a deterministic offline stub — so a dead API key or bad venue wifi never breaks the demo. Real answers are cached, and every response says which provider answered.
>
> On the right: Postgres with our unique index, Supabase Storage for audio and photos, and the external AI and speech APIs.

## Slide 14
**What it shows:** Innovation — comparison with typical job portals, and 'remove the AI and…' per component.

**Say:**

> What makes us different? Compare us with a typical job portal or classifieds site.
>
> Joining: a form and a CV, versus a spoken interview. Finding help: picking the right category yourself, versus describing the problem in your own words. Ranking: opaque, versus a reason on every card. Availability: stale listings, versus free and busy enforced by the database. Trust: a star count, versus a summary that tells you how many reviews it's built on.
>
> The judges asked: what stops working if the AI is removed? Our answer, per component, is on the right. Without speech-to-text, the worker cannot onboard at all. Without classification, the customer must diagnose her own fault. Without translation, the two users cannot negotiate. The AI isn't decoration — it's the access layer.

## Slide 15
**What it shows:** Status & future — honestly split into working today / being finished / future scope, plus impact.

**Say:**

> We want to be precise about what is real.
>
> Working today: voice onboarding, problem description, ranked search, booking with price agreement and live status, reviews and trust summaries, and bilingual text chat.
>
> Being finished: two worker screens — the incoming-request and job-done screens — are still design mock-ups; workers accept and complete from their home screen today. The spoken price quote and voice notes in chat are not wired yet, and login is a mocked phone and PIN. Seeded workers, jobs and reviews are demo data, as the brief allows.
>
> Next: an offline-first job queue for weak networks, an adda-level vouching graph so existing workers can vouch for new ones, real OTP and ID verification, payments, and more cities.
>
> The impact: we bring skilled workers online without asking them to change who they are.

## Slide 16
**What it shows:** Closing — 'Five outcomes. Both roles. One flow.', tagline, summary, team, hand-off to live demo.

**Say:**

> To close: five outcomes, both roles, one flow.
>
> A worker speaks once and becomes discoverable. A household describes a problem and gets someone nearby, free, and trusted. And the database keeps both sides honest.
>
> Remove the speech layer and the worker can't use the product. Remove the booking constraint and availability becomes a guess. That's why every piece is there.
>
> Thank you — shukriya. We'd now like to show you the live demo, and we're happy to take your questions.
