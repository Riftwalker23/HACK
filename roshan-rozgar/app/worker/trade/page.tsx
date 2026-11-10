'use client';

/** W3 · Confirm trade 2/4 — `W3-Trade.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, SpeakBtn, rise } from '@/components/ui';
import { speak } from '@/lib/speech';

const N = {
  ur: { elec: 'بجلی والا', plum: 'پلمبر', ac: 'اے سی والا', carp: 'بڑھئی', mech: 'مستری', paint: 'پینٹر', mason: 'راج مستری' },
  rm: { elec: 'Bijli waala', plum: 'Plumber', ac: 'AC waala', carp: 'Barhai', mech: 'Mistri', paint: 'Painter', mason: 'Raj mistri' },
  en: { elec: 'Electrician', plum: 'Plumber', ac: 'AC technician', carp: 'Carpenter', mech: 'Mechanic', paint: 'Painter', mason: 'Mason' },
};

const D = {
  ur: {
    q: 'کیا آپ بجلی والے ہیں؟',
    guess: 'ہم نے یہ سنا',
    yes: 'ہاں، یہی ہے',
    other: 'کچھ اور؟ بولیں',
    sayIt: 'کوئی اور کام بول کر بتائیں',
    step: 'مرحلہ 2 از 4',
    read: 'یہ صفحہ سنیں',
    hear: 'سنیں',
  },
  rm: {
    q: 'Kya aap bijli waale hain?',
    guess: 'humne yeh suna',
    yes: 'Haan, yahi hai',
    other: 'Kuch aur? Bolein',
    sayIt: 'Koi aur kaam bol kar batayein',
    step: 'Marhala 2 az 4',
    read: 'Yeh safha sunein',
    hear: 'Sunein',
  },
  en: {
    q: 'Are you an electrician?',
    guess: 'we heard this',
    yes: 'Yes, that’s me',
    other: 'Something else? Say it',
    sayIt: 'Say another trade',
    step: 'Step 2 of 4',
    read: 'Read this page aloud',
    hear: 'Hear',
  },
};

const IDS = ['elec', 'plum', 'ac', 'carp', 'mech', 'paint', 'mason'] as const;

export default function TradePage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const names = N[lang];
  const [sel, setSel] = useState<string>('elec');

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w3" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={t.q} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px">
          <div className="rail sm" role="img" aria-label={t.step}>
            <span className="n done">
              <Icon name="i-chk" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n cur">
              <Icon name="i-tools" cls="s20" />
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

          <div className="row sb g8">
            <h1 className="t nq">{t.q}</h1>
            <span className="ai">AI · {t.guess}</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '12px',
              flex: 1,
            }}
          >
            {IDS.map((id, i) => {
              const on = id === sel;
              return (
                <div
                  key={id}
                  className={`tile tr-${id} ${on ? 'sel' : ''} rr-rise`.trim()}
                  style={rise(i)}
                >
                  <button
                    type="button"
                    className="tm"
                    aria-pressed={on}
                    onClick={() => setSel(id)}
                  >
                    <span className={`gl s56${on ? ' rr-spring' : ''}`}>
                      <Glyph name={`g-${id}`} />
                    </span>
                    <span className="l bold">{names[id]}</span>
                  </button>
                  {on && (
                    <span className="tick rr-pop" aria-hidden="true">
                      <Icon name="i-chk" cls="s20" />
                    </span>
                  )}
                  <button
                    type="button"
                    className="spk"
                    aria-label={`${t.hear}: ${names[id]}`}
                    onClick={() => speak(names[id], lang)}
                  >
                    <Icon name="i-spk" cls="s24" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              className="tile rr-rise"
              aria-label={t.sayIt}
              style={{
                borderRadius: 'var(--r-lg)',
                border: '3px dashed var(--line)',
                background: 'transparent',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'var(--soft)',
                ['--i' as string]: IDS.length,
              }}
            >
              <Icon name="i-mic" cls="lg" />
              <span className="l">{t.other}</span>
            </button>
          </div>
        </main>

        <div className="dock">
          <Link className="btn btn-ok big" href="/worker/skills">
            <Icon name="i-chk" cls="lg" />
            {t.yes}
          </Link>
        </div>
      </Screen>
    </Stage>
  );
}
