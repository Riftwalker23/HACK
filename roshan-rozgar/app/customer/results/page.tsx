'use client';

/** C2 · Results — `C2-Results.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, Shape, rise } from '@/components/ui';
import { fmtTime, useAvailability, useMinute } from '@/lib/availability';

const D = {
  ur: {
    back: 'واپس',
    h: 'قریب پلمبر',
    map: 'نقشہ: آپ کے قریب 3 پلمبر',
    count: '3 قریب',
    filters: 'فلٹر',
    call: 'کال',
    req: 'بلائیں',
    f: ['ابھی فارغ', '3 کلومیٹر', '4.5+ ستارے', 'Rs 1–3k'],
    free: 'فارغ',
    busy: '4 بجے تک مصروف',
    busyAt: (x: string) => `${x} تک مصروف`,
    bookAt: (x: string) => `${x} پر بک کریں`,
    jobs: 'کام',
    w1: 'سب سے قریب پلمبر جس نے 12 گیزر ٹھیک کیے',
    w2: 'سب سے زیادہ ریٹنگ، لیکن ابھی مصروف',
  },
  rm: {
    back: 'Wapas',
    h: 'Qareeb plumber',
    map: 'Naqsha: aap ke qareeb 3 plumber',
    count: '3 qareeb',
    filters: 'Filter',
    call: 'Call',
    req: 'Bulayein',
    f: ['Abhi faarigh', '3 km', '4.5+ sitaare', 'Rs 1–3k'],
    free: 'Faarigh',
    busy: '4 baje tak masroof',
    busyAt: (x: string) => `${x} tak masroof`,
    bookAt: (x: string) => `${x} par book karein`,
    jobs: 'kaam',
    w1: 'Sab se qareeb plumber jis ne 12 geyser theek kiye',
    w2: 'Sab se zyada rating, lekin abhi masroof',
  },
  en: {
    back: 'Back',
    h: 'Plumbers nearby',
    map: 'Map: 3 plumbers near you',
    count: '3 nearby',
    filters: 'Filters',
    call: 'Call',
    req: 'Request',
    f: ['Available now', '≤ 3 km', '4.5+ stars', 'Rs 1–3k'],
    free: 'Available',
    busy: 'Busy till 4 pm',
    busyAt: (x: string) => `Busy till ${x}`,
    bookAt: (x: string) => `Book for ${x}`,
    jobs: 'jobs',
    w1: 'Closest plumber who has fixed 12 geyser leaks',
    w2: 'Highest rated nearby, but on a job now',
  },
};

export default function ResultsPage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const [off, setOff] = useState<Record<number, boolean>>({});

  // When a worker marks themselves "on a job" and sets a free time, the busy card
  // shows that time and the button becomes "Book for <time>".
  const av = useAvailability();
  const nowMin = useMinute();
  const busyUntil = av.status === 'busy' && av.freeAt && av.freeAt > nowMin * 60_000 ? av.freeAt : null;

  const workers = [
    { ini: 'RA', name: 'Rafiq Ahmed', km: '1.2 km', st: 'free', stw: t.free, r: '4.8', jobs: `38 ${t.jobs}`, why: t.w1, price: 'Rs 1,500–2,500', book: t.req },
    { ini: 'ZM', name: 'Zahid Mehmood', km: '2.4 km', st: 'busy', stw: busyUntil ? t.busyAt(fmtTime(busyUntil)) : t.busy, r: '4.9', jobs: `112 ${t.jobs}`, why: t.w2, price: 'Rs 2,000–3,000', book: busyUntil ? t.bookAt(fmtTime(busyUntil)) : t.req },
  ];

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c2" extra="rr-screen">
        <header className="top">
          <Link className="iconbtn" href="/customer/describe" aria-label={t.back}>
            <Icon name="i-back" cls="s24 flip" />
          </Link>
          <h1 className="b bold fx">{t.h}</h1>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '176px' }} />
          <ExitBtn />
        </header>

        <div className="map" style={{ height: '190px', flex: 'none' }} role="img" aria-label={t.map}>
          <svg className="bg" viewBox="0 0 390 190" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 60h390M0 140h390M90 0v190M230 0v190M320 0v190" stroke="var(--road)" strokeWidth="12" />
            <path d="M0 180L390 20" stroke="var(--road)" strokeWidth="16" />
            <rect x="250" y="76" width="56" height="50" rx="6" fill="#CFE3CF" opacity=".7" />
          </svg>
          <span className="me" style={{ left: '52%', top: '52%' }} />
          <span
            className="pin tr-plum rr-drop"
            style={{ left: '64%', top: '30%', width: '44px', height: '44px', background: 'var(--c)', color: 'var(--g)', ['--i' as string]: 0 }}
          >
            <Glyph name="g-plum" />
          </span>
          <span
            className="pin tr-plum rr-drop"
            style={{ left: '28%', top: '72%', width: '38px', height: '38px', background: 'var(--c)', color: 'var(--g)', ['--i' as string]: 1 }}
          >
            <Glyph name="g-plum" />
          </span>
          <span
            className="pin tr-plum rr-drop"
            style={{ left: '84%', top: '80%', width: '32px', height: '32px', background: 'var(--c)', color: 'var(--g)', ['--i' as string]: 2 }}
          >
            <Glyph name="g-plum" />
          </span>
          <span
            className="chip sm"
            style={{ position: 'absolute', insetBlockEnd: '10px', insetInlineStart: '12px', minHeight: '36px' }}
          >
            <Icon name="i-list" cls="s20" />
            {t.count}
          </span>
        </div>

        <div
          className="row g8 px"
          style={{ paddingBlock: '10px', overflow: 'hidden', flex: 'none' }}
          role="group"
          aria-label={t.filters}
        >
          {t.f.map((label, i) => {
            const on = !off[i];
            return (
              <button
                type="button"
                key={label}
                className={`fc ${on ? 'on' : ''}`.trim()}
                aria-pressed={on}
                onClick={() => setOff((o) => ({ ...o, [i]: !o[i] }))}
              >
                {label}
              </button>
            );
          })}
        </div>

        <main className="col g12 fx px" style={{ overflow: 'hidden' }}>
          {workers.map((w, i) => (
            <article className="wc rr-rise" key={w.name} style={rise(i + 2)}>
              <div className="row g12">
                <span className="av">{w.ini}</span>
                <div className="col fx g4">
                  <div className="row sb g8">
                    <Link href="/customer/profile" className="b bold" style={{ textDecoration: 'none' }}>
                      {w.name}
                    </Link>
                    <span className="b bold num" dir="ltr">
                      {w.km}
                    </span>
                  </div>
                  <div className="row g8">
                    <span
                      className={`pill ${w.st}`}
                      style={{ height: '30px', fontSize: '13px', paddingInline: '8px 10px' }}
                    >
                      <span className="dot">
                        <Shape name={`s-${w.st}`} />
                      </span>
                      {w.stw}
                    </span>
                    <span className="row g4 l">
                      <Icon name="i-star" cls="s20" style={{ fill: 'var(--star)', color: '#8A6200' }} />
                      <b className="num">{w.r}</b>
                      <span className="soft">· {w.jobs}</span>
                    </span>
                  </div>
                </div>
              </div>
              <p className="why">
                <span className="ai" style={{ flex: 'none' }}>
                  AI
                </span>
                <span>{w.why}</span>
              </p>
              <div className="row g8">
                <span className="l soft fx num">{w.price}</span>
                <button
                  type="button"
                  className="btn btn-o"
                  aria-label={`${t.call} ${w.name}`}
                  style={{ minHeight: '44px', width: '48px', padding: 0 }}
                >
                  <Icon name="i-phone" cls="s24" />
                </button>
                <Link className="btn btn-t" href="/customer/profile" style={{ minHeight: '44px' }}>
                  {w.book}
                </Link>
              </div>
            </article>
          ))}
        </main>
      </Screen>
    </Stage>
  );
}
