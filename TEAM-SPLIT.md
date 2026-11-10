# TEAM-SPLIT.md — finishing Roshan Rozgar in two parallel halves

> Two people, two Claude sessions, **zero shared files**. Person A takes the **worker side**, Person B takes
> the **customer side**. Every file in the repo belongs to exactly one of them, or is frozen. If both follow
> the rules below, `git pull --rebase` can never conflict.
>
> Copy **PROMPT A** into one session and **PROMPT B** into the other. Each prompt is self-contained.

---

## 1. The three rules that make conflicts impossible

1. **One owner per file.** The ownership map below is exhaustive. A file is owned by A, owned by B, or frozen.
   Nobody edits a file they do not own — not even "just a one-line fix".
2. **Frozen means frozen.** The backend, the schema, the shared design system, `package.json` and the
   README are owned by the coordinator (Wajeeh). Found a backend bug or need a dependency? Write it in your
   own log file under `BACKEND REQUESTS`, work around it, and carry on.
3. **Separate log files.** `.ctx/log.md` is an append-only file that *both* people would write to the same
   end of — a guaranteed conflict. A writes `.ctx/log-worker.md`, B writes `.ctx/log-customer.md`. The
   coordinator folds them into `.ctx/log.md` at the end.

## 2. Ownership map

All paths are under `roshan-rozgar/` unless they start with `.ctx/`.

| Path | Owner | Notes |
|---|---|---|
| `app/start/**` | **A** | Role choice |
| `app/worker/**` | **A** | voice, trade, skills, proof, home, request, chat, done |
| `components/worker/**` | **A** | new, A's namespace |
| `components/voice/**` | **A** | new — mic button, waveform |
| `lib/worker/**` | **A** | new, A's namespace |
| `lib/voice/**` | **A** | new — recorder + upload helpers (**B depends on this**, see §3) |
| `lib/client-api.ts` | **A** | only change allowed: the multipart fix in §3 |
| `lib/speech.ts` | **A** | may add a server-TTS function; must keep the existing exports |
| `.ctx/log-worker.md` | **A** | |
| `app/customer/**` | **B** | describe, results, profile, booking, live, review, states |
| `components/customer/**` | **B** | new, B's namespace |
| `lib/customer/**` | **B** | new, B's namespace |
| `components/job-chat.tsx` | **B** | voice-note chat; used by both sides, props must stay compatible |
| `.ctx/log-customer.md` | **B** | |
| `app/page.tsx`, `app/system/**` | frozen | splash + design-system board |
| `app/layout.tsx`, `app/*.css`, `app/icon.svg`, `app/manifest.ts` | frozen | **new styles go in inline `style` props or a new CSS file you own** |
| `components/{ui,stage,lang,sprite,cursor}.tsx` | frozen | use the existing icons; do not add sprite symbols |
| `app/api/**`, `db/**`, `lib/ai/**`, `lib/{env,http,geo,jobs-state,ranking,storage,trust}.ts`, `data/**` | frozen | backend |
| `scripts/**`, `package.json`, `package-lock.json`, `next.config.ts`, `README.md`, `.env*` | frozen | |
| `Design.md`, `PROJECT.md`, `TEAM-SPLIT.md`, `.ctx/log.md` | frozen | |

### Pre-commit guard (run before every commit; each prompt repeats its own)

```bash
# Person A
git diff --cached --name-only | grep -vE '^(roshan-rozgar/(app/start/|app/worker/|components/(worker|voice)/|lib/(worker|voice)/|lib/client-api\.ts$|lib/speech\.ts$)|\.ctx/log-worker\.md$)' && echo "!! STOP: staged files outside your ownership" || echo "ownership OK"

# Person B
git diff --cached --name-only | grep -vE '^(roshan-rozgar/(app/customer/|components/customer/|lib/customer/|components/job-chat\.tsx$)|\.ctx/log-customer\.md$)' && echo "!! STOP: staged files outside your ownership" || echo "ownership OK"
```

`grep -v` prints every staged file that is **not** on your allow-list. If it prints anything, unstage it.

## 3. The one hand-off: the voice foundation (A → B)

Both halves need to record the microphone and upload audio. Duplicating that would create two competing
implementations, so **A writes it first and pushes it within the first ~30 minutes**; B starts on the
non-voice work and picks it up with `git pull --rebase origin main`.

A's first commit contains exactly these, and nothing else:

