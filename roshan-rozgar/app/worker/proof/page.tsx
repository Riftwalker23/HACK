'use client';

/** W5 · Proof photos 4/4 — `W5-Proof.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, SpeakBtn, rise } from '@/components/ui';

const D = {
  ur: {
    q: 'اپنے کام کی تصویر دکھائیں',
    vf: 'کیمرہ: بریکر بورڈ کی تصویر',
    b1: 'بریکر پینل',
    b2: 'صاف وائرنگ',
    p1: 'اے سی لگانا',
    p2: 'لائٹ فٹنگ',
    p3: 'وائرنگ',
    tags: 'ہر تصویر کا نام خود لگ گیا — یہ آپ کے ہنر بن گئے',
    hear: 'اپنا پروفائل سنیں',
    snap: 'تصویر لیں',
    pub: 'شائع کریں',
    hearS: 'سنیں',
    snapS: 'تصویر',
    pubS: 'شائع',
    read: 'یہ صفحہ سنیں',
  },
  rm: {
    q: 'Apne kaam ki tasveer dikhayein',
    vf: 'Camera: breaker board ki tasveer',
    b1: 'Breaker panel',
    b2: 'Saaf wiring',
    p1: 'AC lagana',
    p2: 'Light fitting',
    p3: 'Wiring',
    tags: 'Har tasveer ka naam khud lag gaya — yeh aap ke hunar ban gaye',
    hear: 'Apna profile sunein',
    snap: 'Tasveer lein',
    pub: 'Shaaye karein',
    hearS: 'Sunein',
    snapS: 'Tasveer',
    pubS: 'Shaaye',
    read: 'Yeh safha sunein',
  },
  en: {
    q: 'Show a photo of your work',
    vf: 'Camera: photo of a breaker board',
    b1: 'Breaker panel',
    b2: 'Neat wiring',
    p1: 'AC install',
    p2: 'Light fitting',
    p3: 'Wiring',
    tags: 'Each photo tagged itself — the tags became your skills',
    hear: 'Hear your profile',
    snap: 'Take photo',
    pub: 'Publish',
    hearS: 'Hear',
    snapS: 'Photo',
    pubS: 'Publish',
    read: 'Read this page aloud',
  },
};

export default function ProofPage() {
  const { lang } = useLang('ur');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w5" extra="rr-screen">
        <header className="top">
          <SpeakBtn label={t.read} say={t.q} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px">
          <div className="row sb">
            <h1 className="t nq">{t.q}</h1>
            <span className="ai">AI · demo</span>
          </div>

          <div className="vf" role="img" aria-label={t.vf}>
            <svg
              viewBox="0 0 358 300"
              width="100%"
              height="100%"
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0 }}
            >
              <rect width="358" height="300" fill="#232B3D" />
              <rect x="70" y="40" width="200" height="220" rx="10" fill="#C9CED6" stroke="#8D95A3" strokeWidth="3" />
              <rect x="88" y="62" width="164" height="70" rx="6" fill="#E9ECF0" />
              <g fill="#3A4256">
                <rect x="98" y="72" width="16" height="50" rx="3" />
                <rect x="122" y="72" width="16" height="50" rx="3" />
                <rect x="146" y="72" width="16" height="50" rx="3" />
                <rect x="170" y="72" width="16" height="50" rx="3" />
                <rect x="194" y="72" width="16" height="50" rx="3" />
                <rect x="218" y="72" width="24" height="50" rx="3" fill="#D7263D" />
              </g>
              <path d="M110 260v40M140 260v40M170 260v40M200 260v40" stroke="#F2B01E" strokeWidth="5" />
              <path d="M230 260v40" stroke="#2A6FD7" strokeWidth="5" />
              <path
                d="M14 14h28M14 14v28M344 14h-28M344 14v28M14 286h28M14 286v-28M344 286h-28M344 286v-28"
                stroke="#fff"
                strokeWidth="3"
                fill="none"
              />
            </svg>
            <div
              className="box rr-pop"
              style={{ left: '82px', top: '54px', width: '176px', height: '86px' }}
            >
              <span>{t.b1}</span>
            </div>
            <div
              className="box rr-pop"
              style={{
                left: '96px',
                top: '236px',
                width: '150px',
                height: '56px',
                animationDelay: '160ms',
              }}
            >
              <span>{t.b2}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
            <div className="th rr-rise">
              <svg viewBox="0 0 110 86" width="100%" height="100%" aria-hidden="true">
                <rect width="110" height="86" fill="#2E3A52" />
                <rect x="18" y="14" width="74" height="24" rx="5" fill="#DDE3EA" />
                <path d="M30 38v20M55 38v24M80 38v20" stroke="#2BB3C0" strokeWidth="4" />
              </svg>
              <span className="tg">{t.p1}</span>
            </div>
            <div className="th rr-rise" style={rise(1)}>
              <svg viewBox="0 0 110 86" width="100%" height="100%" aria-hidden="true">
                <rect width="110" height="86" fill="#3B3428" />
                <circle cx="55" cy="30" r="16" fill="#F2B01E" />
                <path d="M55 46v20" stroke="#E9ECF0" strokeWidth="4" />
              </svg>
              <span className="tg">{t.p2}</span>
            </div>
            <div className="th rr-rise" style={rise(2)}>
              <svg viewBox="0 0 110 86" width="100%" height="100%" aria-hidden="true">
                <rect width="110" height="86" fill="#2D3340" />
                <path
                  d="M10 20h40a10 10 0 0 1 10 10v20a10 10 0 0 0 10 10h30"
                  stroke="#F2B01E"
                  strokeWidth="5"
                  fill="none"
                />
                <path d="M10 34h30a10 10 0 0 1 10 10v20" stroke="#D7263D" strokeWidth="5" fill="none" />
              </svg>
              <span className="tg">{t.p3}</span>
            </div>
          </div>

          <p className="l soft">{t.tags}</p>
        </main>

        <div className="dock">
          <div className="row sb">
            <SpeakBtn
              label={t.hear}
              say={`${t.q}. ${t.p1}, ${t.p2}, ${t.p3}`}
              lang={lang}
              icon="i-play"
              iconCls="lg"
              style={{ width: '72px', height: '72px', borderRadius: '22px' }}
            />
            <button type="button" className="shutter" aria-label={t.snap}>
              <Icon name="i-cam" cls="lg" />
            </button>
            <Link
              className="iconbtn"
              href="/worker/home"
              aria-label={t.pub}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '22px',
                background: 'var(--accept)',
                borderColor: 'var(--accept)',
                color: '#fff',
              }}
            >
              <Icon name="i-up" cls="lg" />
            </Link>
          </div>
          <div className="row sb l bold" style={{ textAlign: 'center' }}>
            <span style={{ width: '88px' }}>{t.hearS}</span>
            <span style={{ width: '110px' }}>{t.snapS}</span>
            <span style={{ width: '88px' }}>{t.pubS}</span>
          </div>
        </div>
      </Screen>
    </Stage>
  );
}
