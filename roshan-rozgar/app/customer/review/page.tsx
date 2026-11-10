'use client';

/**
 * C6 · Review (Outcome 5). Tags come from the backend's canonical set so a
 * non-reader can leave a review by tapping; the stars start unset on purpose, so
 * a 5-star review is always a decision. The spoken-review card is added with the
 * voice work.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { AiChip } from '@/components/customer/ai-chip';
import { ErrorState, LoadingState, OfflineState, useOnline } from '@/components/customer/states';
import { api } from '@/lib/client-api';
import { useQueryParam } from '@/lib/customer/client-store';

type Tag = { id: string; labelEn: string; labelUr: string; labelRoman: string; sentiment: 'positive' | 'negative' };
type Job = { id: string; status: string; worker: { name: string }; trade: { nameEn: string }; description: { raw: string } };
type Done = { summary?: { summaryEn: string; summaryUr: string | null; sourceReviewCount: number; aiProvider: string | null } | null };

const D: Record<Lang, Record<string, string>> = {
  ur: { h: 'کام کیسا رہا؟', rate: 'ستارے', star: 'ستارے', pick: 'ستارے چنیں', say: 'اپنی رائے لکھیں (اختیاری)', ph: 'دوسرے گاہکوں کو بتائیں', pos: 'اچھا لگا', neg: 'بہتر ہو سکتا تھا', send: 'رائے بھیجیں', sending: 'بھیج رہے ہیں…', thanks: 'شکریہ! آپ کی رائے محفوظ ہو گئی۔', trust: 'کاریگر کا بھروسہ', from: 'آراء سے', home: 'شروع پر جائیں', already: 'آپ اس کام پر رائے دے چکے ہیں۔', notDone: 'کام ابھی مکمل نہیں ہوا۔', back: 'بکنگ پر واپس', noJob: 'کوئی کام منتخب نہیں', loading: 'لوڈ ہو رہا ہے…' },
  rm: { h: 'Kaam kaisa raha?', rate: 'Sitaare', star: 'sitaare', pick: 'Sitaare chunein', say: 'Apni raaye likhein (ikhtiyari)', ph: 'Doosre gahakon ko batayein', pos: 'Achha laga', neg: 'Behtar ho sakta tha', send: 'Raaye bhejein', sending: 'Bhej rahe hain…', thanks: 'Shukriya! Aap ki raaye mehfooz ho gayi.', trust: 'Kaarigar ka bharosa', from: 'aara se', home: 'Shuru par jayein', already: 'Aap is kaam par raaye de chuke hain.', notDone: 'Kaam abhi mukammal nahi hua.', back: 'Booking par wapas', noJob: 'Koi kaam muntakhib nahi', loading: 'Load ho raha hai…' },
  en: { h: 'How was the work?', rate: 'Rating', star: 'stars', pick: 'Choose a star rating', say: 'Write your review (optional)', ph: 'Tell other customers what happened', pos: 'What went well', neg: 'Could be better', send: 'Submit review', sending: 'Sending…', thanks: 'Thank you! Your review is saved.', trust: 'The worker’s trust summary', from: 'reviews', home: 'Back to start', already: 'You already reviewed this job.', notDone: 'This job is not finished yet.', back: 'Back to the booking', noJob: 'No job selected', loading: 'Loading…' },
};

export default function ReviewPage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const online = useOnline();
  // undefined until the URL has been read on the client (server render + hydration).
  const jobId = useQueryParam('jobId');
  const [job, setJob] = useState<Job | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [stars, setStars] = useState(0);
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [already, setAlready] = useState(false);
  const [fetching, setFetching] = useState(true);
  // No job id in the URL means there is nothing to load.
  const loading = jobId === undefined || (!!jobId && fetching);

  useEffect(() => {
    const id = jobId;
    if (!id) return;
    void (async () => {
      try {
        const [j, tg] = await Promise.all([api<Job>(`/api/jobs/${id}`), api<Tag[] | { tags: Tag[] }>('/api/reviews/tags')]);
        setJob(j.data); setTags(Array.isArray(tg.data) ? tg.data : tg.data.tags ?? []);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load.'); }
      finally { setFetching(false); }
    })();
  }, [jobId]);

  const label = (x: Tag) => (lang === 'ur' ? x.labelUr : lang === 'rm' ? x.labelRoman : x.labelEn);

  async function submit() {
    if (!jobId || stars < 1) return;
    setSending(true); setError('');
    try {
      // Raw fetch so a 409 (already reviewed) can be told apart from a real failure.
      const clean = text.trim();
      const arabic = /[؀-ۿ]/.test(clean);
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId, stars, tags: tags.filter((x) => on[x.id]).map((x) => x.id),
          ...(clean ? (arabic ? { transcriptUr: clean, language: 'ur' } : { transcriptEn: clean, language: 'en' }) : {}),
        }),
      });
      const payload = await res.json() as { ok: boolean; data?: { trustSummary?: Done['summary']; summary?: Done['summary'] }; error?: { code: string; message: string } };
      if (res.status === 409 && payload.error?.code === 'CONFLICT') { setAlready(true); return; }
      if (!res.ok || !payload.ok) throw new Error(payload.error?.message ?? 'Could not submit the review.');
      setDone({ summary: payload.data?.trustSummary ?? payload.data?.summary ?? null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit the review.'); }
    finally { setSending(false); }
  }

  const head = <header className="top"><span className="fx" /><LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} /><ExitBtn /></header>;
  const shell = (children: React.ReactNode) => <Stage><Screen skin="cust" defaultLang="en" id="s-c6" extra="rr-screen">{head}<main className="col g16 fx px" style={{ overflowY: 'auto' }}>{!online && <OfflineState />}{children}</main></Screen></Stage>;

  if (loading) return shell(<LoadingState message={t.loading} />);
  if (!jobId) return shell(<ErrorState message={t.noJob} href="/start" actionLabel={t.home} />);
  if (!job) return shell(<ErrorState message={error} href="/start" actionLabel={t.home} />);
  if (already) return shell(<ErrorState message={t.already} href="/start" actionLabel={t.home} />);
  if (job.status !== 'COMPLETED') return shell(<ErrorState message={t.notDone} href={`/customer/live?jobId=${job.id}`} actionLabel={t.back} />);

  if (done) {
    const s = done.summary;
    return shell(
      <>
        <section className="es rr-rise" role="status"><span className="ill" style={{ background: 'var(--ttint)' }}><Icon name="i-chk" cls="xl" style={{ color: 'var(--teal)' }} /></span><p className="b bold">{t.thanks}</p></section>
        {s && <section className="card col g8" style={{ padding: 14, borderRadius: 18 }}>
          <div className="row sb"><span className="l bold">{t.trust}</span><AiChip provider={s.aiProvider} /></div>
          <p className="sumry">{lang === 'ur' ? s.summaryUr ?? s.summaryEn : s.summaryEn}</p>
          <span className="xs soft">{s.sourceReviewCount} {t.from}</span>
        </section>}
        <Link className="btn btn-t" href="/start" style={{ minHeight: 56 }}><Icon name="i-house" cls="s24" />{t.home}</Link>
      </>,
    );
  }

  const group = (sentiment: Tag['sentiment'], title: string) => {
    const list = tags.filter((x) => x.sentiment === sentiment);
    return list.length === 0 ? null : (
      <div className="col g8">
        <span className="l bold soft">{title}</span>
        <div className="row g8 wrap">
          {list.map((x) => (
            <button type="button" key={x.id} className={`tg ${on[x.id] ? 'on' : ''}`.trim()} aria-pressed={!!on[x.id]} onClick={() => setOn((o) => ({ ...o, [x.id]: !o[x.id] }))}>
              <Icon name={sentiment === 'positive' ? 'i-chk' : 'i-x'} cls="s20" />{label(x)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c6" extra="rr-screen">
        {head}
        <main className="col g16 fx px" style={{ overflowY: 'auto', paddingBottom: 12 }}>
          {!online && <OfflineState />}
          <div className="col g4"><h1 className="t">{t.h}</h1><span className="l soft">{job.worker.name} · {job.trade.nameEn}</span></div>

          <div className="row" role="radiogroup" aria-label={t.rate} style={{ justifyContent: 'center', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} className={`sb2 ${n <= stars ? 'on' : ''}`.trim()} role="radio" aria-checked={n === stars} aria-label={`${n} ${t.star}`} onClick={() => setStars(n)}>
                <svg viewBox="0 0 24 24" key={`${n}-${n <= stars}`} className={n <= stars ? 'rr-spring' : undefined}><use href="#i-star" /></svg>
              </button>
            ))}
          </div>

          <label className="card col g8 l bold" style={{ padding: 14, borderRadius: 18 }}>{t.say}
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} placeholder={t.ph} style={{ resize: 'vertical', minHeight: 80, border: '2px solid var(--line)', borderRadius: 14, padding: 12, font: 'inherit' }} />
          </label>

          {group('positive', t.pos)}
          {group('negative', t.neg)}
          {error && <ErrorState message={error} />}
        </main>

        <div className="dock">
          {stars < 1 && <span className="l soft" style={{ textAlign: 'center' }}>{t.pick}</span>}
          <button type="button" className="btn btn-t" disabled={sending || stars < 1 || !online} onClick={() => void submit()} style={{ minHeight: 56 }}>
            <Icon name="i-chk" cls="s24" />{sending ? t.sending : t.send}
          </button>
        </div>
      </Screen>
    </Stage>
  );
}
