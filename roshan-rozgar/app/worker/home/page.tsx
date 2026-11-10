'use client';

/**
 * W6 · Worker home — `W6-Home.dc.html` on the canvas.
 *
 * Added on top of the design: tapping "On a job" opens a box asking when the worker
 * will be free. It starts at one hour; the worker can pick 30 min / 1 h / 2 h or set
 * the time themselves. Customers then see "Busy till …" and can book from that time.
 */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, Shape, SpeakBtn } from '@/components/ui';
import {
  fmtTime,
  fromInputValue,
  minutesFromNow,
  setAvailability,
  toInputValue,
  useAvailability,
  type Status,
} from '@/lib/availability';

const D = {
  ur: {
    hi: 'سلام، اسلم بھائی!',
    h: 'آج میرا حال',
    earn: 'آج کی کمائی',
    j1: 'کچن میں شارٹ سرکٹ',
    free: 'فارغ ہوں',
    busy: 'کام پر ہوں',
    off: 'آج چھٹی',
    read: 'یہ صفحہ سنیں',
    when: 'آپ کب فارغ ہوں گے؟',
    q30: '30 منٹ',
    q60: '1 گھنٹہ',
    q120: '2 گھنٹے',
    custom: 'یا خود وقت لگائیں',
    freeAt: 'فارغ',
    book: 'اس وقت سے گاہک آپ کو بک کر سکتے ہیں',
    done: 'ٹھیک ہے',
    edit: 'وقت بدلیں',
    close: 'بند کریں',
  },
  rm: {
    hi: 'Salaam, Aslam bhai!',
    h: 'Aaj mera haal',
    earn: 'Aaj ki kamai',
    j1: 'Kitchen mein short circuit',
    free: 'Faarigh hoon',
    busy: 'Kaam par hoon',
    off: 'Aaj chutti',
    read: 'Yeh safha sunein',
    when: 'Aap kab faarigh honge?',
    q30: '30 minute',
    q60: '1 ghanta',
    q120: '2 ghante',
    custom: 'Ya khud waqt lagayein',
    freeAt: 'Faarigh',
    book: 'Is waqt se gahak aap ko book kar sakte hain',
    done: 'Theek hai',
    edit: 'Waqt badlein',
    close: 'Band karein',
  },
  en: {
    hi: 'Salaam, Aslam bhai!',
    h: 'My status today',
    earn: 'Earned today',
    j1: 'Kitchen short circuit',
    free: 'Available',
    busy: 'On a job',
    off: 'Off today',
    read: 'Read this page aloud',
    when: 'When will you be free?',
    q30: '30 min',
    q60: '1 hour',
    q120: '2 hours',
    custom: 'Or set the time yourself',
    freeAt: 'Free at',
    book: 'Customers can book you from then',
    done: 'Done',
    edit: 'Change time',
    close: 'Close',
  },
};

const STATES: Status[] = ['free', 'busy', 'off'];
const QUICK = [30, 60, 120] as const;

