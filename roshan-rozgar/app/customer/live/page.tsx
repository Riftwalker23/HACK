'use client';

/** C5 · Live job status — `C5-Live.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen } from '@/components/ui';
import { speak } from '@/lib/speech';

const D = {
  ur: {
    h: 'کام جاری ہے',
    map: 'نقشہ: رفیق 12 منٹ دور',
    prog: 'کام کی پیش رفت',
    s1: 'درخواست',
    s2: 'طے',
    s3: 'راستے میں',
    s4: 'مکمل',
    status: 'راستے میں ہیں، سامان ساتھ ہے',
    call: 'رفیق کو کال کریں',
    play: 'وائس نوٹ سنیں',
    see: 'دیکھیں',
    tr: 'ترجمہ',
    msg: '“باجی، نیا والو لے لیا ہے، دس منٹ میں پہنچ رہا ہوں۔”',
    done: 'کام مکمل ہوگیا',
  },
  rm: {
    h: 'Kaam jaari hai',
    map: 'Naqsha: Rafiq 12 minute door',
    prog: 'Kaam ki pesh-raft',
    s1: 'Darkhwast',
    s2: 'Tay',
    s3: 'Raaste mein',
    s4: 'Mukammal',
    status: 'Raaste mein hain, saamaan saath hai',
    call: 'Rafiq ko call karein',
    play: 'Voice note sunein',
    see: 'Dekhein',
    tr: 'tarjuma',
    msg: '“Baaji, naya valve le liya hai, das minute mein pohanch raha hoon.”',
    done: 'Kaam mukammal ho gaya',
  },
  en: {
    h: 'Job in progress',
    map: 'Map: Rafiq is 12 minutes away',
    prog: 'Job progress',
    s1: 'Requested',
    s2: 'Agreed',
    s3: 'On the way',
    s4: 'Done',
    status: 'On the way, carrying the parts',
    call: 'Call Rafiq',
    play: 'Play voice note',
    see: 'See it',
    tr: 'translated from Urdu',
    msg: '“I’ve picked up the new valve, reaching you in ten minutes.”',
    done: 'Mark job as done',
  },
};

export default function LivePage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const [open, setOpen] = useState(true);

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c5" extra="rr-screen">
        <header className="top">
          <h1 className="b bold fx">{t.h}</h1>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <div className="map" style={{ height: '230px', flex: 'none' }} role="img" aria-label={t.map}>
          <svg className="bg" viewBox="0 0 390 230" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 70h390M0 170h390M110 0v230M270 0v230" stroke="var(--road)" strokeWidth="12" />
            <path
              d="M300 30 L270 70 L270 170 L195 170"
              stroke="#0E6E6B"
              strokeWidth="5"
              strokeDasharray="10 8"
              fill="none"
            />
          </svg>
          <span className="me" style={{ left: '50%', top: '74%' }} />
          <span
            className="pin tr-plum rr-drop"
            style={{ left: '69%', top: '46%', width: '44px', height: '44px', background: 'var(--c)', color: 'var(--g)' }}
          >
            <Glyph name="g-plum" />
          </span>
          <span
            className="chip"
            style={{
              position: 'absolute',
              insetBlockStart: '12px',
              insetInlineStart: '12px',
              minHeight: '40px',
              fontSize: '14px',
            }}
          >
            <b className="num">12 min</b> · <span className="num">2.1 km</span>
          </span>
        </div>

        <main className="col g12 fx px" style={{ paddingTop: '14px' }}>
          <div className="rail sm" role="list" aria-label={t.prog}>
            <span className="n done" role="listitem" aria-label={t.s1}>
              <Icon name="i-send" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n done" role="listitem" aria-label={t.s2}>
              <Icon name="i-hand" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n cur" role="listitem" aria-current="step" aria-label={t.s3}>
              <Icon name="i-wrench" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n" role="listitem" aria-label={t.s4}>
              <Icon name="i-flag" cls="s20" />
            </span>
          </div>
          <div className="row sb" aria-hidden="true" style={{ marginTop: '-6px' }}>
            <span className="rl soft" style={{ marginInlineStart: '-14px' }}>
              {t.s1}
            </span>
            <span className="rl soft">{t.s2}</span>
            <span className="rl" style={{ color: 'var(--roshan-text)' }}>
              {t.s3}
            </span>
            <span className="rl soft" style={{ marginInlineEnd: '-14px' }}>
              {t.s4}
            </span>
          </div>

          <div className="card row g12 rr-pop" style={{ padding: '12px', borderRadius: '18px' }} aria-live="polite">
            <span
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'var(--ttint)',
                display: 'grid',
                placeItems: 'center',
                font: "800 16px/1 'Plus Jakarta Sans', sans-serif",
                flex: 'none',
              }}
            >
              RA
            </span>
            <div className="col fx">
              <span className="b bold">Rafiq Ahmed</span>
              <span className="l soft">{t.status}</span>
            </div>
            <button type="button" className="btn btn-t" aria-label={t.call} style={{ width: '52px', padding: 0 }}>
              <Icon name="i-phone" cls="s24" />
            </button>
          </div>

          <div className="col g8">
            <div className="vn rr-rise">
              <button type="button" className="play" aria-label={t.play} onClick={() => speak(t.msg, lang)}>
                <Icon name="i-play" cls="s24" />
              </button>
              <div className="wv" aria-hidden="true">
                {Array.from({ length: 18 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <span className="l num">0:06</span>
            </div>
            <div className="row g8">
              <button type="button" className="see" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <Icon name="i-eye" cls="s20" />
                {t.see}
              </button>
              <span className="ai">AI · {t.tr}</span>
            </div>
            {open && <p className="tr rr-pop">{t.msg}</p>}
          </div>
        </main>

        <div className="dock">
          <Link className="btn btn-o" href="/customer/review">
            <Icon name="i-chk" cls="s24" style={{ color: 'var(--accept)' }} />
            {t.done}
          </Link>
        </div>
      </Screen>
    </Stage>
  );
}
