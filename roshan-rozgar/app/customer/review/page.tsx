'use client';

/** C6 · Review — `C6-Review.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';

const D = {
  ur: {
    h: 'رفیق کا کام کیسا رہا؟',
    sub: 'گیزر والو · آج',
    rate: 'ستارے',
    star: 'ستارے',
    speak: 'اپنی رائے بولیں',
    aiNote: 'آپ کی بات کا خلاصہ',
    said: '“وقت پر آئے، والو بدلا اور فرش بھی صاف کر کے گئے۔ قیمت وہی لی جو طے تھی۔”',
    tagsH: 'ٹیگ لگائیں',
    tags: { clock: 'وقت پر', spark: 'صاف کام', coin: 'مناسب قیمت', smile: 'اچھا رویہ' },
    send: 'رائے بھیجیں',
  },
  rm: {
    h: 'Rafiq ka kaam kaisa raha?',
    sub: 'Geyser valve · aaj',
    rate: 'Sitaare',
    star: 'sitaare',
    speak: 'Apni raaye bolein',
    aiNote: 'aap ki baat ka khulasa',
    said: '“Waqt par aaye, valve badla aur farsh bhi saaf kar ke gaye. Qeemat wohi li jo tay thi.”',
    tagsH: 'Tag lagayein',
    tags: { clock: 'Waqt par', spark: 'Saaf kaam', coin: 'Munasib qeemat', smile: 'Achha rawaiya' },
    send: 'Raaye bhejein',
  },
  en: {
    h: 'How was Rafiq’s work?',
    sub: 'Geyser valve · today',
    rate: 'Rating',
    star: 'stars',
    speak: 'Speak your review',
    aiNote: 'transcribed + translated from Urdu',
    said: '“Came on time, replaced the valve and even cleaned the floor. Charged exactly the agreed price.”',
    tagsH: 'Add tags',
    tags: { clock: 'On time', spark: 'Clean work', coin: 'Fair price', smile: 'Polite' },
    send: 'Submit review',
  },
};

const TAGS = ['clock', 'spark', 'coin', 'smile'] as const;

export default function ReviewPage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const [r, setR] = useState(5);
  const [on, setOn] = useState<Record<string, boolean>>({ clock: true, spark: true, coin: true });

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c6" extra="rr-screen">
        <header className="top">
          <span className="fx" />
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <main className="col g16 fx px">
          <div className="col g4">
            <h1 className="t">{t.h}</h1>
            <span className="l soft">{t.sub}</span>
          </div>

          <div className="row" role="radiogroup" aria-label={t.rate} style={{ justifyContent: 'center', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`sb2 ${n <= r ? 'on' : ''}`.trim()}
                role="radio"
                aria-checked={n <= r}
                aria-label={`${n} ${t.star}`}
                onClick={() => setR(n)}
              >
                <svg viewBox="0 0 24 24" key={`${n}-${n <= r}`} className={n <= r ? 'rr-spring' : undefined}>
                  <use href="#i-star" />
                </svg>
              </button>
            ))}
          </div>

          <div className="card col g12" style={{ padding: '14px', borderRadius: '18px', alignItems: 'center' }}>
            <div className="orb" style={{ width: '80px', height: '80px' }}>
              <button className="mic" aria-label={t.speak} style={{ width: '80px', height: '80px' }}>
                <Icon name="i-mic" style={{ width: '34px', height: '34px' }} />
              </button>
            </div>
            <span className="b bold">{t.speak}</span>
            <div className="col g8" style={{ width: '100%' }} aria-live="polite">
              <div className="row g8">
                <span className="ai">AI · demo</span>
                <span className="xs soft">{t.aiNote}</span>
              </div>
              <p className="tx">{t.said}</p>
            </div>
          </div>

          <div className="col g8">
            <span className="l bold soft">{t.tagsH}</span>
            <div className="row g8 wrap">
              {TAGS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  className={`tg ${on[ic] ? 'on' : ''}`.trim()}
                  aria-pressed={!!on[ic]}
                  onClick={() => setOn((o) => ({ ...o, [ic]: !o[ic] }))}
                >
                  <Icon name={`i-${ic}`} cls="s20" />
                  {t.tags[ic]}
                </button>
              ))}
            </div>
          </div>
        </main>

        <div className="dock">
          <Link className="btn btn-t" href="/customer/states" style={{ minHeight: '56px' }}>
            <Icon name="i-chk" cls="s24" />
            {t.send}
          </Link>
        </div>
      </Screen>
    </Stage>
  );
}
