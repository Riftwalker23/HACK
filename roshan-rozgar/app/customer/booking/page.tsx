'use client';

/**
 * C4 · Booking confirm. This sheet is what CREATES the job (results -> profile ->
 * booking -> live). The price is deliberately not shown as agreed: it is agreed in
 * chat after the worker accepts, and is PRICE_AGREED only once both sides confirm.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { AiChip } from '@/components/customer/ai-chip';
import { ErrorState, LoadingState, OfflineState, useOnline } from '@/components/customer/states';
import { api, getSession, loadSearch, saveActiveJob, signInDemo, type DemoUser } from '@/lib/client-api';
import { useNowMinute, useQueryParam } from '@/lib/customer/client-store';

type Worker = { id: string; name: string; status: 'FREE' | 'BUSY' | 'OFF'; rateMin: number; rateMax: number };

const D: Record<Lang, Record<string, string>> = {
  ur: { h: 'بکنگ کی تصدیق', close: 'بند کریں', when: 'کب؟', now: 'ابھی', hour: '1 گھنٹے میں', morning: 'کل صبح', addr: 'پتہ', change: 'بدلیں', done: 'ٹھیک ہے', note: 'مسئلہ', price: 'قیمت', priceNote: 'درست قیمت کاریگر کے قبول کرنے کے بعد چیٹ میں طے ہوگی۔ ابھی کچھ نہیں لیا جائے گا۔', band: 'عام قیمت', confirm: 'درخواست بھیجیں', sending: 'بھیج رہے ہیں…', busyTitle: 'یہ کاریگر ابھی دوسرے کام پر چلا گیا', busyBtn: 'دوسرا کاریگر چنیں', needText: 'براہ کرم مسئلہ لکھیں', understood: 'ہم نے یہ سمجھا', retry: 'دوبارہ کوشش کریں', loading: 'لوڈ ہو رہا ہے…', noId: 'کوئی کاریگر منتخب نہیں', toResults: 'فہرست پر جائیں', sentWith: 'یہ وقت اور پتہ درخواست کے ساتھ کاریگر کو جائے گا' },
  rm: { h: 'Booking ki tasdeeq', close: 'Band karein', when: 'Kab?', now: 'Abhi', hour: '1 ghante mein', morning: 'Kal subah', addr: 'Pata', change: 'Badlein', done: 'Theek hai', note: 'Masla', price: 'Qeemat', priceNote: 'Sahi qeemat kaarigar ke qubool karne ke baad chat mein tay hogi. Abhi kuch nahi liya jayega.', band: 'Aam qeemat', confirm: 'Darkhwast bhejein', sending: 'Bhej rahe hain…', busyTitle: 'Yeh kaarigar abhi doosre kaam par chala gaya', busyBtn: 'Doosra kaarigar chunein', needText: 'Masla likhein', understood: 'Humne yeh samjha', retry: 'Dobara koshish karein', loading: 'Load ho raha hai…', noId: 'Koi kaarigar muntakhib nahi', toResults: 'Fehrist par jayein', sentWith: 'Yeh waqt aur pata darkhwast ke saath kaarigar ko jayega' },
  en: { h: 'Confirm booking', close: 'Close', when: 'When?', now: 'Now', hour: 'In 1 hour', morning: 'Tomorrow morning', addr: 'Address', change: 'Change', done: 'Done', note: 'The problem', price: 'Price', priceNote: 'You and the worker agree the exact price in chat after they accept. Nothing is charged now.', band: 'Typical price', confirm: 'Send request', sending: 'Sending…', busyTitle: 'That worker just took another job', busyBtn: 'Choose another worker', needText: 'Describe the problem first', understood: 'What we understood', retry: 'Try again', loading: 'Loading…', noId: 'No worker selected', toResults: 'Back to results', sentWith: 'This time and address are sent to the worker with your request' },
};

const clock = (ms: number) => { const d = new Date(ms); const h = d.getHours(); return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

export default function BookingPage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const router = useRouter();
  const online = useOnline();
  // undefined until the URL has been read on the client (server render + hydration).
  const workerId = useQueryParam('workerId');
  const now = useNowMinute();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [customer, setCustomer] = useState<DemoUser | null>(null);
  const [slot, setSlot] = useState(0);
  const [address, setAddress] = useState('');
  const [editAddr, setEditAddr] = useState(false);
  const [problem, setProblem] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(true);
  // No worker id in the URL means there is nothing to load.
  const loading = workerId === undefined || (!!workerId && fetching);
  const search = typeof window === 'undefined' ? null : loadSearch();

  useEffect(() => {
    const id = workerId;
    if (!id) return;
    void (async () => {
      try {
        const who = getSession('customer') ?? await signInDemo('customer');
        setCustomer(who); setAddress(who.addressLabel ?? '');
        setWorker((await api<Worker>(`/api/workers/${id}`)).data);
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load.'); }
      finally { setFetching(false); }
    })();
  }, [workerId]);

  const slots = [
    { label: t.now, hint: '~15 min' },
    { label: t.hour, hint: clock(now + 3_600_000) },
    { label: t.morning, hint: '10:00 am' },
  ];
  const description = search?.description || problem.trim();

  async function confirm() {
    if (!customer || !worker) return;
    if (!description) { setError(t.needText); return; }
    setSending(true); setError('');
    try {
      // Raw fetch (not api()) so the error CODE survives: WORKER_BUSY needs its own screen.
      const res = await fetch('/api/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id, workerId: worker.id,
          descriptionRaw: `${description}\n\nPreferred time: ${slots[slot].label}\nAddress: ${address || customer.addressLabel || ''}`.slice(0, 1900),
          descriptionSource: search?.source ?? 'text',
          ...(search?.photoUrl ? { photoUrl: search.photoUrl } : {}),
          ...(search?.classification ? { aiClassification: search.classification } : {}),
        }),
      });
      const payload = await res.json() as { ok: boolean; data?: { id: string }; error?: { code: string; message: string } };
      if (!res.ok || !payload.ok || !payload.data) {
        if (payload.error?.code === 'WORKER_BUSY') { setBusy(true); return; }
        throw new Error(payload.error?.message ?? 'Could not send the request.');
      }
      saveActiveJob(payload.data);
      router.push(`/customer/live?jobId=${payload.data.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send the request.'); }
    finally { setSending(false); }
  }

  const head = (
    <header className="top">
      <span className="fx b bold">{worker?.name ?? ''}</span>
      <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
      <ExitBtn />
    </header>
  );

  if (!workerId || !worker) {
    return <Stage><Screen skin="cust" defaultLang="en" id="s-c4" extra="rr-screen">{head}<main className="col g12 fx px">
      {!online && <OfflineState />}
      {loading ? <LoadingState message={t.loading} /> : !workerId ? <ErrorState message={t.noId} href="/customer/results" actionLabel={t.toResults} /> : <ErrorState message={error} href="/customer/results" actionLabel={t.toResults} />}
    </main></Screen></Stage>;
  }

  if (busy) {
    return <Stage><Screen skin="cust" defaultLang="en" id="s-c4" extra="rr-screen">{head}<main className="col g12 fx px">
      <ErrorState message={t.busyTitle} href="/customer/results" actionLabel={t.busyBtn} />
    </main></Screen></Stage>;
  }

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c4" extra="rr-screen">
        {head}
        <div className="px col g12" aria-hidden="true" style={{ opacity: 0.9 }}><div className="card" style={{ height: 90 }} /><div className="card" style={{ height: 110 }} /></div>
        <div className="scrim" />

        <section className="sheet col g12 rr-sheet" role="dialog" aria-modal="true" aria-labelledby="bk-h" style={{ overflowY: 'auto', maxHeight: '88%' }}>
          <div className="grab" />
          <div className="row sb">
            <h1 id="bk-h" className="t">{t.h}</h1>
            <Link className="iconbtn" href={`/customer/profile?workerId=${worker.id}`} aria-label={t.close}><Icon name="i-x" cls="s24" /></Link>
          </div>

          <div className="col g8">
            <span className="l bold soft">{t.when}</span>
            <div className="row g8" role="radiogroup" aria-label={t.when}>
              {slots.map((x, i) => (
                <button type="button" key={x.label} className={`tm ${i === slot ? 'on' : ''}`.trim()} role="radio" aria-checked={i === slot} onClick={() => setSlot(i)}>
                  <span>{x.label}</span><span className="xs soft num">{x.hint}</span>
                </button>
              ))}
            </div>
            <span className="xs soft">{t.sentWith}</span>
          </div>

          <div className="row g12 card" style={{ padding: 10, borderRadius: 16 }}>
            <Icon name="i-pin" cls="s24" />
            <div className="col fx">
              <span className="xs soft">{t.addr}</span>
              {editAddr
                ? <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={160} aria-label={t.addr} style={{ border: '2px solid var(--line)', borderRadius: 10, padding: '8px 10px', font: 'inherit' }} />
                : <span className="l bold">{address || '—'}</span>}
            </div>
            <button type="button" className="btn btn-o" style={{ minHeight: 44, fontSize: 14 }} onClick={() => setEditAddr((v) => !v)}>{editAddr ? t.done : t.change}</button>
          </div>

          <div className="card col g8" style={{ padding: 12, borderRadius: 16 }}>
            <div className="row sb"><span className="l bold">{t.note}</span>{search?.classification && <AiChip provider={search.classification.provider} />}</div>
            {search?.description
              ? <p className="l">{search.description}</p>
              : <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} maxLength={1500} aria-label={t.note} style={{ border: '2px solid var(--line)', borderRadius: 12, padding: 10, font: 'inherit', resize: 'vertical' }} />}
            {search?.classification && <span className="xs soft">{t.understood}: {search.classification.tradeSlug} · {search.classification.likelyFix}</span>}
          </div>

          <div className="card col g8" style={{ padding: 12, borderRadius: 16 }} aria-label={t.price}>
            <div className="row sb"><span className="l bold">{t.band}</span><b className="num" dir="ltr">Rs {worker.rateMin.toLocaleString()}–{worker.rateMax.toLocaleString()}</b></div>
            <p className="l soft">{t.priceNote}</p>
          </div>

          {error && <p role="alert" style={{ color: '#b3162b' }}>{error}</p>}
          <button type="button" className="btn btn-t" style={{ minHeight: 56 }} disabled={sending || !online} onClick={() => void confirm()}>
            <Icon name="i-send" cls="s24" />{sending ? t.sending : t.confirm}
          </button>
        </section>
      </Screen>
    </Stage>
  );
}
