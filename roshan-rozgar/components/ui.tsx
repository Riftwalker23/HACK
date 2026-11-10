'use client';

/**
 * The pieces that repeat on every board, ported 1:1 from the canvas markup:
 * the screen shell, the icon/glyph <use> wrappers, the language switch and the
 * read-aloud button. Class names are the design system's own (shared.css).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { useLang, type Lang } from './lang';
import { speak } from '@/lib/speech';

/* ---------------------------------------------------------------- icons ---- */

type IconProps = {
  name: string;
  /** extra classes after `ic` — e.g. "s20", "s24", "lg", "xl", "flip" */
  cls?: string;
  style?: React.CSSProperties;
};

/** 24-unit interface icon. */
export function Icon({ name, cls = '', style }: IconProps) {
  return (
    <svg className={`ic ${cls}`.trim()} viewBox="0 0 24 24" style={style}>
      <use href={`#${name}`} />
    </svg>
  );
}

/** 48-unit trade glyph. */
export function Glyph({ name, style }: { name: string; style?: React.CSSProperties }) {
  return (
    <svg className="gly" viewBox="0 0 48 48" style={style}>
      <use href={`#${name}`} />
    </svg>
  );
}

/** 16-unit availability shape, used inside `.dot`. */
export function Shape({ name, box = 16 }: { name: string; box?: number }) {
  return (
    <svg viewBox={`0 0 ${box} ${box}`}>
      <use href={`#${name}`} />
    </svg>
  );
}

/* ----------------------------------------------------------------- exit ---- */

const EXIT = {
  ur: {
    exit: 'باہر نکلیں',
    q: 'ایپ سے باہر نکلیں؟',
    yes: 'باہر نکلیں',
    no: 'رکیں',
    byeH: 'خدا حافظ!',
    byeP: 'اب آپ یہ ٹیب بند کر سکتے ہیں۔',
    again: 'دوبارہ کھولیں',
  },
  rm: {
    exit: 'Bahar nikalein',
    q: 'App se bahar nikalna hai?',
    yes: 'Bahar nikalein',
    no: 'Ruk jayein',
    byeH: 'Khuda hafiz!',
    byeP: 'Ab aap yeh tab band kar sakte hain.',
    again: 'Dobara kholein',
  },
  en: {
    exit: 'Exit',
    q: 'Exit the app?',
    yes: 'Exit',
    no: 'Stay',
    byeH: 'Goodbye!',
    byeP: 'You can close this tab or window now.',
    again: 'Open again',
  },
};

type ExitCtxValue = { open: () => void; lang: Lang };
const ExitCtx = createContext<ExitCtxValue | null>(null);

/**
 * Exit: a "Stay / Exit" confirmation. A web page cannot always close its own tab
 * (it works in an installed app window, and is blocked in an ordinary tab), so if
 * the page is still here a moment after asking, say so plainly instead of
 * pretending it worked.
 */
export function useExit(lang: Lang) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'confirm' | 'bye'>('idle');
  const t = EXIT[lang];

  // Esc backs out of the confirmation.
  useEffect(() => {
    if (stage !== 'confirm') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStage('idle');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  const exitApp = () => {
    window.close();
    setTimeout(() => setStage('bye'), 150);
  };

  const layer =
    stage === 'idle' ? null : (
      <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
        {stage === 'confirm' && (
          <>
            <div className="scrim" onClick={() => setStage('idle')} />
            <section className="sheet col g12 rr-sheet" role="alertdialog" aria-modal="true" aria-labelledby="exit-h">
              <div className="grab" />
              <h2 id="exit-h" className="t nq" style={{ textAlign: 'center' }}>
                {t.q}
              </h2>
              <button type="button" className="btn btn-p" autoFocus onClick={() => setStage('idle')}>
                <span className="nq">{t.no}</span>
              </button>
              <button type="button" className="btn btn-no" onClick={exitApp}>
                <Icon name="i-power" />
                <span className="nq">{t.yes}</span>
              </button>
            </section>
          </>
        )}
        {stage === 'bye' && (
          <div
            className="rr-pop"
            role="status"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--roshan)',
              color: '#0B1020',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '18px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <span className="gl s88" style={{ ['--c' as string]: '#0B1020', ['--g' as string]: 'var(--roshan)' }}>
              <Icon name="i-lamp" cls="xl" />
            </span>
            <h2 className="d nq">{t.byeH}</h2>
            <p className="b bold">{t.byeP}</p>
            <button
              type="button"
              className="btn"
              style={{ background: '#0B1020', color: 'var(--roshan)', marginTop: '8px' }}
              onClick={() => router.push('/')}
            >
              {t.again}
            </button>
          </div>
        )}
      </div>
    );

  return { stage, open: () => setStage('confirm'), layer };
}

