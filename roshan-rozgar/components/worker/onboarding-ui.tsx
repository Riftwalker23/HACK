'use client';

/**
 * Small shared pieces for the four voice-onboarding screens
 * (app/worker/{voice,trade,skills,proof}). Design-system classes only; any new
 * look is an inline style.
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Lang } from '@/components/lang';
import { Icon } from '@/components/ui';
import { speakAloud } from '@/lib/speech';

/* ------------------------------------------------------------ read aloud ---- */

/**
 * Same look as SpeakBtn, but speaks with the server voice (falls back to the
 * browser voice). `data-speaks` tells useSpeakOnLoad not to talk over it.
 */
export function SayBtn({
  label,
  say,
  lang,
  cls = 'iconbtn',
  icon = 'i-spk',
  iconCls = '',
  style,
}: {
  label: string;
  say?: string;
  lang: Lang;
  cls?: string;
  icon?: string;
  iconCls?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      title={label}
      data-speaks=""
      style={style}
      onClick={() => void speakAloud(say || label, lang)}
    >
      <Icon name={icon} cls={iconCls} />
    </button>
  );
}

type UserActivationNavigator = Navigator & { userActivation?: { hasBeenActive: boolean } };

/**
 * Speaks `text` when the screen opens (and again when the language changes).
 * Browsers block audio until the first tap on a freshly loaded page, so if it
 * could not play, it is spoken on the first tap instead — unless that tap is
 * the microphone, a speaker button or a text field (we must not talk over the
 * worker or into the recording).
 */
export function useSpeakOnLoad(text: string, lang: Lang, enabled = true) {
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  });

  useEffect(() => {
    if (!enabled) return;
    let done = false;
    const activated = !!(navigator as UserActivationNavigator).userActivation?.hasBeenActive;
    if (textRef.current) {
      void speakAloud(textRef.current, lang).then((r) => {
        if (r === 'server' || activated) done = true;
      });
    }
    const onFirst = (e: PointerEvent) => {
      window.removeEventListener('pointerdown', onFirst, true);
      if (done) return;
      done = true;
      const el = e.target as Element | null;
      if (el?.closest?.('.mic, .shutter, [data-speaks], [data-no-prompt], input, textarea, a, .seg3')) return;
      if (textRef.current) void speakAloud(textRef.current, lang);
    };
    window.addEventListener('pointerdown', onFirst, true);
    // No stopAloud() here: a confirmation spoken as the screen changes
    // ("Published!") should finish; the next speakAloud() stops it anyway.
    return () => window.removeEventListener('pointerdown', onFirst, true);
  }, [lang, enabled]);
}

/* ----------------------------------------------------------------- notes ---- */

const N = {
  ur: {
    retry: 'دوبارہ کوشش کریں',
    emptyH: 'ابھی کچھ نہیں بتایا',
    emptyP: 'پہلے مرحلے پر جا کر بول کر بتائیں کہ آپ کیا کام کرتے ہیں۔',
    start: 'پہلے مرحلے پر جائیں',
    loading: 'کھل رہا ہے…',
  },
  rm: {
    retry: 'Dobara koshish karein',
    emptyH: 'Abhi kuch nahi bataya',
    emptyP: 'Pehle marhale par ja kar bol kar batayein ke aap kya kaam karte hain.',
    start: 'Pehle marhale par jayein',
    loading: 'Khul raha hai…',
  },
  en: {
    retry: 'Try again',
    emptyH: 'Nothing recorded yet',
    emptyP: 'Go to step 1 and say what work you do.',
    start: 'Go to step 1',
    loading: 'Opening…',
  },
};

/** A visible, recoverable error: icon, message, optional detail and a retry button. */
export function ErrorNote({
  lang,
  message,
  detail,
  onRetry,
  retryLabel,
}: {
  lang: Lang;
  message: string;
  detail?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const t = N[lang];
  return (
    <div
      role="alert"
      className="card row g12 rr-pop"
      style={{ padding: '12px 14px', borderColor: 'var(--decline)', borderRadius: '18px' }}
    >
      <span className="gl s40" style={{ ['--c' as string]: 'var(--decline)', ['--g' as string]: '#fff' }}>
        <Icon name="i-flag" cls="s24" />
      </span>
      <div className="col fx" style={{ minWidth: 0 }}>
        <span className="l bold">{message}</span>
        {detail && (
          <span className="l soft" style={{ fontSize: '12px', overflowWrap: 'anywhere' }}>
            {detail}
          </span>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          className="iconbtn"
          aria-label={retryLabel ?? t.retry}
          title={retryLabel ?? t.retry}
          data-no-prompt=""
          onClick={onRetry}
          style={{ borderColor: 'var(--decline)' }}
        >
          <Icon name="i-replay" />
        </button>
      )}
    </div>
  );
}

/** Honest empty state for a screen opened without a draft: back to step 1. */
export function EmptyDraft({ lang }: { lang: Lang }) {
  const t = N[lang];
  return (
    <section className="card col g12 ctr rr-pop" style={{ padding: '24px 20px' }}>
      <span className="gl s72" style={{ ['--c' as string]: 'var(--roshan)', ['--g' as string]: '#0B1020' }}>
        <Icon name="i-mic" cls="lg" />
      </span>
      <h1 className="t nq">{t.emptyH}</h1>
      <p className="b">{t.emptyP}</p>
      <Link className="btn btn-p" href="/worker/voice" style={{ width: '100%' }}>
        <Icon name="i-mic" />
        {t.start}
      </Link>
    </section>
  );
}

/** Placeholder while the draft is read from storage (one frame after hydration). */
export function LoadingNote({ lang }: { lang: Lang }) {
  return (
    <p className="l soft row g8" role="status" style={{ justifyContent: 'center', padding: '24px 0' }}>
      <Icon name="i-clock" cls="s24" />
      {N[lang].loading}
    </p>
  );
}

/** Text fallback (keyboard): a big field plus a send button. */
export function TypeBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  sendLabel,
  busy,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  sendLabel: string;
  busy?: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <form
      className="row g8 rr-pop"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        rows={2}
        className="b fx"
        style={{
          minHeight: '64px',
          padding: '10px 14px',
          borderRadius: '18px',
          border: '3px solid var(--line)',
          background: 'var(--surface)',
          color: 'var(--text)',
          font: 'inherit',
          resize: 'none',
        }}
      />
      <button
        type="submit"
        className="iconbtn"
        aria-label={sendLabel}
        title={sendLabel}
        disabled={busy || !value.trim()}
        style={{
          background: 'var(--roshan)',
          borderColor: 'var(--roshan-deep)',
          color: '#0B1020',
          opacity: busy || !value.trim() ? 0.5 : 1,
        }}
      >
        <Icon name="i-send" />
      </button>
    </form>
  );
}
