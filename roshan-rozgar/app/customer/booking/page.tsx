'use client';

/** C4 · Booking confirm — `C4-Booking.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { speak } from '@/lib/speech';

const D = {
  ur: {
    h: 'بکنگ کی تصدیق',
    close: 'بند کریں',
    when: 'کب؟',
    tm: [['ابھی', '~15 منٹ'], ['1 گھنٹے میں', '5:30'], ['کل صبح', '10:00']],
    addr: 'گھر 14، گلی 22، جی-11/3',
    addr2: 'نقشے پر پن لگا ہے',
    change: 'بدلیں',
    price: 'طے شدہ قیمت',
    play: 'رفیق کا وائس نوٹ',
    quote: '“دو ہزار، والو کا خرچ الگ”',
    amt: 'رقم',
    inc: 'شامل',
    incV: 'مزدوری',
    exc: 'شامل نہیں',
    excV: 'نیا والو',
    him: 'رفیق: منظور',
    you: 'آپ: منظور کریں',
    confirm: 'بکنگ پکی کریں',
  },
  rm: {
    h: 'Booking ki tasdeeq',
    close: 'Band karein',
    when: 'Kab?',
    tm: [['Abhi', '~15 min'], ['1 ghante mein', '5:30'], ['Kal subah', '10:00']],
    addr: 'Ghar 14, Gali 22, G-11/3',
    addr2: 'Naqshe par pin laga hai',
    change: 'Badlein',
    price: 'Tay shuda qeemat',
    play: 'Rafiq ka voice note',
    quote: '“Do hazaar, valve ka kharcha alag”',
    amt: 'Raqam',
    inc: 'Shaamil',
    incV: 'Mazdoori',
    exc: 'Shaamil nahi',
    excV: 'Naya valve',
    him: 'Rafiq: manzoor',
    you: 'Aap: manzoor karein',
    confirm: 'Booking pakki karein',
  },
  en: {
    h: 'Confirm booking',
    close: 'Close',
    when: 'When?',
    tm: [['Now', '~15 min'], ['In 1 hour', '5:30 pm'], ['Tomorrow', '10:00 am']],
    addr: 'House 14, Street 22, G-11/3',
    addr2: 'Pinned on map',
    change: 'Change',
    price: 'Agreed price',
    play: 'Rafiq’s voice note',
    quote: '“Two thousand, valve cost extra”',
    amt: 'Amount',
    inc: 'Included',
    incV: 'Labour',
    exc: 'Not included',
    excV: 'New valve',
    him: 'Rafiq agreed',
    you: 'Tap to agree',
    confirm: 'Confirm booking',
  },
};

export default function BookingPage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const [tsel, setTsel] = useState(0);
  const [me, setMe] = useState(false);

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c4" extra="rr-screen">
        <header className="top">
          <span className="fx b bold">Rafiq Ahmed</span>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <div className="px col g12" aria-hidden="true" style={{ opacity: 0.9 }}>
          <div className="card" style={{ height: '90px' }} />
          <div className="card" style={{ height: '110px' }} />
        </div>

        <div className="scrim" />

        <section className="sheet col g12 rr-sheet" role="dialog" aria-modal="true" aria-labelledby="bk-h">
          <div className="grab" />
          <div className="row sb">
            <h1 id="bk-h" className="t">
              {t.h}
            </h1>
            <Link className="iconbtn" href="/customer/profile" aria-label={t.close}>
              <Icon name="i-x" cls="s24" />
            </Link>
          </div>

          <div className="col g8">
            <span className="l bold soft">{t.when}</span>
            <div className="row g8" role="radiogroup" aria-label={t.when}>
              {t.tm.map((x, i) => (
                <button
                  type="button"
                  key={x[0]}
                  className={`tm ${i === tsel ? 'on' : ''}`.trim()}
                  role="radio"
                  aria-checked={i === tsel}
                  onClick={() => setTsel(i)}
                >
                  <span>{x[0]}</span>
                  <span className="xs soft num">{x[1]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="row g12 card" style={{ padding: '10px', borderRadius: '16px' }}>
            <div className="map" style={{ width: '64px', height: '56px', borderRadius: '10px', flex: 'none' }} aria-hidden="true">
              <svg className="bg" viewBox="0 0 64 56">
                <path d="M0 20h64M24 0v56" stroke="var(--road)" strokeWidth="6" />
              </svg>
              <span className="me" style={{ left: '50%', top: '50%', width: '16px', height: '16px' }} />
            </div>
            <div className="col fx">
              <span className="l bold">{t.addr}</span>
              <span className="xs soft">{t.addr2}</span>
            </div>
            <button type="button" className="btn btn-o" style={{ minHeight: '44px', fontSize: '14px' }}>
              {t.change}
            </button>
          </div>

          <div className="card col g8" style={{ padding: '12px', borderRadius: '16px' }} aria-label={t.price}>
            <div className="row sb">
              <span className="l bold">{t.price}</span>
              <span className="ai">AI · demo</span>
            </div>
            <div className="vn" style={{ padding: '8px', borderRadius: '14px' }}>
              <button
                type="button"
                className="play"
                aria-label={t.play}
                style={{ width: '40px', height: '40px' }}
                onClick={() => speak(t.quote, lang)}
              >
                <Icon name="i-play" cls="s20" />
              </button>
              <span className="l fx">{t.quote}</span>
            </div>
            <table className="pa" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <td className="soft">{t.amt}</td>
                  <td className="bold num" dir="ltr" style={{ textAlign: 'end', fontSize: '20px' }}>
                    Rs 2,000
                  </td>
                </tr>
                <tr>
                  <td className="soft">{t.inc}</td>
                  <td className="bold" style={{ textAlign: 'end' }}>
                    {t.incV}
                  </td>
                </tr>
                <tr>
                  <td className="soft">{t.exc}</td>
                  <td className="bold" style={{ textAlign: 'end' }}>
                    {t.excV}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="row g8">
              <span className="party ok">
                <span className="tk">
                  <Icon name="i-chk" cls="s20" style={{ width: '14px', height: '14px' }} />
                </span>
                {t.him}
              </span>
              <button
                type="button"
                className={`party ${me ? 'ok' : ''}`.trim()}
                aria-pressed={me}
                onClick={() => setMe((v) => !v)}
              >
                <span className="tk">
                  {me && <Icon name="i-chk" style={{ width: '14px', height: '14px' }} />}
                </span>
                {t.you}
              </button>
            </div>
          </div>

          <Link className="btn btn-t" href="/customer/live" style={{ minHeight: '56px' }}>
            {t.confirm}
          </Link>
        </section>
      </Screen>
    </Stage>
  );
}