```ts
// lib/voice/recorder.ts
export type RecorderState = 'idle' | 'recording' | 'processing' | 'error';
export function useRecorder(): {
  supported: boolean;                 // false => show the typing fallback
  state: RecorderState;
  level: number;                      // 0..1 live amplitude, drives the waveform
  error: string | null;
  start(): Promise<void>;
  stop(): Promise<{ blob: Blob; durationMs: number } | null>;
};

// lib/voice/api.ts
export async function uploadMedia(blob: Blob, filename?: string):
  Promise<{ url: string; kind: 'audio' | 'image'; bytes: number }>;
export async function transcribeBlob(blob: Blob, language?: 'ur' | 'en'):
  Promise<{ textUr: string; textRoman: string; confidence: number; provider: string }>;
export async function sendVoiceMessage(args: {
  blob: Blob; jobId: string; sender: 'worker' | 'customer'; durationMs: number; language?: 'ur' | 'en';
}): Promise<unknown /* the stored message row */>;
```

plus the multipart fix in `lib/client-api.ts` (see the bug note in PROMPT A). B codes against the
signatures above immediately and only needs the implementation to land before B's voice items.

## 4. Backend contract (both halves code against this; do not change it)

Every response is `{ ok: true, data, meta? }` or `{ ok: false, error: { code, message, details? } }`.
`lib/client-api.ts` already exports `api()`, `getSession()`, `saveSession()`, `signInDemo()`,
`saveSearch()/loadSearch()`, `saveActiveJob()/loadActiveJob()`.

**Honesty rule.** AI results carry `meta.ai.provider` = `anthropic | openai | gemini | elevenlabs | stub`.
Show an "AI" chip only when it is **not** `stub`; when it is `stub`, show a plain "demo data" chip. The
hackathon brief penalises presenting mocked output as working. Replace every hard-coded "AI · demo" chip in
your screens with this truthful one.

