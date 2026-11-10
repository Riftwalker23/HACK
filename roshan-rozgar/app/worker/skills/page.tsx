'use client';

/** W4 · Skills 3/4 — `W4-Skills.dc.html` on the canvas. */

import Link from 'next/link';
import { useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, SpeakBtn, rise } from '@/components/ui';

const D = {
  ur: {
    years: 'سال',
    title: 'آپ کے ہنر',
    from: 'آپ کی باتوں سے',
    q1: '“گھر کی ',
    m1: 'وائرنگ',
    q2: '، پنکھے، اور ',
    m2: 'بریکر بورڈ',
    q3: ' کا کام کرتا ہوں…”',
    more: 'اور بتائیں',
    ok: 'ٹھیک ہے',
    rm: 'ہٹائیں',
    step: 'مرحلہ 3 از 4',
    read: 'یہ صفحہ سنیں',
    s: ['گھر کی وائرنگ', 'پنکھا لگانا', 'بریکر بورڈ', 'گیزر (بجلی)', 'لائٹ فٹنگ', 'یو پی ایس'],
  },
  rm: {
    years: 'saal',
    title: 'Aap ke hunar',
    from: 'aap ki baaton se',
    q1: '“Ghar ki ',
    m1: 'wiring',
    q2: ', pankhay, aur ',
    m2: 'breaker board',
    q3: ' ka kaam karta hoon…”',
    more: 'Aur batayein',
    ok: 'Theek hai',
    rm: 'Hatayein',
    step: 'Marhala 3 az 4',
    read: 'Yeh safha sunein',
    s: ['Ghar ki wiring', 'Pankha lagana', 'Breaker board', 'Geyser (bijli)', 'Light fitting', 'UPS'],
  },
  en: {
    years: 'years',
    title: 'Your skills',
    from: 'from your own words',
    q1: '“I do house ',
    m1: 'wiring',
    q2: ', fans, and ',
    m2: 'breaker boards',
    q3: '…”',
    more: 'Tell more',
    ok: 'Looks right',
    rm: 'Remove',
    step: 'Step 3 of 4',
    read: 'Read this page aloud',
    s: ['House wiring', 'Fan fitting', 'Breaker board', 'Electric geyser', 'Light fitting', 'UPS install'],
  },
};

const ICS = ['wire', 'fan', 'panel', 'geyser', 'bulb', 'batt'];

export default function SkillsPage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const [gone, setGone] = useState<string[]>([]);

  const skills = ICS.map((ic, i) => ({ ic, name: t.s[i] })).filter((s) => !gone.includes(s.ic));

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w4" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={`${t.title}. ${t.s.join(', ')}`} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px">
          <div className="rail sm" role="img" aria-label={t.step}>
            <span className="n done">
              <Icon name="i-chk" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n done">
              <Icon name="i-chk" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n cur">
              <Icon name="i-tools" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-cam" cls="s20" />
            </span>
          </div>

          <div className="row g12">
            <div
              className="col ctr"
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '24px',
                background: 'var(--roshan)',
                color: '#0B1020',
                flex: 'none',
              }}
            >
              <span className="d num" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                15
              </span>
              <span className="l bold">{t.years}</span>
            </div>
            <div className="col g4 fx">
              <h1 className="t nq">{t.title}</h1>
              <div className="row g8">
                <span className="ai">AI · demo</span>
                <span className="l soft">{t.from}</span>
              </div>
            </div>
          </div>

          <p className="l card" style={{ padding: '12px 14px', borderRadius: '16px' }}>
            {t.q1}
            <mark>{t.m1}</mark>
            {t.q2}
            <mark>{t.m2}</mark>
            {t.q3}
          </p>

          <ul className="col g8" aria-label={t.title}>
            {skills.map((s, i) => (
              <li className="sk rr-rise" key={s.ic} style={rise(i)}>
                <span className="gl s40 tr-elec">
                  <Icon name={`i-${s.ic}`} cls="s24" />
                </span>
                <span className="b bold fx">{s.name}</span>
                <button
                  type="button"
                  className="x"
                  aria-label={`${t.rm}: ${s.name}`}
                  onClick={() => setGone((g) => [...g, s.ic])}
                >
                  <Icon name="i-x" cls="s24" />
                </button>
              </li>
            ))}
          </ul>
        </main>

        <div className="dock">
          <div className="row g12">
            <button type="button" className="btn btn-o fx" style={{ minHeight: '72px' }}>
              <Icon name="i-mic" style={{ color: 'var(--roshan-text)' }} />
              {t.more}
            </button>
            <Link className="btn btn-ok fx" href="/worker/proof" style={{ minHeight: '72px' }}>
              <Icon name="i-chk" />
              {t.ok}
            </Link>
          </div>
        </div>
      </Screen>
    </Stage>
  );
}
