'use client';

/** W9 · Job complete — `W9-Done.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, SpeakBtn } from '@/components/ui';

const D = {
  ur: {
    done: 'کام مکمل',
    cash: 'نقد ملے',
    cust: 'گاہک',
    custV: 'عائشہ، جی-11',
    job: 'کام',
    jobV: 'ساکٹ بدلا',
    time: 'وقت',
    timeV: '45 منٹ',
    trust: 'آپ کی ساکھ',
    jobs: '39 مکمل کام',
    home: 'گھر',
    read: 'یہ صفحہ سنیں',
  },
  rm: {
    done: 'Kaam mukammal',
    cash: 'Naqd mile',
    cust: 'Gahak',
    custV: 'Ayesha, G-11',
    job: 'Kaam',
    jobV: 'Socket badla',
    time: 'Waqt',
    timeV: '45 minute',
    trust: 'Aap ki saakh',
    jobs: '39 mukammal kaam',
    home: 'Ghar',
    read: 'Yeh safha sunein',
  },
  en: {
    done: 'Job complete',
    cash: 'Paid in cash',
    cust: 'Customer',
    custV: 'Ayesha, G-11',
    job: 'Work',
    jobV: 'Socket replaced',
    time: 'Time',
    timeV: '45 min',
    trust: 'Your reputation',
    jobs: '39 jobs completed',
    home: 'Home',
    read: 'Read this page aloud',
  },
};

export default function DonePage() {
  const { lang } = useLang('ur');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w9" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={`${t.done}. Rs 2,500 — ${t.cash}`} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g16 fx px">
          <section className="card col" style={{ overflow: 'hidden', padding: 0 }}>
            <div className="truck" />
            <div className="col g12" style={{ padding: '20px', alignItems: 'center', textAlign: 'center' }}>
              <span className="gl s88" style={{ ['--c' as string]: 'var(--accept)', ['--g' as string]: '#fff' }}>
                {/* the tick draws itself in rather than appearing */}
                <svg className="ic xl" viewBox="0 0 24 24">
                  <path className="rr-draw" d="M4 12.5l5 5L20 6.5" />
                </svg>
              </span>
              <h1 className="t nq">{t.done}</h1>
              <span className="d num" dir="ltr" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Rs 2,500
              </span>
              <span className="l soft">{t.cash}</span>
            </div>
            <table
              className="rc"
              style={{ borderCollapse: 'collapse', margin: '0 20px 16px', width: 'calc(100% - 40px)' }}
            >
              <tbody>
                <tr>
                  <td className="soft">{t.cust}</td>
                  <td className="bold" style={{ textAlign: 'end' }}>
                    {t.custV}
                  </td>
                </tr>
                <tr>
                  <td className="soft">{t.job}</td>
                  <td className="bold" style={{ textAlign: 'end' }}>
                    {t.jobV}
                  </td>
                </tr>
                <tr>
                  <td className="soft">{t.time}</td>
                  <td className="bold num" style={{ textAlign: 'end' }}>
                    {t.timeV}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="truck" />
          </section>

          <section className="col g8" aria-live="polite">
            <div className="row sb">
              <span className="b bold">{t.trust}</span>
              <span className="row g4 l bold rt">
                <Icon name="i-star" cls="s24" style={{ fill: 'var(--star)', color: '#8A6200' }} />
                +12
              </span>
            </div>
            <div
              className="ribbon"
              role="progressbar"
              aria-valuenow={74}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t.trust}
            >
              <i />
            </div>
            <span className="l soft">{t.jobs}</span>
          </section>
        </main>

        <div className="dock">
          <Link className="btn btn-p big" href="/worker/home">
            <Icon name="i-house" cls="lg" />
            {t.home}
          </Link>
        </div>
      </Screen>
    </Stage>
  );
}
