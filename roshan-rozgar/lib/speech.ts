/**
 * Read-aloud for the speaker buttons, using the browser's own SpeechSynthesis.
 * No API key and no network: it works offline and costs nothing.
 *
 * Urdu voices are not installed on every machine, so we pick the closest match
 * and simply stay quiet if there is none — better than reading Urdu with an
 * English voice.
 */

import type { Lang } from '@/components/lang';

const VOICE_TAG: Record<Lang, string[]> = {
  ur: ['ur-PK', 'ur-IN', 'ur'],
  rm: ['ur-PK', 'hi-IN', 'en-IN', 'en'],
  en: ['en-GB', 'en-US', 'en'],
};

export function speechAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang: Lang) {
  if (!speechAvailable() || !text) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const tags = VOICE_TAG[lang];
  const voices = synth.getVoices();
  const voice =
    voices.find((v) => tags.some((t) => v.lang.toLowerCase() === t.toLowerCase())) ??
    voices.find((v) => tags.some((t) => v.lang.toLowerCase().startsWith(t.split('-')[0]))) ??
    null;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? tags[0];
  if (voice) u.voice = voice;
  // Workers are listening for instructions, not prose — a touch slower reads better.
  u.rate = lang === 'en' ? 1 : 0.92;
  synth.speak(u);
}

export function stopSpeaking() {
  if (speechAvailable()) window.speechSynthesis.cancel();
}

/* ------------------------------------------------------------------------
 * Server read-aloud (ElevenLabs via GET /api/ai/speak), with the browser
 * voice as the fallback. Many machines have no Urdu voice installed, so the
 * browser alone can stay silent exactly where a worker who cannot read needs
 * to hear the question. The server voice fixes that; if it fails for any
 * reason (no key, offline, quota) we fall back to speak() above — never silence.
 * ---------------------------------------------------------------------- */

let currentAudio: HTMLAudioElement | null = null;

/** Stops whichever voice is currently speaking (server or browser). */
export function stopAloud() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  stopSpeaking();
}

/**
 * Speaks `text` with the server voice, falling back to the browser voice.
 * Resolves when playback has started (or the fallback was used); never rejects.
 */
export async function speakAloud(text: string, lang: Lang): Promise<'server' | 'browser' | 'none'> {
  if (typeof window === 'undefined' || !text) return 'none';
  stopAloud();
  try {
    const audio = new Audio(`/api/ai/speak?text=${encodeURIComponent(text.slice(0, 500))}`);
    currentAudio = audio;
    await audio.play(); // rejects on a 502 (no key) or if autoplay is blocked
    return 'server';
  } catch {
    if (currentAudio) currentAudio = null;
    speak(text, lang);
    return speechAvailable() ? 'browser' : 'none';
  }
}
