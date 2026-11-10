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
