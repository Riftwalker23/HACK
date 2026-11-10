'use client';

/** W1 · Role choice — `Main.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, SpeakBtn } from '@/components/ui';

const D = {
  ur: {
    hello: 'السلام علیکم! آپ کون ہیں؟',
    worker: 'میں کام کرتا ہوں',
    cust: 'مجھے کام کرانا ہے',
    tag: 'ہنر کو روزگار سے ملائیں',
    read: 'یہ صفحہ سنیں',
    hearW: 'سنیں: میں کام کرتا ہوں',
    hearC: 'سنیں: مجھے کام کرانا ہے',
  },
  rm: {
    hello: 'Assalam-o-Alaikum! Aap kaun hain?',
    worker: 'Main kaam karta hoon',
    cust: 'Mujhe kaam karana hai',
    tag: 'Hunar ko rozgar se milayein',
    read: 'Yeh safha sunein',
    hearW: 'Sunein: Main kaam karta hoon',
    hearC: 'Sunein: Mujhe kaam karana hai',
  },
  en: {
    hello: 'Assalam-o-Alaikum! Who are you?',
    worker: 'I do work',
    cust: 'I need work done',
    tag: 'Connecting skill with work',
    read: 'Read this page aloud',
    hearW: 'Hear: I do work',
    hearC: 'Hear: I need work done',
  },
};

export default function RolePage() {
  const { lang } = useLang('ur');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-main" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={t.hello} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g16 fx px" style={{ paddingBottom: '20px' }}>
          <div className="lockup col">
            <div className="truck" />
            <div className="row g12" style={{ padding: '10px 16px' }}>
              <div className="gl s56" style={{ ['--c' as string]: 'var(--roshan)', ['--g' as string]: '#0B1020' }}>
                <Icon name="i-lamp" style={{ width: '32px', height: '32px' }} />
              </div>
              <div className="col" dir="ltr" style={{ alignItems: 'flex-start' }}>
                <div className="wm" lang="ur">
                  روشن روزگار
                </div>
                <div className="wl soft">ROSHAN ROZGAR</div>
              </div>
            </div>
            <div className="truck" />
          </div>

          <div
            className="jhalar"
            aria-hidden="true"
            style={{ marginTop: '-18px', marginInline: '14px' }}
          />
          <h1 className="b bold nq" style={{ textAlign: 'center', marginTop: '-6px' }}>
            {t.hello}
          </h1>

          <div className="role rw">
            <div className="row sb">
              <div className="row" style={{ gap: 0 }}>
                <span className="gl s72 tr-elec" style={{ border: '4px solid #0B1020' }}>
                  <Glyph name="g-elec" />
                </span>
                <span
                  className="gl s72 tr-plum"
                  style={{ border: '4px solid #0B1020', marginInlineStart: '-14px' }}
                >
                  <Glyph name="g-plum" />
                </span>
                <span
                  className="gl s72 tr-ac"
                  style={{ border: '4px solid #0B1020', marginInlineStart: '-14px' }}
                >
                  <Glyph name="g-ac" />
                </span>
              </div>
              <SpeakBtn label={t.hearW} say={t.worker} lang={lang} cls="spk" />
            </div>
            <Link className="go" href="/worker/voice">
              <span className="t nq">{t.worker}</span>
              <span className="arrow">
                <Icon name="i-chev" cls="flip" />
              </span>
            </Link>
          </div>

          <div className="role rc">
            <div className="row sb">
              <div className="disc">
                <Icon name="i-house" cls="xl" />
              </div>
              <SpeakBtn label={t.hearC} say={t.cust} lang={lang} cls="spk" />
            </div>
            <Link className="go" href="/customer/describe">
              <span className="t nq">{t.cust}</span>
              <span className="arrow">
                <Icon name="i-chev" cls="flip" />
              </span>
            </Link>
          </div>
        </main>
      </Screen>
    </Stage>
  );
}