export default function WorkerHomePage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const av = useAvailability();
  const [sheet, setSheet] = useState(false);
  // which quick chip is lit: a number of minutes, or 'custom' once the time was typed
  const [choice, setChoice] = useState<number | 'custom'>(60);

  const pick = (id: Status) => {
    if (id !== 'busy') {
      setAvailability({ status: id, freeAt: null });
      setSheet(false);
      return;
    }
    if (av.status === 'busy' && av.freeAt) {
      // already busy: tapping again reopens the box to change the time
      setChoice('custom');
    } else {
      // first tap: assume the usual one hour, and let the worker adjust it
      setAvailability({ status: 'busy', freeAt: minutesFromNow(60) });
      setChoice(60);
    }
    setSheet(true);
  };

  const quick = (mins: number) => {
    setAvailability({ status: 'busy', freeAt: minutesFromNow(mins) });
    setChoice(mins);
  };

  const typed = (value: string) => {
    const at = fromInputValue(value);
    if (at) {
      setAvailability({ status: 'busy', freeAt: at });
      setChoice('custom');
    }
  };

  const st = av.status;
  const when = av.freeAt ? fmtTime(av.freeAt) : null;

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w6" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={`${t.hi} ${t.h}`} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px" style={{ paddingBottom: '16px' }}>
          <h1 className="sr">{t.h}</h1>

          <div className="row g12">
            <span
              className="gl s56"
              style={{
                ['--c' as string]: 'var(--roshan)',
                ['--g' as string]: '#0B1020',
                font: "800 22px/1 'Plus Jakarta Sans', sans-serif",
                border: '3px solid #0B1020',
              }}
            >
              MA
            </span>
            <p className="t nq fx">{t.hi}</p>
          </div>

          <div className="col g12" role="group" aria-label={t.h} aria-live="polite">
            {STATES.map((id) => {
              const on = id === st;
              return (
                <button
                  type="button"
                  key={id}
                  className={`st ${id} ${on ? 'sel' : ''}`.trim()}
                  aria-pressed={on}
                  onClick={() => pick(id)}
                >
                  <span className={`sh${on ? ' rr-flip' : ''}`}>
                    <Shape name={`s-${id}-lg`} box={48} />
                  </span>
                  <span className={`${on ? 'd' : 't'} nq`}>{t[id]}</span>
                  {on && id === 'busy' && when && (
                    <span
                      className="row g8 l bold rr-pop"
                      style={{ marginTop: '-4px' }}
                      aria-label={`${t.freeAt} ${when}. ${t.edit}`}
                    >
                      <Icon name="i-clock" cls="s24" />
                      <span dir="ltr" className="num">
                        {t.freeAt} {when}
                      </span>
                      <Icon name="i-pen" cls="s20" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="card row g12" style={{ padding: '14px 16px', marginTop: 'auto' }}>
            <span className="gl s56" style={{ ['--c' as string]: 'var(--roshan)', ['--g' as string]: '#0B1020' }}>
              <Icon name="i-coin" />
            </span>
            <div className="col fx">
              <span className="l soft">{t.earn}</span>
              <span className="t num" dir="ltr" style={{ textAlign: 'start' }}>
                Rs 3,500
              </span>
            </div>
            <span className="row g4 l bold" style={{ color: 'var(--accept)' }}>
              <Icon name="i-chk" cls="s24" />2
            </span>
          </div>

          <Link className="job rr-rise" href="/worker/request" style={{ textDecoration: 'none' }}>
            <span className="gl s56 tr-elec">
              <Glyph name="g-elec" />
            </span>
            <div className="col fx">
              <span className="b bold">{t.j1}</span>
              <span className="row g8 l soft">
                <Icon name="i-pin" cls="s20" />
                <span className="num">1.8 km</span>
                <Icon name="i-clock" cls="s20" />
                <span className="num">4:30</span>
              </span>
            </div>
          </Link>
        </main>

        {sheet && st === 'busy' && av.freeAt && (
          <>
            <div className="scrim" onClick={() => setSheet(false)} />
            <section
              className="sheet col g12 rr-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="free-h"
            >
              <div className="grab" />
              <h2 id="free-h" className="t nq">
                {t.when}
              </h2>

              <div className="row g8" role="radiogroup" aria-label={t.when}>
                {QUICK.map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`chip${choice === m ? ' sel' : ''}`}
                    role="radio"
                    aria-checked={choice === m}
                    onClick={() => quick(m)}
                    style={{ flex: 1, justifyContent: 'center', minHeight: '56px' }}
                  >
                    {t[`q${m}` as 'q30' | 'q60' | 'q120']}
                  </button>
                ))}
              </div>

              <label className="col g8">
                <span className="l soft">{t.custom}</span>
                <input
                  type="time"
                  className="num"
                  value={toInputValue(av.freeAt)}
                  onChange={(e) => typed(e.target.value)}
                  style={{
                    minHeight: '56px',
                    width: '100%',
                    padding: '0 16px',
                    borderRadius: '16px',
                    border: `2px solid ${choice === 'custom' ? 'var(--text)' : 'var(--line)'}`,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    font: "700 22px 'Plus Jakarta Sans', sans-serif",
                  }}
                />
              </label>

              <div
                className="card row g12"
                style={{ padding: '12px 14px', background: 'var(--tint)', borderColor: 'var(--roshan)' }}
                aria-live="polite"
              >
                <span className="gl s40" style={{ ['--c' as string]: 'var(--accept)', ['--g' as string]: '#fff' }}>
                  <Icon name="i-clock" cls="s24" />
                </span>
                <div className="col fx">
                  <span className="b bold num" dir="ltr" style={{ textAlign: 'start' }}>
                    {t.freeAt} {fmtTime(av.freeAt)}
                  </span>
                  <span className="l soft">{t.book}</span>
                </div>
              </div>

              <button type="button" className="btn btn-ok" onClick={() => setSheet(false)}>
                <Icon name="i-chk" />
                <span className="nq">{t.done}</span>
              </button>
            </section>
          </>
        )}
      </Screen>
    </Stage>
  );
}
