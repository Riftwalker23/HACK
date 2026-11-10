'use client';

/** C3 · Worker profile — `C3-Profile.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, Shape } from '@/components/ui';

const D = {
  ur: {
    id: 'شناختی کارڈ درج · ڈیمو',
    back: 'واپس',
    trade: 'پلمبر',
    free: 'فارغ',
    work: 'کام کی تصاویر',
    tagged: 'نام خود لگے',
    g1: 'گیزر',
    g2: 'پائپ لائن',
    g3: 'باتھ روم فٹنگ',
    trust: 'بھروسہ',
    jobs: '38 مکمل کام',
    last: 'آخری کام: 2 دن پہلے، آئی-10',
    from: '31 آراء سے',
    sum: 'وقت پر آتے ہیں، کام صاف، اور قیمت پہلے بتا دیتے ہیں۔ گیزر لیک میں خاص مہارت۔',
    band: 'قیمت کا اندازہ',
    call: 'کال کریں',
    req: 'بلائیں',
  },
  rm: {
    id: 'ID card darj · demo',
    back: 'Wapas',
    trade: 'Plumber',
    free: 'Faarigh',
    work: 'Kaam ki tasaveer',
    tagged: 'naam khud lage',
    g1: 'Geyser',
    g2: 'Pipe line',
    g3: 'Bathroom fitting',
    trust: 'Bharosa',
    jobs: '38 mukammal kaam',
    last: 'Aakhri kaam: 2 din pehle, I-10',
    from: '31 aara se',
    sum: 'Waqt par aate hain, kaam saaf, aur qeemat pehle bata dete hain. Geyser leak mein khaas maharat.',
    band: 'Qeemat ka andaza',
    call: 'Call karein',
    req: 'Bulayein',
  },
  en: {
    id: 'ID on file · demo',
    back: 'Back',
    trade: 'Plumber',
    free: 'Available',
    work: 'Past work',
    tagged: 'auto-tagged',
    g1: 'Geyser',
    g2: 'Pipe line',
    g3: 'Bathroom fitting',
    trust: 'Trust',
    jobs: '38 jobs completed',
    last: 'Last job: 2 days ago, I-10',
    from: 'from 31 reviews',
    sum: 'Arrives on time, leaves the work clean, and states the price before starting. Especially strong on geyser leaks.',
    band: 'Typical price',
    call: 'Call Rafiq',
    req: 'Request Rafiq',
  },
};

export default function ProfilePage() {
  const { lang } = useLang('en');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c3" extra="rr-screen">
        <header className="top">
          <Link className="iconbtn" href="/customer/results" aria-label={t.back}>
            <Icon name="i-back" cls="s24 flip" />
          </Link>
          <span className="fx" />
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <main className="col g12 fx px" style={{ paddingBottom: '96px', overflow: 'hidden' }}>
          <section className="card col" style={{ overflow: 'hidden', padding: 0 }}>
            <div className="truck" />
            <div className="row g12" style={{ padding: '14px' }}>
              <span
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '20px',
                  background: 'var(--ttint)',
                  display: 'grid',
                  placeItems: 'center',
                  font: "800 24px/1 'Plus Jakarta Sans', sans-serif",
                  flex: 'none',
                }}
              >
                RA
              </span>
              <div className="col g4 fx">
                <h1 className="t" style={{ fontSize: '22px' }}>
                  Rafiq Ahmed
                </h1>
                <div className="row g8 wrap">
                  <span className="chip sm tr-plum" style={{ borderColor: 'var(--c)' }}>
                    <span className="gl" style={{ width: '22px', height: '22px' }}>
                      <Glyph name="g-plum" />
                    </span>
                    {t.trade}
                  </span>
                  <span className="pill" style={{ height: '32px', fontSize: '13px' }}>
                    <span className="dot">
                      <Shape name="s-free" />
                    </span>
                    {t.free}
                  </span>
                  <span className="chip sm" style={{ borderStyle: 'dashed' }}>
                    {t.id}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="col g8">
            <div className="row sb">
              <h2 className="l bold">{t.work}</h2>
              <span className="ai">AI · {t.tagged}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
              <div className="gp rr-rise" role="img" aria-label={t.g1}>
                <svg viewBox="0 0 110 96" width="100%" height="100%" aria-hidden="true">
                  <rect width="110" height="96" fill="#3B4A5E" />
                  <rect x="38" y="10" width="34" height="56" rx="14" fill="#E9ECF0" />
                  <path d="M48 66v20M62 66v20" stroke="#8D95A3" strokeWidth="4" />
                </svg>
                <span>{t.g1}</span>
              </div>
              <div className="gp rr-rise" role="img" aria-label={t.g2} style={{ ['--i' as string]: 1 }}>
                <svg viewBox="0 0 110 96" width="100%" height="100%" aria-hidden="true">
                  <rect width="110" height="96" fill="#2E3D4F" />
                  <path d="M0 50h40a10 10 0 0 1 10 10v36M110 30H70a10 10 0 0 0-10 10v10" stroke="#B7C0CC" strokeWidth="8" fill="none" />
                </svg>
                <span>{t.g2}</span>
              </div>
              <div className="gp rr-rise" role="img" aria-label={t.g3} style={{ ['--i' as string]: 2 }}>
                <svg viewBox="0 0 110 96" width="100%" height="100%" aria-hidden="true">
                  <rect width="110" height="96" fill="#44505F" />
                  <rect x="20" y="30" width="70" height="40" rx="18" fill="#F4F4F2" />
                  <circle cx="55" cy="22" r="8" fill="#2A6FD7" />
                </svg>
                <span>{t.g3}</span>
              </div>
            </div>
          </section>

          <section className="card col g8" style={{ padding: '14px' }} aria-label={t.trust}>
            <div className="row g12">
              <span className="t num" dir="ltr">
                4.8
              </span>
              <div className="col">
                <span className="stars" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon key={i} name="i-star" cls="s20" />
                  ))}
                </span>
                <span className="l soft">{t.jobs}</span>
              </div>
            </div>
            <span className="row g4 l soft">
              <Icon name="i-clock" cls="s20" />
              {t.last}
            </span>
            <p className="sumry">
              <span className="ai" style={{ marginInlineEnd: '6px' }}>
                AI · {t.from}
              </span>
              {t.sum}
            </p>
          </section>
        </main>

        <div className="bar">
          <div className="col fx">
            <span className="xs soft">{t.band}</span>
            <span className="b bold num" dir="ltr" style={{ textAlign: 'start' }}>
              Rs 1,500–2,500
            </span>
          </div>
          <button type="button" className="btn btn-o" aria-label={t.call} style={{ width: '48px', padding: 0 }}>
            <Icon name="i-phone" cls="s24" />
          </button>
          <Link className="btn btn-t" href="/customer/booking">
            {t.req}
          </Link>
        </div>
      </Screen>
    </Stage>
  );
}
