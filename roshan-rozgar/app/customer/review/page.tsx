'use client';

/** C6 · Review — `C6-Review.dc.html` on the canvas. */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { api } from '@/lib/client-api';

const D = {
  ur: {
    h: 'رفیق کا کام کیسا رہا؟',
    sub: 'گیزر والو · آج',
    rate: 'ستارے',
    star: 'ستارے',
    speak: 'اپنی رائے بولیں',
    aiNote: 'آپ کی بات کا خلاصہ',
    said: '“وقت پر آئے، والو بدلا اور فرش بھی صاف کر کے گئے۔ قیمت وہی لی جو طے تھی۔”',
    tagsH: 'ٹیگ لگائیں',
    tags: { clock: 'وقت پر', spark: 'صاف کام', coin: 'مناسب قیمت', smile: 'اچھا رویہ' },
    send: 'رائے بھیجیں',
  },
  rm: {
    h: 'Rafiq ka kaam kaisa raha?',
    sub: 'Geyser valve · aaj',
    rate: 'Sitaare',
    star: 'sitaare',
    speak: 'Apni raaye bolein',
    aiNote: 'aap ki baat ka khulasa',
    said: '“Waqt par aaye, valve badla aur farsh bhi saaf kar ke gaye. Qeemat wohi li jo tay thi.”',
    tagsH: 'Tag lagayein',
    tags: { clock: 'Waqt par', spark: 'Saaf kaam', coin: 'Munasib qeemat', smile: 'Achha rawaiya' },
    send: 'Raaye bhejein',
  },
  en: {
    h: 'How was Rafiq’s work?',
    sub: 'Geyser valve · today',
    rate: 'Rating',
    star: 'stars',
    speak: 'Speak your review',
    aiNote: 'transcribed + translated from Urdu',
    said: '“Came on time, replaced the valve and even cleaned the floor. Charged exactly the agreed price.”',
    tagsH: 'Add tags',
    tags: { clock: 'On time', spark: 'Clean work', coin: 'Fair price', smile: 'Polite' },
    send: 'Submit review',
  },
};

const TAGS = ['clock', 'spark', 'coin', 'smile'] as const;

export default function ReviewPage() {
  const { lang } = useLang('en');
  const router = useRouter();
  const t = D[lang];
  const [r, setR] = useState(5);
  const [on, setOn] = useState<Record<string, boolean>>({ clock: true, spark: true, coin: true });
  const [jobId, setJobId] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') setJobId(new URLSearchParams(window.location.search).get('jobId') ?? '');
  }, []);

  async function submitReview() {
    if (!jobId) { setError('Open this page from a completed booking to leave a review.'); return; }
    setSending(true); setError('');
    try {
      await api('/api/reviews', { method: 'POST', body: JSON.stringify({ jobId, stars: r, tags: TAGS.filter((tag) => on[tag]).map((tag) => ({ clock: 'on-time', spark: 'clean-work', coin: 'fair-price', smile: 'polite' })[tag]), ...(reviewText.trim() ? { transcriptEn: reviewText.trim(), language: 'en' } : {}) }) });
      router.push('/customer/states');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit the review.'); }
    finally { setSending(false); }
  }

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c6" extra="rr-screen">
        <header className="top">
          <span className="fx" />
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <main className="col g16 fx px">
          <div className="col g4">
            <h1 className="t">{t.h}</h1>
            <span className="l soft">{t.sub}</span>
          </div>

          <div className="row" role="radiogroup" aria-label={t.rate} style={{ justifyContent: 'center', gap: '4px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={`sb2 ${n <= r ? 'on' : ''}`.trim()}
                role="radio"
                aria-checked={n <= r}
                aria-label={`${n} ${t.star}`}
                onClick={() => setR(n)}
              >
                <svg viewBox="0 0 24 24" key={`${n}-${n <= r}`} className={n <= r ? 'rr-spring' : undefined}>
                  <use href="#i-star" />
                </svg>
              </button>
            ))}
          </div>

          <div className="card col g12" style={{ padding: '14px', borderRadius: '18px', alignItems: 'center' }}>
            <label className="col g8 l bold" style={{ width: '100%' }}>{t.speak}
              <textarea value={reviewText} onChange={(event) => setReviewText(event.target.value)} maxLength={2000} rows={3} placeholder="Tell other customers what went well" style={{ resize: 'vertical', minHeight: 80, border: '2px solid var(--line)', borderRadius: 14, padding: 12, font: 'inherit' }} />
            </label>
          </div>
          {error && <p role="alert" style={{ color: '#b3162b' }}>{error}</p>}

          <div className="col g8">
            <span className="l bold soft">{t.tagsH}</span>
            <div className="row g8 wrap">
              {TAGS.map((ic) => (
                <button
                  type="button"
                  key={ic}
                  className={`tg ${on[ic] ? 'on' : ''}`.trim()}
                  aria-pressed={!!on[ic]}
                  onClick={() => setOn((o) => ({ ...o, [ic]: !o[ic] }))}
                >
                  <Icon name={`i-${ic}`} cls="s20" />
                  {t.tags[ic]}
                </button>
              ))}
            </div>
          </div>
        </main>

        <div className="dock">
          <button type="button" className="btn btn-t" disabled={sending} onClick={() => void submitReview()} style={{ minHeight: '56px' }}>
            <Icon name="i-chk" cls="s24" />
            {sending ? 'Sending…' : t.send}
          </button>
        </div>
      </Screen>
    </Stage>
  );
}
