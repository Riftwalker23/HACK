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
