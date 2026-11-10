'use client';

/**
 * Reusable empty / error / offline / loading states for the customer screens.
 *
 * Design.md §2.7 and §5.16: never a blank screen, never a spinner without a
 * sentence, and every state gets an illustration, one plain sentence and ONE
 * action. They reuse the design system's own `.es` / `.ill` / `.tg` classes, the
 * same markup the /customer/states gallery shows.
 */

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useLang, type Lang } from '@/components/lang';
import { Icon } from '@/components/ui';

/* ------------------------------------------------------------- online ---- */

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** True while the browser believes it has a connection. Server render assumes yes. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/* --------------------------------------------------------------- copy ---- */

const T: Record<
  Lang,
  { error: string; errorMsg: string; retry: string; offline: string; offlineMsg: string; saved: string; loading: string; empty: string; none: string }
> = {
  ur: {
    error: 'خرابی',
    errorMsg: 'کچھ گڑبڑ ہوگئی۔ دوبارہ کوشش کریں۔',
    retry: 'دوبارہ کوشش کریں',
    offline: 'انٹرنیٹ نہیں',
    offlineMsg: 'انٹرنیٹ نہیں مل رہا۔ دوبارہ جڑنے پر کوشش کریں۔',
    saved: 'آپ کے فون میں محفوظ',
    loading: 'لوڈ ہو رہا ہے…',
    empty: 'خالی',
    none: 'کوئی نتیجہ نہیں',
  },
  rm: {
    error: 'Kharabi',
    errorMsg: 'Kuch gadbad ho gayi. Dobara koshish karein.',
    retry: 'Dobara koshish karein',
    offline: 'Internet nahi',
    offlineMsg: 'Internet nahi mil raha. Dobara judne par koshish karein.',
    saved: 'Aap ke phone mein mehfooz',
    loading: 'Load ho raha hai…',
    empty: 'Khaali',
    none: 'Koi nateeja nahi',
  },
  en: {
    error: 'Something went wrong',
    errorMsg: 'Something went wrong. Please try again.',
    retry: 'Try again',
    offline: 'Offline',
    offlineMsg: 'No internet. Try again when you are back online.',
    saved: 'Saved on your phone',
    loading: 'Loading…',
    empty: 'Empty',
    none: 'No results',
  },
};

/* --------------------------------------------------------------- base ---- */

type Action = { label: string; href?: string; onClick?: () => void; kind?: 'btn-t' | 'btn-o' | 'btn-p' };

function StateCard({
  tag,
  icon,
  tone,
  message,
  detail,
  action,
  alert,
}: {
  tag: string;
  icon: string;
  /** background tint + icon colour pair, taken from the design's own tokens */
  tone: { bg: string; fg: string };
  message: string;
  detail?: string;
  action?: Action;
  alert?: boolean;
}) {
  const cls = `btn ${action?.kind ?? 'btn-t'}`;
  return (
    <section className="es rr-rise" role={alert ? 'alert' : 'status'}>
      <span className="tg">{tag}</span>
      <span className="ill" style={{ background: tone.bg }}>
        <Icon name={icon} cls="xl" style={{ color: tone.fg }} />
      </span>
      <p className="b bold">{message}</p>
      {detail && <p className="l soft">{detail}</p>}
      {action &&
        (action.href ? (
          <Link className={cls} href={action.href} style={{ minHeight: '44px' }}>
            {action.label}
          </Link>
        ) : (
          <button type="button" className={cls} style={{ minHeight: '44px' }} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </section>
  );
}

const TEAL = { bg: 'var(--ttint)', fg: 'var(--teal)' };
const BUSY = { bg: 'color-mix(in srgb, var(--busy) 14%, var(--surface))', fg: 'var(--busy)' };
const AMBER = { bg: 'var(--tint)', fg: 'var(--roshan-text)' };

/* ------------------------------------------------------------ exports ---- */

/** Something failed. `message` should be the server's friendly message when there is one. */
export function ErrorState({ message, onRetry, href, actionLabel }: { message?: string; onRetry?: () => void; href?: string; actionLabel?: string }) {
  const { lang } = useLang('en');
  const t = T[lang];
  return (
    <StateCard
      alert
      tag={t.error}
      icon="i-x"
      tone={BUSY}
      message={message || t.errorMsg}
      action={onRetry || href ? { label: actionLabel ?? t.retry, onClick: onRetry, href, kind: 'btn-o' } : undefined}
    />
  );
}

/** The device is offline. Retrying is the only action that makes sense. */
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  const { lang } = useLang('en');
  const t = T[lang];
  return (
    <StateCard
      alert
      tag={t.offline}
      icon="i-wifi"
      tone={BUSY}
      message={t.offlineMsg}
      detail={t.saved}
      action={onRetry ? { label: t.retry, onClick: onRetry, kind: 'btn-o' } : undefined}
    />
  );
}

/** A search returned nothing. Offer to widen it. */
export function NoResults({ message, actionLabel, onAction, href }: { message: string; actionLabel?: string; onAction?: () => void; href?: string }) {
  const { lang } = useLang('en');
  const t = T[lang];
  return (
    <StateCard
      tag={t.none}
      icon="i-nores"
      tone={TEAL}
      message={message}
      action={actionLabel && (onAction || href) ? { label: actionLabel, onClick: onAction, href } : undefined}
    />
  );
}

/** A list that is legitimately empty. */
export function EmptyState({ message, actionLabel, onAction, href }: { message: string; actionLabel?: string; onAction?: () => void; href?: string }) {
  const { lang } = useLang('en');
  const t = T[lang];
  return (
    <StateCard
      tag={t.empty}
      icon="i-inbox"
      tone={AMBER}
      message={message}
      action={actionLabel && (onAction || href) ? { label: actionLabel, onClick: onAction, href, kind: 'btn-p' } : undefined}
    />
  );
}

/** Never a spinner without a sentence (Design.md §2.7). */
export function LoadingState({ message }: { message?: string }) {
  const { lang } = useLang('en');
  const t = T[lang];
  return (
    <p className="b bold soft rr-rise" role="status" aria-live="polite" style={{ textAlign: 'center', padding: '24px 0' }}>
      {message ?? t.loading}
    </p>
  );
}