/** The Exit button: sits at the end of a top bar. Inside a <Screen> it needs no props. */
export function ExitBtn({
  open,
  lang,
  style,
}: {
  open?: () => void;
  lang?: Lang;
  style?: React.CSSProperties;
}) {
  const ctx = useContext(ExitCtx);
  const label = EXIT[lang ?? ctx?.lang ?? 'en'].exit;
  return (
    <button
      type="button"
      className="iconbtn exit-btn"
      aria-label={label}
      title={label}
      onClick={open ?? ctx?.open}
      style={style}
    >
      <Icon name="i-power" />
    </button>
  );
}

/* --------------------------------------------------------------- screen ---- */

export type ScreenProps = {
  /** `work` = Kaarigar skin, `cust` = Ghar skin. */
  skin: 'work' | 'cust';
  /** that board's own language default, as declared in its canvas props */
  defaultLang: Lang;
  /** the board's scope class, e.g. "s-c2" */
  id: string;
  /** extra classes on the .app element (e.g. "tk" on W7, "splash" on W0) */
  extra?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/**
 * The `.app` element: fixed 390×844 (the design system sets the size), carrying
 * the skin, the language class, `dir`, `lang` and `data-theme` — exactly the
 * attributes the canvas board put there.
 */
export function Screen({ skin, defaultLang, id, extra = '', style, children }: ScreenProps) {
  const { lang, dir, lc, theme } = useLang(defaultLang);
  const exit = useExit(lang);
  return (
    <div
      className={`app ${skin} ${lang} ${id} ${extra}`.replace(/\s+/g, ' ').trim()}
      dir={dir}
      lang={lc}
      data-theme={theme}
      style={style}
    >
      <ExitCtx.Provider value={{ open: exit.open, lang }}>{children}</ExitCtx.Provider>
      {exit.layer}
    </div>
  );
}

/* ------------------------------------------------------- language switch ---- */

/** The three-way switch that sits on every board. */
export function LangSwitch({ fallback, style }: { fallback: Lang; style?: React.CSSProperties }) {
  const { lang, setLang } = useLang(fallback);
  const opts: Array<[Lang, string]> = [
    ['ur', 'اردو'],
    ['rm', 'Roman'],
    ['en', 'EN'],
  ];
  return (
    <div className="seg3" role="group" aria-label="Language" style={style}>
      {opts.map(([code, label]) => (
        <button
          key={code}
          type="button"
          className={lang === code ? 'on' : ''}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- read aloud ---- */

/**
 * The speaker buttons were drawn on every board; here they actually speak, with
 * the browser's own voice. No key, no network. If the device has no voice for
 * the language it stays silent rather than guessing.
 */
export function SpeakBtn({
  label,
  say,
  lang,
  cls = 'iconbtn',
  icon = 'i-spk',
  iconCls = '',
  style,
}: {
  label: string;
  /** what to read out; defaults to the label */
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
      style={style}
      onClick={() => speak(say ?? label, lang)}
    >
      <Icon name={icon} cls={iconCls} />
    </button>
  );
}

/* ---------------------------------------------------------------- links ---- */

/** A prototype link from the canvas: same look, client-side routing. */
export function Go({
  href,
  className,
  children,
  style,
  ...rest
}: React.ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={className} style={style} {...rest}>
      {children}
    </Link>
  );
}

/** Stagger helper: `style={rise(i)}` gives each item its entrance delay. */
export function rise(i: number): React.CSSProperties {
  return { ['--i' as string]: i };
}