| Endpoint | Request | Response `data` |
|---|---|---|
| `POST /api/ai/transcribe` | multipart `audio` (+`language`) | `{ textUr, textRoman, confidence }` |
| `POST /api/ai/extract-profile` | `{ transcript }` | `{ name, tradeSlug, yearsExperience, area, skills:[{labelEn,labelUr,confidence}], rateMin, rateMax, bioUr, bioEn, confidence, missing:[] }` |
| `POST /api/ai/tag-photo` | multipart `image` | `{ tags:[{label,confidence}], tradeGuess }` |
| `POST /api/ai/classify-problem` | `{ text?, imageBase64?, imageMimeType? }` | `{ tradeSlug, urgency, likelyFix, keywords[], confidence, provider }` |
| `POST /api/ai/translate` | `{ text, from, to }` (`'ur'`/`'en'`) | `{ text }` |
| `POST /api/ai/extract-price` | `{ transcript }` | `{ amount\|null, unit\|null, includes[], ambiguous, confidence }` |
| `GET /api/ai/speak?text=` | — | `audio/mpeg`; **502 if no key → fall back to `speak()` in `lib/speech.ts`** |
| `POST /api/upload` | multipart `file` (audio webm/mp4/wav, image jpeg/png/webp, ≤5 MB) | `{ url, kind, bytes }` |
| `GET /api/trades` | — | 7 trades with `slug, nameEn, nameUr, nameRoman, color, glyph, freeWorkers` |
| `GET /api/workers` | `lat,lng,trade,available,radiusKm,keywords,limit` | rows with `ranking:{score,reason,breakdown}`, `distance:{km,en,ur}`, `trade`, `skills`, `workPhotos`, `trustSummary` |
| `POST /api/workers` | `{ name, phone, pin?, tradeSlug, yearsExperience, area, lat, lng, rateMin, rateMax, bioUr?, bioEn?, skills:[{labelEn,labelUr?,source?,confidence?}], photos?:[{url,aiTags?}], onboardingTranscript?, onboardedVia? }` | the created profile (`id`, `status:'FREE'`); **409** if the phone exists |
| `GET /api/workers/:id` | — | full profile + `reviews` + `trustSummary` + `activeJob` + **`bookedSlots`** (ISO starts of hours already promised) |
| `PATCH /api/workers/:id` | `{ status?: 'FREE'\|'BUSY'\|'OFF', rateMin?, rateMax?, bioUr?, bioEn?, area?, lat?+lng? }` | updated worker; **409** if you try FREE/OFF mid-job |
| `POST /api/workers/:id/photos` | `{ photos:[{url, aiTags?, aiProvider?}] }` | inserted rows |
| `POST /api/jobs` | `{ customerId, workerId, descriptionRaw, descriptionSource:'text'\|'voice'\|'photo', photoUrl?, aiClassification?, scheduledFor? }` — `scheduledFor` = ISO start of a later hour slot (on the hour, in the future, ≤ 3 days ahead); omit for "now" | job (`scheduledFor` echoed); **409 WORKER_BUSY** for "now" when the worker is not free (`details.canScheduleLater: true`); a BUSY worker **can** be booked for a later slot; **409 CONFLICT** if that slot is already booked |
| `GET /api/jobs` | `workerId` or `customerId`, `status=A,B,C`, `active=true` | job summaries (`meta.serverTime`) |
| `GET /api/jobs/:id` | — | `{ id, status, worker, customer, trade, description:{raw,source,photoUrl}, ended, price:{amount,unit,includes,confirmedByWorker,confirmedByCustomer,state}, timestamps:{requestedAt,acceptedAt,startedAt,completedAt}, aiClassification, messageCount }` |
| `POST /api/jobs/:id/accept` | `{}` | `{ job, mode, autoDeclined }`. "Now" request → `ACCEPTED`, worker BUSY (`mode:'accepted'`). Later-slot request → `SCHEDULED`, allowed while busy (`mode:'scheduled'`). `SCHEDULED` → `ACCEPTED` when he takes the slot on (`mode:'activated'`; 409 WORKER_BUSY if he is mid-job) |
| `POST /api/jobs/:id/decline` | `{ reason? }` | job |
| `POST /api/jobs/:id/price` | propose `{ actor, amount, unit, includes? }` · confirm `{ actor, confirm:true }` | `{ job, priceState }` — both confirmed → `PRICE_AGREED` |
| `POST /api/jobs/:id/start` · `/complete` | `{}` | `{ job, … }`. `/complete` ("mark work done") works from `ACCEPTED`, `PRICE_AGREED` or `IN_PROGRESS` — price agreement optional — and frees the worker |
| `POST /api/jobs/:id/cancel` | `{ actor, reason? }` | job |
| `GET /api/messages` | `jobId`, `after?`, `limit?` | `{ messages:[{id,sender,kind,transcriptUr,transcriptEn,audioUrl,durationMs,createdAt}] }` |
| `POST /api/messages` | `{ jobId, sender, kind:'text', text, language }` | message |
| `POST /api/messages/transcribe` | multipart `audio, jobId, sender, durationMs?, language?` | message with **both** transcripts |
| `GET /api/reviews/tags` | — | 9 chips `{ id, labelEn, labelUr, labelRoman, sentiment }` |
| `POST /api/reviews` | `{ jobId, stars:1..5, tags:[ids], voiceUrl?, transcriptUr?, transcriptEn?, language? }` | review (+ regenerated trust summary); **409** if the job is not COMPLETED or already reviewed |
| `POST /api/auth/login` | `{ phone, pin, role }` | mocked sign-in |

Job state machine: `REQUESTED → ACCEPTED → PRICE_AGREED → IN_PROGRESS → COMPLETED`
(+ `DECLINED`, `CANCELLED`). A later-slot request goes `REQUESTED → SCHEDULED → ACCEPTED → …`; `SCHEDULED`
does not occupy the worker, and one hour slot holds at most one accepted booking (DB index
`one_booking_per_slot`). `ACCEPTED` / `PRICE_AGREED` → `COMPLETED` is allowed (price optional). Price becomes `PRICE_AGREED` only when **both** sides have confirmed the
same figure; proposing a new number resets the other side's confirmation.

**Demo identities (mock auth, PIN `0000`).** Worker `Aslam Khan` `+923001234567` (seeded, FREE).
Customer `Ayesha Siddiqui` `+923005551234` (seeded, G-11 Islamabad). Phone **`+923009999999` is reserved and
deliberately not seeded** — it is the account Person A's onboarding creates live by voice.

## 5. Rules for both halves

- **Shared database.** `DATABASE_URL` points at a *shared* Postgres. **Never run `npm run seed`,
  `npm run db:reset` or `npm run db:migrate`** — seed truncates every table and would wipe your teammate's
  work. `npm run verify`, `npm run race`, `npm run smoke` are safe.
