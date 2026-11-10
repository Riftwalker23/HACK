'use client';

/**
 * useVoiceInput — "tap to talk, tap to finish, get the words back".
 *
 * Composes useRecorder() with transcribeBlob() so every screen that asks the
 * worker to speak behaves the same way:
 *
 *   phase       'idle' | 'recording' | 'transcribing' | 'error'
 *   toggle()    idle -> recording; recording -> transcribing -> idle (or error)
 *   error       a readable sentence for a mic refusal OR a transcription failure
 *   lastAudio   the most recent clip (e.g. to upload it as a voice review)
 *
 * The transcript is delivered through `onTranscript`, called from the event
 * that finished the recording — never from an effect.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecorder, type Recording } from './recorder';
import { transcribeBlob } from './api';

export type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'error';

export type Transcript = { textUr: string; textRoman: string; confidence: number; provider: string };

export function useVoiceInput(options: {
  language?: 'ur' | 'en';
  onTranscript: (t: Transcript, clip: Recording) => void | Promise<void>;
}) {
  const rec = useRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastAudio, setLastAudio] = useState<Recording | null>(null);
  // Latest options without re-creating the callbacks (refs are written in an
  // effect, not during render).
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const finish = useCallback(async () => {
    const clip = await rec.stop();
    if (!clip) {
      setVoiceError('Nothing was recorded. Tap the microphone and speak.');
      return;
    }
    setLastAudio(clip);
    setTranscribing(true);
    try {
      const t = await transcribeBlob(clip.blob, optsRef.current.language ?? 'ur');
      if (!t.textUr.trim() && !t.textRoman.trim()) {
        setVoiceError('We could not hear any words. Please try again, a little closer to the phone.');
        return;
      }
      await optsRef.current.onTranscript(t, clip);
    } catch (err) {
      setVoiceError((err as Error).message || 'Could not understand the recording. Please try again.');
    } finally {
      setTranscribing(false);
    }
  }, [rec]);

  const toggle = useCallback(async () => {
    if (transcribing) return;
    if (rec.state === 'recording') {
      await finish();
      return;
    }
    setVoiceError(null);
    await rec.start();
  }, [rec, transcribing, finish]);

  const phase: VoicePhase = transcribing
    ? 'transcribing'
    : rec.state === 'recording' || rec.state === 'processing'
      ? 'recording'
      : rec.state === 'error' || voiceError
        ? 'error'
        : 'idle';

  return {
    supported: rec.supported,
    phase,
    level: rec.level,
    elapsedMs: rec.elapsedMs,
    error: voiceError ?? rec.error,
    /** True when the microphone itself failed (blocked, missing, busy) rather than the transcription. */
    micBlocked: !voiceError && rec.state === 'error',
    lastAudio,
    toggle,
    clearError: () => setVoiceError(null),
  };
}
