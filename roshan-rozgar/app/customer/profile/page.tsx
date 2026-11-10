'use client';

/**
 * C3 · Worker profile.
 *
 * Trust is rendered, not claimed (Design.md §2.10): the rating always travels
 * with its job count, the summary with its source count and provider, and the
 * individual reviews underneath it are what the summary was built from.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, Shape } from '@/components/ui';
import { AiChip } from '@/components/customer/ai-chip';
import { ErrorState, LoadingState, OfflineState, useOnline } from '@/components/customer/states';
import { api } from '@/lib/client-api';

type Profile = {
  id: string; name: string; phone: string; area: string; status: 'FREE' | 'BUSY' | 'OFF';
  rateMin: number; rateMax: number; rating: number; jobsCompleted: number; yearsExperience: number;
  trade: { slug: string; nameEn: string; nameUr: string };
  skills: Array<{ id: string; labelEn: string; labelUr: string | null }>;
  workPhotos: Array<{ id: string; url: string; aiTags: Array<{ label: string }>; aiProvider: string | null }>;
  trustSummary: { summaryEn: string; summaryUr: string | null; sourceReviewCount: number; aiProvider: string | null } | null;
  reviews: Array<{ id: string; stars: number; tags: string[]; transcriptEn: string | null; transcriptUr: string | null; createdAt: string }>;
};

const GLYPH: Record<string, string> = { electrician: 'elec', plumber: 'plum', 'ac-technician': 'ac', carpenter: 'carp', mechanic: 'mech', painter: 'paint', mason: 'mason' };
const STATUS_KEY = { FREE: 'free', BUSY: 'busy', OFF: 'off' } as const;

const D: Record<Lang, Record<string, string>> = {
  ur: { back: 'واپس', free: 'فارغ', busy: 'کام پر ہیں', off: 'آج چھٹی', mock: 'شناختی کارڈ درج · ڈیمو', work: 'کام کی تصاویر', trust: 'بھروسہ', jobs: 'مکمل کام', from: 'آراء سے', reviews: 'آراء', none: 'ابھی کوئی رائے نہیں', band: 'قیمت کا اندازہ', call: 'کال کریں', req: 'بلائیں', years: 'سال کا تجربہ', skills: 'ہنر', onJob: 'اس وقت دوسرے کام پر ہیں', unavailable: 'آج دستیاب نہیں', noPhotos: 'ابھی کوئی تصویر نہیں', retry: 'دوبارہ کوشش کریں', loading: 'پروفائل لوڈ ہو رہا ہے…', noId: 'کوئی کاریگر منتخب نہیں', toResults: 'فہرست پر جائیں' },
  rm: { back: 'Wapas', free: 'Faarigh', busy: 'Kaam par', off: 'Aaj chutti', mock: 'ID card darj · demo', work: 'Kaam ki tasaveer', trust: 'Bharosa', jobs: 'mukammal kaam', from: 'aara se', reviews: 'aara', none: 'Abhi koi raaye nahi', band: 'Qeemat ka andaza', call: 'Call karein', req: 'Bulayein', years: 'saal ka tajurba', skills: 'Hunar', onJob: 'Is waqt doosre kaam par hain', unavailable: 'Aaj dastiyab nahi', noPhotos: 'Abhi koi tasveer nahi', retry: 'Dobara koshish karein', loading: 'Profile load ho raha hai…', noId: 'Koi kaarigar muntakhib nahi', toResults: 'Fehrist par jayein' },
  en: { back: 'Back', free: 'Available', busy: 'On a job', off: 'Off today', mock: 'ID on file · demo (mocked)', work: 'Past work', trust: 'Trust', jobs: 'jobs completed', from: 'reviews', reviews: 'Recent reviews', none: 'No reviews yet', band: 'Typical price', call: 'Call', req: 'Request', years: 'years of experience', skills: 'Skills', onJob: 'Currently on another job', unavailable: 'Not available today', noPhotos: 'No work photos yet', retry: 'Try again', loading: 'Loading profile…', noId: 'No worker selected', toResults: 'Back to results' },
};

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : `${Math.round(days / 30)} mo ago`;
}

export default function ProfilePage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const online = useOnline();
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [w, setW] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id: string) => {
    setLoading(true); setError('');
    try { setW((await api<Profile>(`/api/workers/${id}`)).data); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load this profile.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('workerId');
    setWorkerId(id);
    if (id) void load(id); else setLoading(false);
  }, [load]);

  const topbar = (
    <header className="top">
      <Link className="iconbtn" href="/customer/results" aria-label={t.back}><Icon name="i-back" cls="s24 flip" /></Link>
      <span className="fx" />
      <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
      <ExitBtn />
    </header>
  );

  if (!workerId || error || !w) {
    return <Stage><Screen skin="cust" defaultLang="en" id="s-c3" extra="rr-screen">{topbar}
      <main className="col g12 fx px">
        {!online && <OfflineState onRetry={workerId ? () => void load(workerId) : undefined} />}
        {loading && <LoadingState message={t.loading} />}
        {!loading && !workerId && <ErrorState message={t.noId} href="/customer/results" actionLabel={t.toResults} />}
        {!loading && workerId && (error || !w) && <ErrorState message={error} onRetry={() => void load(workerId)} actionLabel={t.retry} />}
      </main>
    </Screen></Stage>;
  }

  const st = STATUS_KEY[w.status];
  const initials = w.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const trade = lang === 'ur' ? w.trade.nameUr : w.trade.nameEn;
  const g = GLYPH[w.trade.slug] ?? 'mech';
  const first = w.name.split(' ')[0];
  const summary = lang === 'ur' ? w.trustSummary?.summaryUr ?? w.trustSummary?.summaryEn : w.trustSummary?.summaryEn;
  const lastReview = w.reviews[0];
  const topTags = Object.entries(w.reviews.flatMap((r) => r.tags).reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c3" extra="rr-screen">
        {topbar}
        <main className="col g12 fx px" style={{ paddingBottom: '96px', overflowY: 'auto' }}>
          {!online && <OfflineState onRetry={() => void load(w.id)} />}

          <section className="card col" style={{ overflow: 'hidden', padding: 0, flex: 'none' }}>
            <div className="truck" />
            <div className="row g12" style={{ padding: '14px' }}>
              <span style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--ttint)', display: 'grid', placeItems: 'center', font: "800 24px/1 'Plus Jakarta Sans', sans-serif", flex: 'none' }}>{initials}</span>
              <div className="col g4 fx">
                <h1 className="t" style={{ fontSize: 22 }}>{w.name}</h1>
                <div className="row g8 wrap">
                  <span className={`chip sm tr-${g}`} style={{ borderColor: 'var(--c)' }}>
                    <span className="gl" style={{ width: 22, height: 22 }}><Glyph name={`g-${g}`} /></span>{trade}
                  </span>
                  <span className={`pill ${st}`} style={{ height: 32, fontSize: 13 }}>
                    <span className="dot"><Shape name={`s-${st}`} /></span>{t[st]}
                  </span>
                  <span className="chip sm" style={{ borderStyle: 'dashed' }}>{t.mock}</span>
                </div>
                <span className="l soft">{w.area} · {w.yearsExperience} {t.years}</span>
              </div>
            </div>
          </section>

          <section className="card col g8" style={{ padding: 14, flex: 'none' }} aria-label={t.trust}>
            <div className="row g12">
              <span className="t num" dir="ltr">{w.jobsCompleted > 0 ? Number(w.rating).toFixed(1) : '—'}</span>
              <div className="col">
                <span className="stars" aria-label={`${Number(w.rating).toFixed(1)} / 5`}>{Array.from({ length: 5 }, (_, i) => <Icon key={i} name="i-star" cls="s20" style={{ opacity: i < Math.round(w.rating) ? 1 : 0.25 }} />)}</span>
                <span className="l soft">{w.jobsCompleted} {t.jobs}</span>
              </div>
            </div>
            {lastReview && <span className="row g4 l soft"><Icon name="i-clock" cls="s20" />{ago(lastReview.createdAt)}</span>}
            {topTags.length > 0 && <div className="row g8 wrap">{topTags.map(([tag, n]) => <span key={tag} className="chip sm">{tag} · {n}</span>)}</div>}
            {w.trustSummary && summary ? (
              <p className="sumry">
                <span style={{ marginInlineEnd: 6, display: 'inline-flex', gap: 6 }}>
                  <AiChip provider={w.trustSummary.aiProvider} />
                  <span className="ai">{w.trustSummary.sourceReviewCount} {t.from}</span>
                </span>
                {summary}
              </p>
            ) : <p className="l soft">{t.none}</p>}
          </section>

          <section className="col g8" style={{ flex: 'none' }}>
            <h2 className="l bold">{t.work}</h2>
            {w.workPhotos.length === 0 ? <p className="l soft">{t.noPhotos}</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {w.workPhotos.slice(0, 6).map((p) => (
                  <div key={p.id} className="gp" role="img" aria-label={p.aiTags.map((x) => x.label).join(', ')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    <span>{p.aiTags[0]?.label ?? ''}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {w.skills.length > 0 && <section className="col g8" style={{ flex: 'none' }}>
            <h2 className="l bold">{t.skills}</h2>
            <div className="row g8 wrap">{w.skills.map((s) => <span key={s.id} className="chip sm">{lang === 'ur' ? s.labelUr ?? s.labelEn : s.labelEn}</span>)}</div>
          </section>}

          {w.reviews.length > 0 && <section className="col g8" style={{ flex: 'none' }}>
            <h2 className="l bold">{t.reviews}</h2>
            {w.reviews.slice(0, 4).map((r) => (
              <article key={r.id} className="card col g4" style={{ padding: 12, borderRadius: 14 }}>
                <span className="row sb"><span className="row g4 l bold"><Icon name="i-star" cls="s20" />{r.stars}</span><span className="xs soft">{ago(r.createdAt)}</span></span>
                <p className="l">{lang === 'ur' ? r.transcriptUr ?? r.transcriptEn : r.transcriptEn ?? r.transcriptUr}</p>
                {r.tags.length > 0 && <span className="xs soft">{r.tags.join(' · ')}</span>}
              </article>
            ))}
          </section>}
        </main>

        <div className="bar">
          <div className="col fx">
            <span className="xs soft">{w.status === 'BUSY' ? t.onJob : w.status === 'OFF' ? t.unavailable : t.band}</span>
            <span className="b bold num" dir="ltr" style={{ textAlign: 'start' }}>Rs {w.rateMin.toLocaleString()}–{w.rateMax.toLocaleString()}</span>
          </div>
          <a className="btn btn-o" href={`tel:${w.phone}`} aria-label={`${t.call} ${first}`} style={{ width: 48, padding: 0 }}><Icon name="i-phone" cls="s24" /></a>
          {w.status === 'OFF'
            ? <span className="btn btn-o" aria-disabled="true" style={{ opacity: 0.5 }}>{t.unavailable}</span>
            : <Link className="btn btn-t" href={`/customer/booking?workerId=${w.id}`}>{t.req} {first}</Link>}
        </div>
      </Screen>
    </Stage>
  );
}
