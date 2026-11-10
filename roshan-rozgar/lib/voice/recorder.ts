'use client';

/**
 * useRecorder — the microphone, for a worker who cannot type.
 *
 * Shared by both halves (TEAM-SPLIT.md §3): worker onboarding, the spoken price,
 * voice-note chat, voice describe and the spoken review all record through this
 * one hook, so there is exactly one place that talks to getUserMedia.
 *
 *   supported   false when the browser has no MediaRecorder / getUserMedia
 *               (show the typing fallback instead of a dead mic)
 *   state       'idle' | 'recording' | 'processing' (finalising the clip) | 'error'
 *   level       live 0..1 loudness from a Web Audio AnalyserNode; drives the waveform
 *   error       a human-readable sentence when state is 'error' (e.g. permission denied)
 *   start()     never throws; a refusal becomes state='error'
 *   stop()      resolves the finished clip, or null if nothing was recorded
 *
 * A recording is capped at 60 s. If the cap is hit, the clip is kept and the
 * next stop() returns it, so the caller's normal flow still works.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type RecorderState = 'idle' | 'recording' | 'processing' | 'error';

export type Recording = { blob: Blob; durationMs: number };

export const MAX_RECORDING_MS = 60_000;

/** Best first. Chrome/Firefox/Edge record webm/opus; Safari records mp4. */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

/** Support never changes during a session; this keeps SSR and hydration in agreement. */
const noopSubscribe = () => () => {};

function describeError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone permission was blocked. Allow the microphone in the browser, or type instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found on this device. Please type instead.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The microphone is busy in another app. Close it and try again, or type instead.';
  }
  return 'The microphone could not start. Try again, or type instead.';
}

export function useRecorder(): {
  supported: boolean;
  state: RecorderState;
  level: number;
  error: string | null;
  /** Milliseconds recorded so far (0 when not recording). */
  elapsedMs: number;
  start(): Promise<void>;
  stop(): Promise<Recording | null>;
} {
  const supported = useSyncExternalStore(noopSubscribe, isSupported, () => false);

  const [state, setState] = useState<RecorderState>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const capTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  /** Resolves the pending stop() once the recorder has flushed its last chunk. */
  const finishRef = useRef<((r: Recording | null) => void) | null>(null);
  /** A clip finished by the 60 s cap, waiting for the caller's stop(). */
  const cappedRef = useRef<Recording | null>(null);
  const mountedRef = useRef(true);

  /** Releases the mic, the audio graph and the timers. Safe to call repeatedly. */
  const release = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (capTimerRef.current !== null) window.clearTimeout(capTimerRef.current);
    capTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (rec && rec.state !== 'inactive') {
        rec.ondataavailable = null;
        rec.onstop = null;
        try {
          rec.stop();
        } catch {
          /* already stopping */
        }
      }
      release();
    };
  }, [release]);

  const start = useCallback(async () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') return;
    if (!isSupported()) {
      setError('This browser cannot record audio. Please type instead.');
      setState('error');
      return;
    }

    setError(null);
    cappedRef.current = null;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(describeError(err));
      setState('error');
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    // Live level meter. Optional: a failure here must not stop the recording.
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let smoothed = 0;
        let lastPaint = 0;
        const tick = (now: number) => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          smoothed = smoothed * 0.6 + Math.min(1, rms * 3.2) * 0.4;
          // ~20 fps is plenty for a waveform and keeps re-renders cheap.
          if (now - lastPaint > 50) {
            lastPaint = now;
            setLevel(smoothed);
            setElapsedMs(Date.now() - startedAtRef.current);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch {
      /* no meter; recording still works */
    }

    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      release();
      setError(describeError(err));
      setState('error');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(MAX_RECORDING_MS, Date.now() - startedAtRef.current);
      const type = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      recorderRef.current = null;
      release();
      const result = blob.size > 0 ? { blob, durationMs } : null;
      if (mountedRef.current) {
        setLevel(0);
        setElapsedMs(0);
        setState('idle');
      }
      const finish = finishRef.current;
      finishRef.current = null;
      if (finish) finish(result);
      else cappedRef.current = result; // stopped by the cap; hand it to the next stop()
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    try {
      recorder.start(250);
    } catch (err) {
      recorderRef.current = null;
      release();
      setError(describeError(err));
      setState('error');
      return;
    }
    setElapsedMs(0);
    setState('recording');

    capTimerRef.current = window.setTimeout(() => {
      const rec = recorderRef.current;
      if (rec && rec.state === 'recording') {
        if (mountedRef.current) setState('processing');
        rec.stop();
      }
    }, MAX_RECORDING_MS);
  }, [release]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      const capped = cappedRef.current;
      cappedRef.current = null;
      return capped;
    }
    setState('processing');
    return new Promise<Recording | null>((resolve) => {
      finishRef.current = resolve;
      try {
        rec.stop();
      } catch {
        finishRef.current = null;
        release();
        if (mountedRef.current) setState('idle');
        resolve(null);
      }
    });
  }, [release]);

  return { supported, state, level, error, elapsedMs, start, stop };
}
