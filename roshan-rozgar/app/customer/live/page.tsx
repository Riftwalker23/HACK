'use client';

/**
 * C5 · Live job status. Everything here is read from the job, polled every 4 s:
 * the rail position, who has confirmed the price, and the worker's details. Nothing
 * is faked — there is no ETA or live map because the backend tracks no position.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import JobChat from '@/components/job-chat';
import { ErrorState, LoadingState, OfflineState, useOnline } from '@/components/customer/states';
import { api, loadActiveJob } from '@/lib/client-api';
import { readQueryParam, useBrowserValue } from '@/lib/customer/client-store';

type Job = {
  id: string; status: 'REQUESTED' | 'ACCEPTED' | 'PRICE_AGREED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
  worker: { name: string; phone: string; area: string };
  trade: { nameEn: string; nameUr: string };
  description: { raw: string };
  ended: { by: string | null; reason: string | null } | null;
  price: { amount: number | null; unit: string | null; includes: string[] | null; confirmedByCustomer: boolean; confirmedByWorker: boolean };
};

/** Rail step (0-based) that is current for each status, or 4 when everything is done. */
function railStep(status: Job['status']): number {
  switch (status) {
    case 'REQUESTED': return 0;
    case 'ACCEPTED': return 1;
    case 'PRICE_AGREED': return 1;
    case 'IN_PROGRESS': return 2;
    case 'COMPLETED': return 4;
    default: return 0;
  }
}

const STEPS = [['i-send', 's1'], ['i-hand', 's2'], ['i-wrench', 's3'], ['i-flag', 's4']] as const;

const D: Record<Lang, Record<string, string>> = {
  ur: { h: 'آپ کی بکنگ', prog: 'کام کی پیش رفت', s1: 'درخواست', s2: 'طے', s3: 'کام جاری', s4: 'مکمل', REQUESTED: 'کاریگر کے جواب کا انتظار ہے…', ACCEPTED: 'کاریگر نے قبول کر لیا — اب قیمت طے کریں', PRICE_AGREED: 'قیمت طے ہو گئی — کاریگر کام شروع کرے گا', IN_PROGRESS: 'کام جاری ہے', COMPLETED: 'کام مکمل ہو گیا', DECLINED: 'کاریگر نے معذرت کر لی', CANCELLED: 'درخواست منسوخ ہو گئی', call: 'کال کریں', wait: 'کاریگر قیمت بتانے کا منتظر ہے…', yourOffer: 'آپ کی پیشکش — کاریگر قبول کرے گا یا اپنی قیمت بتائے گا', price: 'قیمت', agree: 'یہ قیمت ٹھیک ہے', agreed: 'آپ نے منظور کیا', theyAgreed: 'کاریگر نے منظور کیا', newPrice: 'نئی قیمت آئی تو منظوری دوبارہ لینی ہوگی۔', cancel: 'درخواست منسوخ کریں', sure: 'کیا آپ منسوخ کرنا چاہتے ہیں؟', yes: 'ہاں، منسوخ کریں', no: 'رہنے دیں', review: 'رائے دیں', again: 'دوسرا کاریگر ڈھونڈیں', loading: 'لوڈ ہو رہا ہے…', none: 'کوئی بکنگ منتخب نہیں' },
  rm: { h: 'Aap ki booking', prog: 'Kaam ki pesh-raft', s1: 'Darkhwast', s2: 'Tay', s3: 'Kaam jaari', s4: 'Mukammal', REQUESTED: 'Kaarigar ke jawab ka intezar hai…', ACCEPTED: 'Kaarigar ne qubool kar liya — ab qeemat tay karein', PRICE_AGREED: 'Qeemat tay ho gayi — kaarigar kaam shuru karega', IN_PROGRESS: 'Kaam jaari hai', COMPLETED: 'Kaam mukammal ho gaya', DECLINED: 'Kaarigar ne maazrat kar li', CANCELLED: 'Darkhwast mansookh ho gayi', call: 'Call karein', wait: 'Kaarigar qeemat batane ka muntazir hai…', yourOffer: 'Aap ki pesh-kash — kaarigar qubool karega ya apni qeemat batayega', price: 'Qeemat', agree: 'Yeh qeemat theek hai', agreed: 'Aap ne manzoor kiya', theyAgreed: 'Kaarigar ne manzoor kiya', newPrice: 'Nayi qeemat aayi to manzoori dobara leni hogi.', cancel: 'Darkhwast mansookh karein', sure: 'Kya aap mansookh karna chahte hain?', yes: 'Haan, mansookh karein', no: 'Rehne dein', review: 'Raaye dein', again: 'Doosra kaarigar dhoondein', loading: 'Load ho raha hai…', none: 'Koi booking muntakhib nahi' },
  en: { h: 'Your booking', prog: 'Job progress', s1: 'Requested', s2: 'Agreed', s3: 'In progress', s4: 'Done', REQUESTED: 'Waiting for the worker to respond…', ACCEPTED: 'The worker accepted — now agree the price', PRICE_AGREED: 'Price agreed — the worker will start', IN_PROGRESS: 'Work is in progress', COMPLETED: 'The job is done', DECLINED: 'The worker declined this request', CANCELLED: 'This request was cancelled', call: 'Call', wait: 'Waiting for the worker to name a price…', yourOffer: 'Your offer — the worker will accept it or counter', price: 'Price', agree: 'This price is right', agreed: 'You agreed', theyAgreed: 'Worker agreed', newPrice: 'If the worker proposes a new price, you will need to agree again.', cancel: 'Cancel request', sure: 'Cancel this request?', yes: 'Yes, cancel', no: 'Keep it', review: 'Leave a review', again: 'Find another worker', loading: 'Loading…', none: 'No booking selected' },
};

