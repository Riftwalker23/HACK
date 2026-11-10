'use client';

/** W2 · Voice onboarding 1/4 — `W2-Voice.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, SpeakBtn } from '@/components/ui';

const D = {
  ur: {
    q: 'آپ کیا کام کرتے ہیں؟',
    heard: 'آپ نے کہا',
    said: '“میں بجلی کا کام کرتا ہوں، پندرہ سال سے، راولپنڈی میں…”',
    filling: 'خود بخود بھر رہا ہے',
    f1: 'بجلی والا',
    f2: '15 سال',
    listening: 'سن رہے ہیں…',
    type: 'لکھ کر بتائیں',
    next: 'ٹھیک ہے، آگے',
    again: 'سوال دوبارہ سنیں',
    step: 'مرحلہ 1 از 4',
    read: 'یہ صفحہ سنیں',
  },
  rm: {
    q: 'Aap kya kaam karte hain?',
    heard: 'Aap ne kaha',
    said: '“Main bijli ka kaam karta hoon, pandrah saal se, Rawalpindi mein…”',
    filling: 'Khud ba khud bhar raha hai',
    f1: 'Bijli waala',
    f2: '15 saal',
    listening: 'Sun rahe hain…',
    type: 'Likh kar batayein',
    next: 'Theek hai, aage',
    again: 'Sawal dobara sunein',
    step: 'Marhala 1 az 4',
    read: 'Yeh safha sunein',
  },
  en: {
    q: 'What work do you do?',
    heard: 'You said',
    said: '“I do electrical work, for fifteen years, in Rawalpindi…”',
    filling: 'Filling in by itself',
    f1: 'Electrician',
    f2: '15 years',
    listening: 'Listening…',
    type: 'Type instead',
    next: 'OK, next',
    again: 'Hear the question again',
    step: 'Step 1 of 4',
    read: 'Read this page aloud',
  },
};

export default function VoicePage() {
  const { lang } = useLang('ur');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w2" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={t.q} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g16 fx px">
          <div className="rail" role="img" aria-label={t.step}>
            <span className="n cur">
              <Icon name="i-tools" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-clock" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-pin" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-cam" cls="s20" />
            </span>
          </div>

          <section
            className="card col g12"
            style={{ padding: '20px', background: 'var(--tint)', borderColor: 'var(--roshan)' }}
          >
            <div className="row g12">
              <SpeakBtn
                label={t.again}
                say={t.q}
                lang={lang}
                icon="i-replay"
                style={{ borderColor: 'var(--roshan)', background: 'var(--surface)' }}
              />
              <h1 className="t nq fx">{t.q}</h1>
            </div>
          </section>

          <section className="col g8" aria-live="polite">
            <div className="row sb">
              <span className="l soft">{t.heard}</span>
              <span className="ai">AI · demo</span>
            </div>
            <p className="b bold" style={{ minHeight: '90px' }}>
              {t.said}
              <span
                className="rr-caret"
                style={{
                  display: 'inline-block',
                  width: '3px',
                  height: '1.1em',
                  background: 'var(--roshan)',
                  verticalAlign: 'middle',
                  marginInlineStart: '4px',
                }}
              />
            </p>
          </section>

          <section className="col g8">
            <span className="l soft">{t.filling}</span>
            <div className="row g8 wrap">
              <span className="chip tr-elec rr-rise" style={{ borderColor: 'var(--c)' }}>
                <span className="gl s32">
                  <Icon name="i-chk" cls="s20" />
                </span>
                {t.f1}
              </span>
              <span
                className="chip rr-rise"
                style={{ borderColor: 'var(--accept)', ['--i' as string]: 1 }}
              >
                <Icon name="i-clock" cls="s24" style={{ color: 'var(--accept)' }} />
                {t.f2}
              </span>
              <span
                className="chip rr-rise"
                style={{ borderStyle: 'dashed', color: 'var(--soft)', ['--i' as string]: 2 }}
              >
                <Icon name="i-pin" cls="s24" />…
              </span>
            </div>
          </section>
        </main>

        <div className="dock" style={{ alignItems: 'center', gap: '14px' }}>
          <div className="wave" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <button type="button" className="iconbtn" aria-label={t.type}>
              <Icon name="i-kb" />
            </button>
            <div className="orb">
              <button className="mic" aria-label={t.listening} aria-pressed="true">
                <Icon name="i-mic" cls="lg" />
              </button>
            </div>
            <Link
              className="iconbtn"
              href="/worker/trade"
              aria-label={t.next}
              style={{ background: 'var(--accept)', borderColor: 'var(--accept)', color: '#fff' }}
            >
              <Icon name="i-chk" />
            </Link>
          </div>
          <span className="l bold rt">{t.listening}</span>
        </div>
      </Screen>
    </Stage>
  );
}
