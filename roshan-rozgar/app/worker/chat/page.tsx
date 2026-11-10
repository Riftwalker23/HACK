'use client';

/** W8 · Job chat + price — `W8-Chat.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, SpeakBtn } from '@/components/ui';
import { speak } from '@/lib/speech';

const D = {
  ur: {
    who: 'عائشہ · جی-11 اسلام آباد',
    translate: 'ترجمہ',
    play: 'وائس نوٹ سنیں',
    see: 'دیکھیں',
    cMsg: '“ساکٹ سے دھواں نکلا تھا، اب بجلی بند ہے۔ کب تک آ سکتے ہیں؟”',
    price: 'طے شدہ قیمت',
    quote: 'آپ نے کہا: “ڈھائی ہزار، سامان الگ”',
    amt: 'رقم',
    inc: 'شامل',
    incV: 'مزدوری',
    exc: 'شامل نہیں',
    excV: 'نیا ساکٹ',
    agree: 'یہی قیمت ٹھیک ہے',
    type: 'لکھ کر بھیجیں',
    speak: 'بول کر بھیجیں',
    read: 'یہ صفحہ سنیں',
  },
  rm: {
    who: 'Ayesha · G-11 Islamabad',
    translate: 'tarjuma',
    play: 'Voice note sunein',
    see: 'Dekhein',
    cMsg: '“Socket se dhuan nikla tha, ab bijli band hai. Kab tak aa sakte hain?”',
    price: 'Tay shuda qeemat',
    quote: 'Aap ne kaha: “Dhai hazaar, saamaan alag”',
    amt: 'Raqam',
    inc: 'Shaamil',
    incV: 'Mazdoori',
    exc: 'Shaamil nahi',
    excV: 'Naya socket',
    agree: 'Yahi qeemat theek hai',
    type: 'Likh kar bhejein',
    speak: 'Bol kar bhejein',
    read: 'Yeh safha sunein',
  },
  en: {
    who: 'Ayesha · G-11 Islamabad',
    translate: 'translated',
    play: 'Play voice note',
    see: 'See it',
    cMsg: '“Smoke came out of the socket, now the power is off. How soon can you come?”',
    price: 'Agreed price',
    quote: 'You said: “Two and a half thousand, parts extra”',
    amt: 'Amount',
    inc: 'Included',
    incV: 'Labour',
    exc: 'Not included',
    excV: 'New socket',
    agree: 'This price is right',
    type: 'Type a message',
    speak: 'Speak a message',
    read: 'Read this page aloud',
  },
};

export default function ChatPage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const [open, setOpen] = useState(true);

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w8" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={`${t.who}. ${t.cMsg}`} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <div className="row g12 px" style={{ paddingBottom: '10px', borderBottom: '2px solid var(--line)' }}>
          <span
            className="gl s40"
            style={{
              ['--c' as string]: 'var(--teal)',
              ['--g' as string]: 'var(--on-teal)',
              fontWeight: 800,
              fontSize: '16px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            A
          </span>
          <h1 className="b bold fx">{t.who}</h1>
          <span className="ai">AI · {t.translate}</span>
        </div>

        <main className="col g12 fx px" style={{ paddingTop: '12px' }} aria-live="polite">
          <div className="col g8" style={{ maxWidth: '320px' }}>
            <div className="vn rr-rise">
              <button type="button" className="play" aria-label={t.play} onClick={() => speak(t.cMsg, lang)}>
                <Icon name="i-play" cls="s24" />
              </button>
              <div className="wv" aria-hidden="true">
                {Array.from({ length: 18 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <span className="l num">0:12</span>
            </div>
            <button
              type="button"
              className="see"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name="i-eye" cls="s20" />
              {t.see}
            </button>
            {open && <p className="tr rr-pop">{t.cMsg}</p>}
          </div>

          <div className="vn me-b rr-rise" style={{ maxWidth: '300px', ['--i' as string]: 1 }}>
            <button type="button" className="play" aria-label={t.play} onClick={() => speak(t.quote, lang)}>
              <Icon name="i-play" cls="s24" />
            </button>
            <div className="wv" aria-hidden="true">
              {Array.from({ length: 15 }, (_, i) => (
                <i key={i} />
              ))}
            </div>
            <span className="l num">0:08</span>
          </div>

          <section
            className="card col g8 rr-pop"
            style={{ padding: '14px 16px', borderColor: 'var(--roshan)' }}
            aria-label={t.price}
          >
            <div className="row sb">
              <span className="row g8 b bold">
                <Icon name="i-coin" style={{ color: 'var(--roshan-text)' }} />
                {t.price}
              </span>
              <span className="ai">AI</span>
            </div>
            <p className="l soft">{t.quote}</p>
            <table className="pa" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <td className="soft">{t.amt}</td>
                  <td className="bold num" dir="ltr" style={{ textAlign: 'end', fontSize: '24px' }}>
                    Rs 2,500
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
          </section>
        </main>

        <div className="dock">
          <Link className="btn btn-ok" href="/worker/done" style={{ minHeight: '72px' }}>
            <Icon name="i-chk" />
            {t.agree}
          </Link>
          <div className="row" style={{ justifyContent: 'center', gap: '24px' }}>
            <button type="button" className="iconbtn" aria-label={t.type}>
              <Icon name="i-kb" />
            </button>
            <div className="orb">
              <button className="mic" aria-label={t.speak}>
                <Icon name="i-mic" cls="lg" />
              </button>
            </div>
            <span style={{ width: '56px' }} />
          </div>
        </div>
      </Screen>
    </Stage>
  );
}
