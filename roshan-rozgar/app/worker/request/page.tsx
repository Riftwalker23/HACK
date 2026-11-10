'use client';

/** W7 · Incoming request — `W7-Request.dc.html` on the canvas. */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, SpeakBtn, rise } from '@/components/ui';

const D = {
  ur: {
    mapA: 'نقشہ: گاہک کا گھر آپ سے 1.8 کلومیٹر دور',
    title: 'نیا کام: کچن میں شارٹ سرکٹ',
    speaking: 'سنا رہے ہیں…',
    timer: '42 سیکنڈ باقی',
    photo: 'گاہک کی تصویر: کچن کا ساکٹ',
    sample: 'نمونہ تصویر',
    yes: 'ہاں، کرلوں گا',
    no: 'ابھی نہیں',
    read: 'یہ صفحہ سنیں',
  },
  rm: {
    mapA: 'Naqsha: gahak ka ghar aap se 1.8 km door',
    title: 'Naya kaam: kitchen mein short circuit',
    speaking: 'Suna rahe hain…',
    timer: '42 second baqi',
    photo: 'Gahak ki tasveer: kitchen ka socket',
    sample: 'Namoona tasveer',
    yes: 'Haan, kar loonga',
    no: 'Abhi nahi',
    read: 'Yeh safha sunein',
  },
  en: {
    mapA: 'Map: the customer’s home is 1.8 km from you',
    title: 'New job: kitchen short circuit',
    speaking: 'Reading it to you…',
    timer: '42 seconds left',
    photo: 'Customer photo: kitchen socket',
    sample: 'Sample photo',
    yes: 'Yes, I’ll do it',
    no: 'Not now',
    read: 'Read this page aloud',
  },
};

export default function RequestPage() {
  const { lang } = useLang('ur');
  const t = D[lang];

  // The drawn countdown actually counts: 42 → 0, then it has simply run out.
  const [left, setLeft] = useState(42);
  useEffect(() => {
    const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w7" extra="tk rr-screen">
        <header className="top">
          <SpeakBtn
            label={t.read}
            say={t.title}
            lang={lang}
            style={{ borderColor: 'var(--roshan)', color: 'var(--roshan)' }}
          />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px">
          <div className="row g16">
            <div
              style={{ position: 'relative', width: '96px', height: '96px', flex: 'none' }}
              role="timer"
              aria-label={t.timer}
            >
              <svg
                viewBox="0 0 96 96"
                width="96"
                height="96"
                aria-hidden="true"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle cx="48" cy="48" r="42" fill="none" stroke="#323C55" strokeWidth="8" />
                <circle
                  className="rr-ring"
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke="#FF9F1C"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="264"
                  strokeDashoffset="79"
                />
              </svg>
              <span
                className="t num"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {left}
              </span>
            </div>
            <div className="col g4 fx">
              <span className="row g8 l bold" style={{ color: 'var(--roshan)' }}>
                <Icon name="i-spk" cls="s24" />
                {t.speaking}
              </span>
              <h1 className="t nq">{t.title}</h1>
            </div>
          </div>

          <div
            className="ph"
            style={{
              height: '130px',
              background: '#1A2133',
              borderColor: '#323C55',
              position: 'relative',
              overflow: 'hidden',
            }}
            role="img"
            aria-label={t.photo}
          >
            <svg
              viewBox="0 0 358 210"
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0 }}
            >
              <rect width="358" height="210" fill="#2A3142" />
              <rect x="0" y="150" width="358" height="60" fill="#3A3226" />
              <rect x="128" y="40" width="100" height="70" rx="8" fill="#E9ECF0" />
              <circle cx="160" cy="75" r="9" fill="#2A3142" />
              <circle cx="196" cy="75" r="9" fill="#2A3142" />
              <path d="M150 40c-6-14 10-16 4-30M206 40c6-12-8-16-2-30" stroke="#8D95A3" strokeWidth="3" fill="none" />
              <path d="M170 110q8 22-6 40" stroke="#D7263D" strokeWidth="5" fill="none" />
            </svg>
            <span
              className="xs"
              style={{
                position: 'absolute',
                insetBlockEnd: '8px',
                insetInlineStart: '8px',
                background: 'rgba(0,0,0,.6)',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              {t.sample}
            </span>
          </div>

          <div
            className="map"
            style={{
              height: '120px',
              flex: 'none',
              borderRadius: '18px',
              ['--mapbg' as string]: '#1F2A3A',
              ['--road' as string]: '#3A4660',
              border: '2px solid #323C55',
            }}
            role="img"
            aria-label={t.mapA}
          >
            <svg className="bg" viewBox="0 0 358 120" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 40h358M0 95h358M80 0v120M250 0v120" stroke="var(--road)" strokeWidth="10" />
              <path
                d="M80 95L80 40L250 40"
                stroke="#FF9F1C"
                strokeWidth="5"
                strokeDasharray="10 7"
                fill="none"
              />
            </svg>
            <span className="me amber" style={{ left: '22%', top: '79%' }} />
            <span
              className="pin rr-drop"
              style={{
                left: '70%',
                top: '33%',
                width: '48px',
                height: '48px',
                background: '#0E6E6B',
                color: '#fff',
              }}
            >
              <Icon name="i-house" />
            </span>
          </div>

          <div className="row g8">
            <div className="stat rr-rise">
              <Icon name="i-pin" style={{ color: 'var(--roshan)' }} />
              <span className="b bold num" dir="ltr">
                1.8 km
              </span>
            </div>
            <div className="stat rr-rise" style={rise(1)}>
              <Icon name="i-star" style={{ color: '#F2B01E', fill: '#F2B01E' }} />
              <span className="b bold num" dir="ltr">
                4.8
              </span>
            </div>
            <div className="stat rr-rise" style={rise(2)}>
              <Icon name="i-coin" style={{ color: 'var(--roshan)' }} />
              <span className="b bold num" dir="ltr">
                ~2,500
              </span>
            </div>
          </div>
        </main>

        <div className="dock">
          <Link className="btn btn-ok big" href="/worker/chat">
            <Icon name="i-chk" cls="lg" />
            <span className="nq">{t.yes}</span>
          </Link>
          <button type="button" className="btn btn-no big" style={{ borderRadius: '999px' }}>
            <Icon name="i-x" cls="lg" />
            <span className="nq">{t.no}</span>
          </button>
        </div>
      </Screen>
    </Stage>
  );
}
