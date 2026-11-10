'use client';

/** W0 · Splash / loading — `Splash.dc.html` on the canvas. */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { ExitBtn, useExit } from '@/components/ui';

/** One rising ember: horizontal drift, size, delay and duration. */
const EMBERS = [
  { dx: -22, s: 5, d: 1.1, t: 2.6 },
  { dx: 14, s: 4, d: 1.7, t: 2.9 },
  { dx: -6, s: 6, d: 2.3, t: 2.5 },
  { dx: 26, s: 3, d: 2.8, t: 3.1 },
  { dx: -30, s: 3, d: 3.2, t: 2.7 },
];

const WORD = ['Apna', 'Karigar'];

export default function SplashPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const exit = useExit('en');
  const exiting = exit.stage !== 'idle';

  // A loading state has to end somewhere. The splash holds long enough to be seen,
  // fades out, then hands over to the role choice. A tap anywhere skips the wait.
  // While the Exit dialog is open the timer is paused, so it can't navigate away.
  useEffect(() => {
    router.prefetch('/start');
    if (exiting) return;
    const fade = setTimeout(() => setLeaving(true), 4200);
    const go = setTimeout(() => router.push('/start'), 4650);
    return () => {
      clearTimeout(fade);
      clearTimeout(go);
    };
  }, [router, exiting]);

  let letter = 0;

  return (
    <Stage>
      <div
        className={`app splash rr-screen${leaving ? ' rr-leave' : ''}`}
        dir="ltr"
        lang="en"
        style={{ alignItems: 'center', textAlign: 'center' }}
      >
        <Link className="go" href="/start" aria-label="Open Apna Karigar" />
        <ExitBtn
          open={exit.open}
          lang="en"
          style={{ position: 'absolute', insetBlockStart: '28px', insetInlineEnd: '16px', zIndex: 2 }}
        />
        <div className="glow rr-glow" aria-hidden="true" />
        <div className="jhalar rr-fringe" aria-hidden="true" style={{ width: '100%', position: 'relative' }} />

        <main className="col ctr" style={{ flex: 1, gap: '22px', position: 'relative' }}>
          {/* the entrance lives on this wrapper so the mark keeps its own gentle breathing */}
          <div className="rr-splash-mark rr-mark-wrap">
            <div className="mark" role="img" aria-label="Apna Karigar logo: a lit diya lamp">
              <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
                <circle className="rr-halo" cx="50" cy="40" r="22" fill="#FF9F1C" opacity=".22" />
                <g className="rr-flame">
                  <path d="M50 14c9 9 13 15 13 22a13 13 0 0 1-26 0c0-7 4-13 13-22z" fill="#FF9F1C" />
                  <path d="M50 28c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10z" fill="#FFE2A8" />
                </g>
                <path d="M14 58h72c0 14-16 24-36 24S14 72 14 58z" fill="#FF9F1C" />
                <path d="M24 58h52" stroke="#0B1020" strokeWidth="3" strokeLinecap="round" opacity=".35" />
                <path d="M38 88h24" stroke="#FF9F1C" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </div>
            {EMBERS.map((e, i) => (
              <span
                key={i}
                className="rr-ember"
                aria-hidden="true"
                style={{
                  ['--dx' as string]: `${e.dx}px`,
                  width: e.s,
                  height: e.s,
                  animationDelay: `${e.d}s`,
                  animationDuration: `${e.t}s`,
                }}
              />
            ))}
          </div>

          <div className="col" style={{ gap: '2px', alignItems: 'center' }}>
            {/* each letter rises in turn; the heading keeps its plain text for readers */}
            <h1 className="wm-en" aria-label="Apna Karigar">
              {WORD.map((word, wi) => (
                <span key={word} aria-hidden="true" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                  {word.split('').map((ch) => (
                    <span
                      key={letter}
                      className="rr-letter"
                      style={{ ['--i' as string]: letter++ }}
                    >
                      {ch}
                    </span>
                  ))}
                  {wi < WORD.length - 1 && <span className="rr-letter" style={{ ['--i' as string]: letter++ }}>&nbsp;</span>}
                </span>
              ))}
            </h1>
            <p className="wm-ur rr-fade" lang="ur" dir="rtl" style={{ animationDelay: '1.5s' }}>
              اپنا کاریگر
            </p>
            <p className="tag rr-fade" style={{ animationDelay: '1.9s' }}>
              Har kaam ka bharosemand haath
            </p>
          </div>
        </main>

        <div
          className="col rr-fade"
          style={{
            gap: '14px',
            alignItems: 'center',
            paddingBottom: '36px',
            position: 'relative',
            animationDelay: '2.2s',
          }}
          aria-live="polite"
        >
          <div className="load" role="progressbar" aria-label="Loading">
            <i />
          </div>
          <span className="tag" style={{ fontSize: '14px' }}>
            Loading…{' '}
            <span lang="ur" style={{ fontFamily: "'Noto Naskh Arabic', serif" }}>
              لوڈ ہو رہا ہے…
            </span>
          </span>
          <span className="by" style={{ marginTop: '18px' }}>
            by <b>Roshan Rozgar</b>
          </span>
        </div>
        {exit.layer}
      </div>
    </Stage>
  );
}
