'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { api, getSession, loadSearch, saveActiveJob, signInDemo, type DemoUser } from '@/lib/client-api';

type Worker = DemoUser & {
  area: string;
  status: 'FREE' | 'BUSY' | 'OFF';
  rating: number;
  jobsCompleted: number;
  rateMin: number;
  rateMax: number;
  trade: { nameEn: string; nameUr: string };
  skills: Array<{ labelEn: string; labelUr: string | null }>;
  distance: { km: number; en: string; ur: string };
  trustSummary: { summaryEn: string; sourceReviewCount: number } | null;
};

export default function ResultsPage() {
  const { lang } = useLang('en');
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [customer, setCustomer] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState('');
  const search = loadSearch();
  const copy = lang === 'ur'
    ? { title: 'قریب کاریگر', back: 'واپس', loading: 'کاریگر تلاش ہو رہے ہیں…', empty: 'اس کام کے لیے ابھی کوئی کاریگر دستیاب نہیں۔', retry: 'دوبارہ تلاش کریں', request: 'کام کی درخواست بھیجیں', sent: 'درخواست بھیج رہے ہیں…', rating: 'ریٹنگ', jobs: 'مکمل کام', km: 'کلومیٹر دور', fail: 'فہرست لوڈ نہیں ہوئی' }
    : { title: search?.classification.tradeSlug ? `${search.classification.tradeSlug.replaceAll('-', ' ')} workers nearby` : 'Workers nearby', back: 'Back', loading: 'Finding nearby workers…', empty: 'No available worker matched this request. Try a wider description or another trade.', retry: 'Change request', request: 'Request this worker', sent: 'Sending request…', rating: 'Rating', jobs: 'jobs completed', km: 'away', fail: 'Could not load workers' };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const who = getSession('customer') ?? await signInDemo('customer');
        if (cancelled) return;
        setCustomer(who);
        const classification = loadSearch()?.classification;
        const params = new URLSearchParams({ lat: String(who.lat ?? 33.6687), lng: String(who.lng ?? 72.9735), radiusKm: '30', available: 'true', limit: '30' });
        if (classification?.tradeSlug) params.set('trade', classification.tradeSlug);
        if (classification?.keywords?.length) params.set('keywords', classification.keywords.join(','));
        const { data } = await api<Worker[]>(`/api/workers?${params}`);
        if (!cancelled) setWorkers(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : copy.fail);
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [copy.fail]);

  async function requestWorker(worker: Worker) {
    if (!customer) return;
    setRequesting(worker.id); setError('');
    try {
      const req = loadSearch();
      const { data } = await api<{ id: string; status: string; workerName: string }>(`/api/jobs`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: customer.id,
          workerId: worker.id,
          descriptionRaw: req?.description || 'Please contact me about this repair.',
          descriptionSource: req?.source ?? 'text',
          ...(req?.photoUrl ? { photoUrl: req.photoUrl } : {}),
          ...(req?.classification ? { aiClassification: req.classification } : {}),
        }),
      });
      saveActiveJob(data);
      router.push(`/customer/live?jobId=${data.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send the request.'); }
    finally { setRequesting(''); }
  }

  return <Stage><Screen skin="cust" defaultLang="en" id="s-c2" extra="rr-screen">
    <header className="top">
      <Link className="iconbtn" href="/customer/describe" aria-label={copy.back}><Icon name="i-back" cls="s24 flip" /></Link>
      <h1 className="b bold fx" style={{ textTransform: 'capitalize' }}>{copy.title}</h1>
      <LangSwitch fallback="en" style={{ flex: 'none', width: '176px' }} /><ExitBtn />
    </header>
    <main className="col g12 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
      {search && <div className="card col g4" style={{ padding: 14, borderRadius: 16 }}><span className="soft">Your request</span><b>{search.description}</b><small>Suggested fix: {search.classification.likelyFix} · {search.classification.provider}</small></div>}
      {loading && <p aria-live="polite">{copy.loading}</p>}
      {!loading && workers.length === 0 && !error && <div className="card col g12" style={{ padding: 18, borderRadius: 18 }}><p>{copy.empty}</p><Link className="btn btn-t" href="/customer/describe">{copy.retry}</Link></div>}
      {error && <p role="alert" style={{ color: '#b3162b' }}>{error}</p>}
      {workers.map((worker) => <article key={worker.id} className="wc" style={{ flex: 'none' }}>
        <div className="row g12">
          <span className="av">{worker.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div className="col fx g4">
            <div className="row sb g8"><b>{worker.name}</b><span className="num">{lang === 'ur' ? worker.distance.ur : worker.distance.en}</span></div>
            <span className="soft">{worker.trade.nameEn} · {worker.area}</span>
            <span className="row g8"><span>★ {Number(worker.rating).toFixed(1)} {copy.rating}</span><span>· {worker.jobsCompleted} {copy.jobs}</span></span>
            <span>Rs {worker.rateMin.toLocaleString()}–{worker.rateMax.toLocaleString()}</span>
            {worker.trustSummary && <small className="soft">{worker.trustSummary.summaryEn}</small>}
          </div>
        </div>
        <button type="button" className="btn btn-t" style={{ marginTop: 12, minHeight: 48 }} disabled={requesting === worker.id} onClick={() => void requestWorker(worker)}>{requesting === worker.id ? copy.sent : copy.request}</button>
      </article>)}
    </main>
  </Screen></Stage>;
}