export default function LivePage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const router = useRouter();
  const online = useOnline();
  // The URL's ?jobId, else the job this browser last booked; '' on the server render.
  const jobId = useBrowserValue(() => readQueryParam('jobId') || loadActiveJob<{ id?: string }>()?.id || '', '');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const redirected = useRef(false);
  const offerSent = useRef(false);

  const refresh = useCallback(async (id: string) => {
    let { data } = await api<Job>(`/api/jobs/${id}`);
    // The worker accepted: turn the offer made at booking into the proposed price (once).
    if (data.status === 'ACCEPTED' && data.price.amount === null && !offerSent.current) {
      let offer = 0;
      try { offer = Number(localStorage.getItem(`rr_offer_${id}`)) || 0; } catch { /* no stored offer */ }
      if (offer > 0) {
        offerSent.current = true;
        try {
          await api(`/api/jobs/${id}/price`, { method: 'POST', body: JSON.stringify({ actor: 'customer', amount: offer, unit: 'job' }) });
          try { localStorage.removeItem(`rr_offer_${id}`); } catch { /* ignore */ }
          data = (await api<Job>(`/api/jobs/${id}`)).data;
        } catch { offerSent.current = false; }
      }
    }
    setJob(data); setError('');
    if (data.status === 'COMPLETED' && !redirected.current) { redirected.current = true; router.push(`/customer/review?jobId=${id}`); }
    return data;
  }, [router]);

  useEffect(() => {
    const id = jobId;
    if (!id) return;
    let stopped = false;
    const tick = () => refresh(id).then((j) => { if (['COMPLETED', 'DECLINED', 'CANCELLED'].includes(j.status)) window.clearInterval(timer); }).catch((c) => { if (!stopped) setError(c instanceof Error ? c.message : 'Could not load the booking.'); });
    const timer = window.setInterval(() => void tick(), 4000);
    void tick();
    return () => { stopped = true; window.clearInterval(timer); };
  }, [refresh, jobId]);

  async function act(path: 'price' | 'cancel', payload: object) {
    setWorking(true); setError('');
    try { await api(`/api/jobs/${jobId}/${path}`, { method: 'POST', body: JSON.stringify(payload) }); await refresh(jobId); setConfirmCancel(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'That did not work.'); }
    finally { setWorking(false); }
  }

  const head = <header className="top"><h1 className="b bold fx">{t.h}</h1><LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} /><ExitBtn /></header>;

  if (!jobId || !job) {
    return <Stage><Screen skin="cust" defaultLang="en" id="s-c5" extra="rr-screen">{head}<main className="col g12 fx px">
      {!online && <OfflineState />}
      {!jobId ? <ErrorState message={t.none} href="/customer/describe" actionLabel={t.again} />
        : error ? <ErrorState message={error} href="/customer/describe" actionLabel={t.again} /> : <LoadingState message={t.loading} />}
    </main></Screen></Stage>;
  }

  const step = railStep(job.status);
  const terminal = job.status === 'DECLINED' || job.status === 'CANCELLED';
  const initials = job.worker.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const cancellable = ['REQUESTED', 'ACCEPTED', 'PRICE_AGREED'].includes(job.status);
  const p = job.price;

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c5" extra="rr-screen">
        {head}
        <main className="col g12 fx px" style={{ paddingTop: 14, overflowY: 'auto', paddingBottom: 18 }}>
          {!online && <OfflineState />}

          {terminal ? (
            <ErrorState message={`${t[job.status]}${job.ended?.reason ? ` — ${job.ended.reason}` : ''}`} href="/customer/describe" actionLabel={t.again} />
          ) : (
            <>
              <div className="rail sm" role="list" aria-label={t.prog}>
                {STEPS.map(([icon, key], i) => (
                  <span key={key} style={{ display: 'contents' }}>
                    <span className={`n ${i < step ? 'done' : i === step ? 'cur' : ''}`} role="listitem" aria-label={t[key]} aria-current={i === step ? 'step' : undefined}><Icon name={i < step ? 'i-chk' : icon} cls="s20" /></span>
                    {i < STEPS.length - 1 && <span className={`ln ${i < step ? 'done' : ''}`} />}
                  </span>
                ))}
              </div>
              <div className="row sb" aria-hidden="true" style={{ marginTop: -6 }}>{STEPS.map(([, key], i) => <span key={key} className="rl" style={{ color: i === step ? 'var(--roshan-text)' : undefined }}>{t[key]}</span>)}</div>
              <p className="b bold" aria-live="polite">{t[job.status]}</p>
            </>
          )}

          <div className="card row g12" style={{ padding: 12, borderRadius: 18, flex: 'none' }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--ttint)', display: 'grid', placeItems: 'center', font: "800 16px/1 'Plus Jakarta Sans', sans-serif", flex: 'none' }}>{initials}</span>
            <div className="col fx"><span className="b bold">{job.worker.name}</span><span className="l soft">{lang === 'ur' ? job.trade.nameUr : job.trade.nameEn} · {job.worker.area}</span></div>
            <a className="btn btn-t" href={`tel:${job.worker.phone}`} aria-label={`${t.call} ${job.worker.name}`} style={{ width: 52, padding: 0 }}><Icon name="i-phone" cls="s24" /></a>
          </div>

          {!terminal && job.status !== 'REQUESTED' && (
            <section className="card col g8" style={{ padding: 14, borderRadius: 18, flex: 'none' }} aria-label={t.price} aria-live="polite">
              <div className="row sb"><span className="l bold row g8"><Icon name="i-coin" cls="s24" />{t.price}</span></div>
              {p.amount === null ? <p className="l soft">{t.wait}</p> : (
                <>
                  <b className="num" dir="ltr" style={{ fontSize: 24 }}>Rs {p.amount.toLocaleString()} <span className="l soft">{p.unit}</span></b>
                  {p.includes && p.includes.length > 0 && <span className="l soft">{p.includes.join(', ')}</span>}
                  <div className="row g8">
                    <span className={`party ${p.confirmedByWorker ? 'ok' : ''}`}><span className="tk">{p.confirmedByWorker && <Icon name="i-chk" style={{ width: 14, height: 14 }} />}</span>{t.theyAgreed}</span>
                    <span className={`party ${p.confirmedByCustomer ? 'ok' : ''}`}><span className="tk">{p.confirmedByCustomer && <Icon name="i-chk" style={{ width: 14, height: 14 }} />}</span>{t.agreed}</span>
                  </div>
                  {p.confirmedByCustomer && !p.confirmedByWorker && <span className="l soft">{t.yourOffer}</span>}
                  {!p.confirmedByCustomer && job.status === 'ACCEPTED' && <button type="button" className="btn btn-t" disabled={working} onClick={() => void act('price', { actor: 'customer', confirm: true })}><Icon name="i-chk" cls="s24" />{t.agree}</button>}
                  <span className="xs soft">{t.newPrice}</span>
                </>
              )}
            </section>
          )}

          <JobChat jobId={job.id} actor="customer" />
          {error && <ErrorState message={error} />}

          {job.status === 'COMPLETED' && <Link className="btn btn-t" href={`/customer/review?jobId=${job.id}`}><Icon name="i-star" cls="s24" />{t.review}</Link>}

          {cancellable && !confirmCancel && <button type="button" className="btn btn-o" onClick={() => setConfirmCancel(true)}><Icon name="i-x" cls="s24" />{t.cancel}</button>}
          {confirmCancel && (
            <div className="card col g8" role="alertdialog" aria-label={t.sure} style={{ padding: 14, borderRadius: 16 }}>
              <b>{t.sure}</b>
              <div className="row g8">
                <button type="button" className="btn btn-o fx" onClick={() => setConfirmCancel(false)}>{t.no}</button>
                <button type="button" className="btn btn-no fx" disabled={working} onClick={() => void act('cancel', { actor: 'customer' })}><Icon name="i-x" cls="s24" />{t.yes}</button>
              </div>
            </div>
          )}
        </main>
      </Screen>
    </Stage>
  );
}
