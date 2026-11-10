'use client';

/** C7 · Empty / error states — `C7-States.dc.html` on the canvas. */

import Link from 'next/link';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, rise } from '@/components/ui';

const D = {
  ur: {
    h: 'خالی اور خرابی کی حالتیں',
    k1: 'کوئی نتیجہ نہیں',
    m1: '3 کلومیٹر میں ابھی کوئی پلمبر فارغ نہیں۔',
    a1: '6 کلومیٹر تک دیکھیں',
    k2: 'انٹرنیٹ نہیں',
    m2: 'انٹرنیٹ نہیں مل رہا۔ آپ کی درخواست محفوظ ہے۔',
    saved: 'آپ کے فون میں محفوظ',
    a2: 'دوبارہ کوشش کریں',
    k3: 'کوئی کام نہیں',
    m3: 'آج ابھی کوئی کام نہیں آیا۔',
    a3: 'فارغ ہوں، بتائیں',
  },
  rm: {
    h: 'Khaali aur kharabi ki haalatein',
    k1: 'Koi nateeja nahi',
    m1: '3 km mein abhi koi plumber faarigh nahi.',
    a1: '6 km tak dekhein',
    k2: 'Internet nahi',
    m2: 'Internet nahi mil raha. Aap ki darkhwast mehfooz hai.',
    saved: 'Aap ke phone mein mehfooz',
    a2: 'Dobara koshish karein',
    k3: 'Koi kaam nahi',
    m3: 'Aaj abhi koi kaam nahi aaya.',
    a3: 'Faarigh hoon, batayein',
  },
  en: {
    h: 'Empty & error states',
    k1: 'Zero results',
    m1: 'No plumber is free within 3 km right now.',
    a1: 'Search up to 6 km',
    k2: 'Offline',
    m2: 'No internet. Your request is saved and will send itself.',
    saved: 'Saved on your phone',
    a2: 'Try again',
    k3: 'Empty list (worker)',
    m3: 'No jobs yet today.',
    a3: 'Tell them I’m free',
  },
};

export default function StatesPage() {
  const { lang } = useLang('en');
  const t = D[lang];

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c7" extra="rr-screen">
        <header className="top">
          <h1 className="b bold fx">{t.h}</h1>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <main className="col g12 fx px" style={{ paddingBottom: '16px' }}>
          <section className="es rr-rise">
            <span className="tg">{t.k1}</span>
            <span className="ill" style={{ background: 'var(--ttint)', color: 'var(--teal-deep)' }}>
              <Icon name="i-nores" cls="xl" style={{ color: 'var(--teal)' }} />
            </span>
            <p className="b bold">{t.m1}</p>
            <Link className="btn btn-t" href="/customer/results" style={{ minHeight: '44px' }}>
              {t.a1}
            </Link>
          </section>

          <section className="es rr-rise" role="alert" style={rise(1)}>
            <span className="tg">{t.k2}</span>
            <span
              className="ill"
              style={{ background: 'color-mix(in srgb, var(--busy) 14%, var(--surface))' }}
            >
              <Icon name="i-wifi" cls="xl" style={{ color: 'var(--busy)' }} />
            </span>
            <p className="b bold">{t.m2}</p>
            <span className="row g4 xs soft">
              <Icon name="i-mobile" cls="s20" />
              {t.saved}
            </span>
            <button type="button" className="btn btn-o" style={{ minHeight: '44px' }}>
              {t.a2}
            </button>
          </section>

          <section className="es rr-rise" style={rise(2)}>
            <span className="tg">{t.k3}</span>
            <span className="ill" style={{ background: 'var(--tint)' }}>
              <Icon name="i-inbox" cls="xl" style={{ color: 'var(--roshan-text)' }} />
            </span>
            <p className="b bold">{t.m3}</p>
            <Link className="btn btn-p" href="/worker/home" style={{ minHeight: '44px', borderRadius: '16px' }}>
              {t.a3}
            </Link>
          </section>
        </main>
      </Screen>
    </Stage>
  );
}