- **No backend changes, no schema changes, no new npm packages.** Use what is installed.
- **Keep the design.** Screens use the design system's own classes (`btn`, `card`, `pill`, `chip`, `rail`,
  `dock`, `sheet`, `orb`, `mic`, …) inside `<Stage><Screen …>`. Read `Design.md` §2 and §7. The earlier
  quick wiring replaced several screens with plain generic markup; where you touch a screen, **restore the
  design's markup and keep the new data wiring.**
- **Squint test.** Every control has an icon and a shape, not text alone. Targets ≥ 56 px on the worker skin,
  ≥ 44 px on the customer skin. Strings in all three languages via the existing `D = { ur, rm, en }` pattern.
- **Every state is handled.** Loading, empty, error, and "mic blocked / unsupported" all have a visible,
  recoverable UI. No dead buttons, no `alert()`.
- **Git hygiene.** Never `git add -A` or `git add .` — add files by explicit path. Run your guard. Commit
  small, and push at least every 30–45 minutes: `git pull --rebase origin main`, then `git push origin HEAD:main`.
  **Never force-push.** If a rebase reports a conflict, you or your teammate touched a file you do not own:
  run `git rebase --abort`, do not "resolve" it, and tell the coordinator.
- **Verify before each push:** `npx tsc --noEmit` and `npx next build` must both pass.

## 6. Coordinator's integration checklist (after both halves land)

1. `git pull`, then `npx tsc --noEmit && npx next build`.
2. `npm run verify && npm run race && npm run smoke` against the dev server.
3. Fold `.ctx/log-worker.md` and `.ctx/log-customer.md` into `.ctx/log.md`; resolve every `BACKEND REQUESTS` item.
4. Update the README's "what is seeded or mocked" and "known limitations" for anything that changed.
5. Run the two-browser demo (PROJECT.md §7): onboard a worker by voice → customer describes by photo →
   worker accepts → spoken price → both confirm → complete → spoken review.

---
---

# PROMPT A — Worker half

Copy everything inside the fence into Person A's Claude session.

````
You are finishing the WORKER half of "Roshan Rozgar" (روشن روزگار), a Next.js 16 App Router hackathon
project at roshan-rozgar/ inside the repo https://github.com/Riftwalker23/HACK . It is a marketplace that
connects Pakistani households with skilled trade workers. The defining constraint: the worker may be unable
to read or type, so VOICE and IMAGES are his only input. Judges (CUI Tech Fest) will ask "what stops working
if the AI is removed" — onboarding by voice is the answer, so it must really work end to end.

The backend is complete and verified. The screens exist but several still show canned data. Your job is to
make the worker side real. A teammate (Person B) is doing the customer side AT THE SAME TIME in the same
repo. You must not collide with them.

## READ FIRST (in this order)
1. TEAM-SPLIT.md at the repo root — the ownership map (§2), the hand-off (§3), the API contract (§4) and
   the rules (§5). It is authoritative; this prompt is a summary of your slice of it.
2. Design.md §2 (design laws), §3.3 (trade quadruple), §7 (accessibility). Squint test: cover the words and
   every control must still be operable from icon, shape and position.
3. roshan-rozgar/components/ui.tsx, lang.tsx, stage.tsx, sprite.tsx (icon ids), lib/speech.ts,
   lib/client-api.ts, and the worker screens under app/worker/.

