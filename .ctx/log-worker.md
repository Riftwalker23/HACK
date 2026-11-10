# Worker half (Person A) — log

## 2026-11-10 — Task 0 + shared worker helpers

Pushed:
- Task 0 (hand-off for Person B): `lib/voice/recorder.ts` (useRecorder),
  `lib/voice/api.ts` (uploadMedia, transcribeBlob, sendVoiceMessage) and the
  `lib/client-api.ts` FormData fix. Verified in a real browser against the live
  backend: ElevenLabs transcription (0.98), Supabase upload, server error
  messages, and the blocked-microphone path. NOT verified: actual audio capture
  (the built-in browser pane blocks the microphone).
- Shared helpers for the worker screens:
  - `lib/speech.ts`: new `speakAloud(text, lang)` (ElevenLabs via
    /api/ai/speak, falls back to browser `speak()`, never silent) and
    `stopAloud()`. Existing exports unchanged.
  - `lib/voice/use-voice-input.ts`: tap-to-talk hook = useRecorder +
    transcribeBlob, phases idle/recording/transcribing/error.
  - `components/voice/wave.tsx`: `.wave` bars driven by the live mic level.
  - `components/worker/ai-chip.tsx`: truthful AI / "demo data" chip.
  - `lib/worker/trades.ts`: slug -> tile/glyph class and 3-language names.

Not started yet: Tasks 1-5 (onboarding, home, request, chat + spoken price, done).

## BACKEND REQUESTS
- RESOLVED by the coordinator (commit "Fix AI providers failing to load under
  next dev --webpack"): `next dev --webpack` could not resolve the variable
  `import(mod)` in lib/ai/index.ts, so every AI endpoint returned 500 in dev.

## 2026-11-10 — coordinator's 6-item list (onboarding, voice describe, lint, README)

Done with two parallel agents plus integration and browser testing:
- Worker voice onboarding, all four steps real (voice, trade, skills, proof):
  draft store `lib/worker/onboarding.ts`, shared bits `components/worker/onboarding-ui.tsx`.
  Publish = POST /api/workers (phone +923009999999, pin 0000), then
  POST /api/workers/{id}/photos; on 409 signs in via /api/auth/login and attaches.
- Customer voice describe (`app/customer/describe`) and all 10 lint errors fixed
  (customer pages, `components/job-chat.tsx`, `app/worker/chat`), using
  `lib/customer/client-store.ts` (useSyncExternalStore helpers). No eslint-disable added.
- README: real worker + customer flows and honest limitations.

Verified in the browser against the live backend, with the mic BLOCKED (typing
fallback): onboarding start to finish -> worker "Bilal Ahmed" created, appears in
GET /api/workers?available=true with 1 photo, /worker/home greets him by name.
Customer describe: text path -> plumber (gemini) -> results; blocked mic handled.

Fixed during testing: stale "mic blocked" error after a typed answer and its
wording (`micBlocked` added to useVoiceInput); honest "no work recognised" note
when tag-photo returns no tags; /worker/home said "Aslam Khan" for any worker.
Dev-server note: a "Jest worker encountered 2 child process exceptions" crash made
/api/workers/{id}/photos return HTML 500; restarting `next dev` fixed it (not a code bug).

NOT verified: real microphone recording (the test browser blocks the mic).
Still open (TEAM-SPLIT Tasks 2-5): /worker/request and /worker/done are mock-ups,
no spoken-price step, /worker/home uses a generic layout, chat is text-only.
The demo account +923009999999 now EXISTS in the shared DB (created by this test).
