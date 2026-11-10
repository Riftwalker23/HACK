'use client';

/** C1 · Describe the problem — `C1-Describe.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';

const D = {
  ur: {
    h: 'کیا خراب ہے؟',
    how: 'بتانے کا طریقہ',
    type: 'لکھیں',
    speak: 'بولیں',
    photo: 'تصویر',
    alt: 'گیزر کی تصویر، نیچے والو سے پانی ٹپک رہا ہے',
    b1: 'گیزر',
    b2: 'والو لیک',
    understood: 'ہم یہ سمجھے',
    k1: 'کام:',
    v1: 'پلمبر',
    k2: 'جلدی:',
    v2: 'ابھی',
    k3: 'ممکنہ حل:',
    v3: 'پریشر والو بدلنا',
    edit: 'بدلیں',
    find: 'قریب پلمبر ڈھونڈیں',
  },
  rm: {
    h: 'Kya kharab hai?',
    how: 'Batane ka tareeqa',
    type: 'Likhein',
    speak: 'Bolein',
    photo: 'Tasveer',
    alt: 'Geyser ki tasveer, neeche waale valve se paani tapak raha hai',
    b1: 'Geyser',
    b2: 'Valve leak',
    understood: 'Hum yeh samjhe',
    k1: 'Kaam:',
    v1: 'Plumber',
    k2: 'Jaldi:',
    v2: 'Abhi',
    k3: 'Mumkina hal:',
    v3: 'Pressure valve badalna',
    edit: 'Badlein',
    find: 'Qareeb plumber dhoondein',
  },
  en: {
    h: 'What needs fixing?',
    how: 'How to describe it',
    type: 'Type',
    speak: 'Speak',
    photo: 'Photo',
    alt: 'Photo of a geyser, water dripping from the lower valve',
    b1: 'Geyser',
    b2: 'Valve leak',
    understood: 'What we understood',
    k1: 'Trade:',
    v1: 'Plumber',
    k2: 'Urgency:',
    v2: 'Now',
    k3: 'Likely fix:',
    v3: 'Replace pressure valve',
    edit: 'Edit',
    find: 'Find a plumber nearby',
  },
};

export default function DescribePage() {
  const { lang } = useLang('en');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c1" extra="rr-screen">
        <header className="top">
          <span className="row g4 l bold fx" style={{ minWidth: 0 }}>
            <Icon name="i-pin" cls="s20 tl" />
            G-11, Islamabad
          </span>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <main className="col g12 fx px">
          <h1 className="t">{t.h}</h1>

          <div className="row g8" role="group" aria-label={t.how}>
            <button type="button" className="mode">
              <Icon name="i-kb" />
              {t.type}
            </button>
            <button type="button" className="mode">
              <Icon name="i-mic" />
              {t.speak}
            </button>
            <button type="button" className="mode on" aria-pressed="true">
              <Icon name="i-cam" />
              {t.photo}
            </button>
          </div>

          <div
            style={{ position: 'relative', height: '250px', borderRadius: '18px', overflow: 'hidden' }}
            role="img"
            aria-label={t.alt}
          >
            <svg
              viewBox="0 0 358 250"
              width="100%"
              height="100%"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0 }}
            >
              <rect width="358" height="250" fill="#C9C1B0" />
              <rect x="0" y="0" width="358" height="250" fill="url(#tiles)" />
              <defs>
                <pattern id="tiles" width="40" height="40" patternUnits="userSpaceOnUse">
                  <rect width="40" height="40" fill="#D8D2C4" />
                  <path d="M40 0H0v40" fill="none" stroke="#BDB5A4" strokeWidth="2" />
                </pattern>
              </defs>
              <rect x="120" y="22" width="110" height="170" rx="40" fill="#F4F4F2" stroke="#9AA0A8" strokeWidth="3" />
              <rect x="150" y="70" width="50" height="22" rx="4" fill="#3A4256" />
              <path d="M150 192v40M200 192v40" stroke="#8D95A3" strokeWidth="6" />
              <circle cx="200" cy="210" r="9" fill="#C2410C" />
              <path d="M205 220q4 12 0 24M196 222q-3 10 0 22" stroke="#2A6FD7" strokeWidth="3" fill="none" />
            </svg>
            <div className="bb rr-pop" style={{ left: '112px', top: '16px', width: '126px', height: '182px' }}>
              <span>{t.b1} 96%</span>
            </div>
            <div
              className="bb rr-pop"
              style={{
                left: '182px',
                top: '196px',
                width: '44px',
                height: '48px',
                borderColor: '#FFB347',
                animationDelay: '180ms',
              }}
            >
              <span style={{ background: '#FFB347' }}>{t.b2}</span>
            </div>
            <span
              className="ai"
              style={{
                position: 'absolute',
                insetBlockStart: '10px',
                insetInlineEnd: '10px',
                background: '#fff',
                color: '#2A4BD7',
                borderColor: '#2A4BD7',
              }}
            >
              AI · demo
            </span>
          </div>

          <div className="col g8" aria-live="polite">
            <div className="row sb">
              <span className="l bold soft">{t.understood}</span>
              <span className="ai">AI</span>
            </div>
            <div className="row g8 wrap">
              <span className="cls tr-plum rr-rise">
                <span className="gl s32" style={{ width: '24px', height: '24px' }} />
                {t.k1} <b>{t.v1}</b>
                <button type="button" aria-label={t.edit}>
                  <Icon name="i-pen" cls="s20" />
                </button>
              </span>
              <span className="cls rr-rise" style={{ borderColor: 'var(--decline)', ['--i' as string]: 1 }}>
                {t.k2} <b>{t.v2}</b>
                <button type="button" aria-label={t.edit}>
                  <Icon name="i-pen" cls="s20" />
                </button>
              </span>
              <span className="cls rr-rise" style={{ ['--i' as string]: 2 }}>
                {t.k3} <b>{t.v3}</b>
                <button type="button" aria-label={t.edit}>
                  <Icon name="i-pen" cls="s20" />
                </button>
              </span>
            </div>
          </div>
        </main>

        <div className="dock">
          <Link className="btn btn-t" href="/customer/results" style={{ minHeight: '56px' }}>
            <Icon name="i-search" cls="s24" />
            {t.find}
          </Link>
        </div>
      </Screen>
    </Stage>
  );
}