## YOU OWN (edit only these; everything else is read-only)
  roshan-rozgar/app/start/**            roshan-rozgar/app/worker/**
  roshan-rozgar/components/worker/**    roshan-rozgar/components/voice/**
  roshan-rozgar/lib/worker/**           roshan-rozgar/lib/voice/**
  roshan-rozgar/lib/client-api.ts (ONLY the multipart fix below)
  roshan-rozgar/lib/speech.ts (you may ADD a server-TTS function; keep existing exports)
  .ctx/log-worker.md   <- your ONLY log file. Never touch .ctx/log.md.
FROZEN to you: app/customer/**, components/customer/**, lib/customer/**, components/job-chat.tsx (Person
B's), the entire backend (app/api, db, lib/ai, lib/*.ts other than the two above), scripts/, package.json,
README.md, all CSS, ui/stage/lang/sprite components. New styles: inline style props or a NEW css file you
own. No new npm packages. NEVER run `npm run seed`, `db:reset` or `db:migrate` — DATABASE_URL is a SHARED
database and seed truncates it.

## TASK 0 — THE HAND-OFF (do this FIRST, push within ~30 minutes; Person B is waiting on it)
Create, exactly to the signatures in TEAM-SPLIT.md §3:
  lib/voice/recorder.ts : useRecorder() hook over MediaRecorder/getUserMedia. Pick a supported mime type
    (audio/webm;codecs=opus, else audio/mp4, else audio/wav). `level` is a live 0..1 amplitude from a
    Web Audio AnalyserNode. `supported=false` when mediaDevices/MediaRecorder are missing. Release the
    stream's tracks on stop and on unmount. Handle permission denial by setting state='error' with a
    human-readable `error` — never throw into React. Cap a recording at 60 s.
  lib/voice/api.ts : uploadMedia -> POST /api/upload (multipart `file`); transcribeBlob -> POST
    /api/ai/transcribe (multipart `audio`, optional `language`); sendVoiceMessage -> POST
    /api/messages/transcribe (multipart `audio, jobId, sender, durationMs, language`). All three must
    throw an Error carrying the server's `error.message`.
  lib/client-api.ts BUG FIX: `api()` sets `Content-Type: application/json` whenever a body exists. With a
    FormData body that header destroys the multipart boundary. Change the condition so the header is only
    added when `init.body` is NOT a FormData. This is the only edit you may make to that file.
Commit these files only, run the guard, `git pull --rebase origin main`, push. Then message the coordinator
that the foundation is up. Test the recorder in a real browser (the built-in preview or Chrome) before you
push — a recorder that silently fails blocks both halves.

## TASK 1 — Voice onboarding (Outcome 1; the headline demo)  app/worker/{voice,trade,skills,proof}
Keep the existing markup (rail, orb, mic, chips, tiles, dock). Replace canned content with the real flow,
holding a draft in a small store you create at lib/worker/onboarding.ts (useSyncExternalStore +
localStorage, same convention as lib/availability.ts; wrap storage in try/catch).
- voice (1/4): the question is spoken aloud on load (try GET /api/ai/speak?text=… via `new Audio(url)`;
  on any failure fall back to speak() from lib/speech.ts — never silence). Mic orb toggles useRecorder;
  the waveform bars follow `level`. On stop: transcribeBlob -> show the transcript live in the "You said"
  area (aria-live) -> POST /api/ai/extract-profile -> fill the chips (trade, years, area) from the
  response. If `missing` contains fields, speak a follow-up question for them. The keyboard icon reveals a
  text input as the fallback (also used when recorder.supported is false or permission is denied). A
  transcription or extraction failure shows a retry affordance with a spoken message — never a dead end.
  The tick button goes to /worker/trade only when a transcript exists.
- trade (2/4): pre-select the tile for the extracted `tradeSlug` (map: electrician->elec, plumber->plum,
  ac-technician->ac, carpenter->carp, mechanic->mech, painter->paint, mason->mason). The headline asks
  "Are you a <trade>?" using the extracted trade, in the active language. "Something else? Say it" records
  and re-extracts. Tapping a tile speaks its name.
- skills (3/4): the big number is the extracted yearsExperience; the chip list is the extracted `skills`
  (labelEn/labelUr by language) — remove by tapping X; "Tell more" records another clip and APPENDS
  skills. The quoted "from your own words" line is the real transcript, not canned text.
- proof (4/4): the shutter opens a hidden <input type="file" accept="image/*" capture="environment">.
  For each photo: uploadMedia -> POST /api/ai/tag-photo (multipart `image`) -> show the thumbnail with its
  AI tags (use a real <img> from the uploaded URL; replace the SVG placeholders). Tags become additional
  skills. "Hear your profile" reads the full profile aloud (name, trade, years, area, skills). "Publish":
    * area -> coordinates: match the extracted area against AREAS from '@/lib/geo' (pure module, safe on
      the client); else navigator.geolocation; else G-9 (33.6938, 73.0377).
    * phone = '+923009999999', pin '0000' (the reserved demo account; mocked auth, disclosed).
    * POST /api/workers with the full body (include onboardingTranscript and onboardedVia:'voice') and the
      uploaded photos with their aiTags. On 409 (account already exists) sign in with POST /api/auth/login
      instead and continue.
    * saveSession('worker', …) from lib/client-api.ts, clear the draft, router.push('/worker/home').
Truthfulness: show the "AI" chip only when meta.ai.provider !== 'stub'; otherwise a plain "demo data" chip.

## TASK 2 — Worker home (restore the design)  app/worker/home
The quick wiring replaced the design with generic cards (it fails the squint test). Restore the three big
FREE / BUSY / OFF status buttons with their Shape icons (s-free-lg etc.) and keep the real behaviour:
status via PATCH /api/workers/:id (surface the 409 "you are on a job" message in a friendly spoken way);
poll GET /api/jobs?workerId=…&status=REQUESTED,ACCEPTED,PRICE_AGREED,IN_PROGRESS every 5 s. When a
REQUESTED job appears, route to /worker/request?jobId=… (or show a full-width banner that does). Earnings:
sum price.amount of today's COMPLETED jobs (GET /api/jobs?workerId=…&status=COMPLETED) — no hard-coded
"Rs 3,500". Greeting uses the real name. The "free at 5:30 pm" time has no backend field: keep it as
client-only (lib/availability.ts) or drop it, and say so in your log. Active job card links to chat.

## TASK 3 — Incoming request  app/worker/request?jobId=
Load GET /api/jobs/:id. Show the real description, customer name/area, trade glyph, and — if the job has
a photoUrl — the real customer photo instead of the sample SVG. Speak the request aloud on load (speak or
/api/ai/speak). Keep the 60 s countdown ring; at 0 show an expired state (do not auto-decline). Big accept
-> POST /api/jobs/:id/accept -> /worker/chat?jobId=…; big decline -> POST /api/jobs/:id/decline -> /worker/home.
Handle 409 (already taken/cancelled) with a spoken, friendly message.

## TASK 4 — Chat + spoken price (Outcome 3)  app/worker/chat?jobId=
Keep <JobChat jobId actor="worker" /> (Person B owns and is upgrading it to voice notes; pass the same two
props, do not wrap or fork it). Add below it a "Say your price" flow in components/worker/price-proposal.tsx:
record -> transcribeBlob -> POST /api/ai/extract-price -> show the structured card (amount, unit, includes);
if `ambiguous` or amount is null, say "please say one number" and keep the mic ready; otherwise a big tick
POSTs /api/jobs/:id/price {actor:'worker', amount, unit, includes}. Poll GET /api/jobs/:id every 4 s and
show the customer's confirmation state; when status becomes PRICE_AGREED show a big "Start job" (POST
/start); when IN_PROGRESS show "Job done" (POST /complete) then route to /worker/done?jobId=….

## TASK 5 — Job complete  app/worker/done?jobId=
GET /api/jobs/:id for the real price, customer, work description and duration (completedAt − startedAt).
GET /api/workers/:id for the real rating and jobsCompleted; drive the reputation ribbon from them. Replace
every hard-coded value (Rs 2,500, 39 jobs, 45 min, "Ayesha").

## ACCEPTANCE (all must be true)
1. Onboarding with the typing fallback works with the microphone BLOCKED, start to finish.
2. Onboarding by voice creates a worker on +923009999999 who then appears in
   GET /api/workers?lat=33.69&lng=73.04&available=true and whose /worker/home greets him by name.
3. No hard-coded demo values remain on any screen you own; no dead button.
4. Every failure path (mic denied, transcribe fails, extract fails, upload fails, 409) shows a recoverable,
   spoken message. 5. `npx tsc --noEmit` and `npx next build` pass. 6. The guard prints "ownership OK".

## GUARD + GIT (every commit)
git add <explicit paths>   # never -A or .
git diff --cached --name-only | grep -vE '^(roshan-rozgar/(app/start/|app/worker/|components/(worker|voice)/|lib/(worker|voice)/|lib/client-api\.ts$|lib/speech\.ts$)|\.ctx/log-worker\.md$)' && echo "!! STOP" || echo "ownership OK"
git pull --rebase origin main && git push origin HEAD:main     # never force; on conflict: git rebase --abort and tell the coordinator

## WHEN DONE
Append to .ctx/log-worker.md (what you built, decisions, honest gaps, and a BACKEND REQUESTS section for
anything you needed from the frozen backend). Report: files changed, acceptance results, anything you could
not verify (e.g. real-key AI paths). Do not claim a live model worked if the response said provider "stub".
````

---

# PROMPT B — Customer half

Copy everything inside the fence into Person B's Claude session.

````
You are finishing the CUSTOMER half of "Roshan Rozgar" (روشن روزگار), a Next.js 16 App Router hackathon
project at roshan-rozgar/ inside the repo https://github.com/Riftwalker23/HACK . It is a marketplace that
connects Pakistani households with skilled trade workers. The customer wants a worker who is nearby, free
now, competent for THIS job, and safe to let into the home — and a reason to trust that. Judges (CUI Tech
Fest) score "Problem understanding", "Use of AI" and "Usability", so trust must be RENDERED (who said it,
for what job, from how many reviews), never merely claimed.

The backend is complete and verified. The screens exist but several are bypassed or still canned. Your job
is to make the customer side real. A teammate (Person A) is doing the worker side AT THE SAME TIME in the
same repo. You must not collide with them.

## READ FIRST (in this order)
1. TEAM-SPLIT.md at the repo root — ownership map (§2), the hand-off (§3), API contract (§4), rules (§5).
   It is authoritative; this prompt is a summary of your slice of it.
2. Design.md §2 (design laws), §4 (WorkerCard, AvailabilityPill, TrustBlock, PriceAgreement), §6, §7.
3. roshan-rozgar/components/ui.tsx, lang.tsx, stage.tsx, sprite.tsx (icon ids), lib/client-api.ts, and the
   screens under app/customer/ plus components/job-chat.tsx.

## YOU OWN (edit only these; everything else is read-only)
  roshan-rozgar/app/customer/**         roshan-rozgar/components/customer/**
  roshan-rozgar/lib/customer/**         roshan-rozgar/components/job-chat.tsx
  .ctx/log-customer.md   <- your ONLY log file. Never touch .ctx/log.md.
FROZEN to you: app/worker/**, app/start/**, components/worker/**, components/voice/**, lib/worker/**,
lib/voice/**, lib/client-api.ts, lib/speech.ts (Person A's), the entire backend (app/api, db, lib/ai,
lib/*.ts), scripts/, package.json, README.md, all CSS, ui/stage/lang/sprite components. New styles: inline
style props or a NEW css file you own. No new npm packages. NEVER run `npm run seed`, `db:reset` or
`db:migrate` — DATABASE_URL is a SHARED database and seed truncates it.

## ORDER OF WORK (this matters)
Person A is writing the microphone foundation (lib/voice/recorder.ts and lib/voice/api.ts) and will push it
within ~30 minutes. Do Tasks 1–4 (no microphone needed) first. Before Tasks 5–7, run
`git pull --rebase origin main` and confirm lib/voice/* exists. Code against these signatures meanwhile:
  useRecorder(): { supported, state: 'idle'|'recording'|'processing'|'error', level, error,
                   start(), stop(): Promise<{blob, durationMs}|null> }
  uploadMedia(blob, filename?) -> { url, kind, bytes }
  transcribeBlob(blob, language?) -> { textUr, textRoman, confidence, provider }
  sendVoiceMessage({ blob, jobId, sender, durationMs, language? }) -> stored message row
Do NOT write your own recorder.

## TASK 1 — Results  app/customer/results
Currently the "Request" button creates the job immediately and skips profile + booking. Change it: each card
links to /customer/profile?workerId=<id>. Restore the design's WorkerCard markup (avatar, availability pill
with its shape icon, rating + job count, price band, call + request buttons) using real data. Show the
backend's `ranking.reason` sentence on every card — it is the visible "why this worker" (generated from the
real score, not hard-coded). Make the four filters real (available now, ≤ 3 km, 4.5+ stars, price band) —
either as query params to GET /api/workers or client-side over the returned rows. Pins on the map are the
real workers: project lat/lng into the map box (no new map library). Empty / error states use Task 4.

## TASK 2 — Worker profile  app/customer/profile?workerId=
GET /api/workers/:id. Render: work photos with their AI tags (real <img>), the TrustBlock (rating, jobs
completed, last job recency, top review tags, the trust summary WITH its source count — "from N reviews"),
the most recent reviews (stars, tags, translated text), skills, price band, and a real `tel:` call link.
Never show a bare score. Keep the "ID on file · demo" chip but make it clearly labelled as mocked. Sticky bar:
Request -> /customer/booking?workerId=<id>.

## TASK 3 — Booking + live  app/customer/booking, app/customer/live?jobId=
booking (bottom sheet): when to come (now / in 1 hour / tomorrow morning — the backend has no scheduling
field, so append "Preferred time: …" to descriptionRaw and say so in your log), the customer's address from
getSession('customer') (signInDemo('customer') if absent), the worker's price band. Be honest: the price is
AGREED LATER, after the worker accepts — say that on screen instead of showing a fake agreed price. Confirm
-> POST /api/jobs using loadSearch() (description, source, photoUrl, classification) -> saveActiveJob ->
/customer/live?jobId=…. On 409 WORKER_BUSY show a clear "that worker just took another job" with a button
back to results.
live: poll GET /api/jobs/:id every 4 s. Drive the 4-step rail from the real status (Requested / Agreed /
In progress / Done — REQUESTED and ACCEPTED are step 1–2, PRICE_AGREED step 2, IN_PROGRESS step 3,
COMPLETED step 4), each dot with its own icon. Show the worker's proposed price from job.price with the
"Tap to agree" control (POST /price {actor:'customer', confirm:true}); disable it until a price exists, and
show who has confirmed. Cancel button (POST /cancel {actor:'customer'}) while allowed. Keep <JobChat/>.
When COMPLETED, route to /customer/review?jobId=….

## TASK 4 — States  app/customer/states + components/customer/states.tsx
Build reusable EmptyState / ErrorState / NoResults / Offline components (illustration, one plain sentence,
one action) and use them in results, profile, booking and live in place of raw <p> error text. The
/customer/states page remains a gallery of them.

## TASK 5 — Voice chat  components/job-chat.tsx   (needs Person A's foundation)
Used by BOTH sides. Keep the props `{ jobId: string; actor: 'worker'|'customer' }` working unchanged
(optional new props are fine). Add a hold-or-tap-to-record mic button that calls sendVoiceMessage (which
POSTs /api/messages/transcribe and returns a message with both transcripts). Render voice bubbles with the
play button (use audioUrl when present), a waveform, the duration, and a "see it" toggle that reveals the
OTHER language's transcript — so the worker speaks Urdu and the customer reads English off the same row.
Keep the text input as the fallback. Keep the 4 s polling and add `?after=` so you only fetch new rows.
Handle `needsTranscript` and send failures with a visible retry. Use the design's .vn/.wv/.see/.tr classes.

## TASK 6 — Describe by voice or photo (Outcome 2)  app/customer/describe
Text and photo already work (keep them). Add the Speak mode: record -> transcribeBlob -> show the
transcript -> POST /api/ai/classify-problem {text}. Show the classification as EDITABLE chips (trade —
tap to change using GET /api/trades; urgency; likely fix) so the customer stays in control, and show the
real photo preview. Use a truthful provider chip (see Honesty rule). saveSearch with source 'voice' when
spoken. Do not claim bounding boxes the backend does not produce.

## TASK 7 — Review (Outcome 5)  app/customer/review?jobId=
Replace the 4 hard-coded tags with GET /api/reviews/tags (9 chips; render labelEn/labelUr/labelRoman by
language, group by sentiment). Add the spoken review: record -> uploadMedia (voiceUrl) -> transcribeBlob ->
show transcript -> include { voiceUrl, transcriptUr, language:'ur' } in POST /api/reviews. Stars + tag chips
remain usable with no microphone. After success show a confirmation with the updated trust summary from the
response and a link home. Handle 409 (already reviewed) gracefully.

## HONESTY RULE (applies to every AI surface you touch)
AI results carry meta.ai.provider. Show an "AI" chip only when it is not 'stub'; when it is 'stub' show a
plain "demo data" chip. Never leave a hard-coded "AI · demo" chip on a screen that now has real data.

## ACCEPTANCE (all must be true)
1. Customer flow with NO microphone works end to end: describe (text or photo) -> results -> profile ->
   booking -> live -> review, against the real backend, with no hard-coded demo values on any screen you own.
2. Results show a real per-card ranking reason and real filters; profile shows trust WITH its source count.
3. A second booking attempt on a busy worker surfaces the friendly 409 message, not a stack trace.
4. Voice chat, voice describe and voice review work once lib/voice/* is available, with typed fallbacks.
5. `npx tsc --noEmit` and `npx next build` pass. 6. The guard prints "ownership OK".

## GUARD + GIT (every commit)
git add <explicit paths>   # never -A or .
git diff --cached --name-only | grep -vE '^(roshan-rozgar/(app/customer/|components/customer/|lib/customer/|components/job-chat\.tsx$)|\.ctx/log-customer\.md$)' && echo "!! STOP" || echo "ownership OK"
git pull --rebase origin main && git push origin HEAD:main     # never force; on conflict: git rebase --abort and tell the coordinator

## WHEN DONE
Append to .ctx/log-customer.md (what you built, decisions, honest gaps, and a BACKEND REQUESTS section for
anything you needed from the frozen backend). Report: files changed, acceptance results, anything you could
not verify (e.g. real-key AI paths). Do not claim a live model worked if the response said provider "stub".
````
