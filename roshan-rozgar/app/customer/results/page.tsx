'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { api, getSession, loadSearch, signInDemo, type DemoUser } from '@/lib/client-api';
import { ErrorState, LoadingState, NoResults, OfflineState, useOnline } from '@/components/customer/states';

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
  ranking: { reason: string };
};

export default function ResultsPage() {
  const { lang } = useLang('en');
  const online = useOnline();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [customer, setCustomer] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const search = loadSearch();
  const copy = lang === 'ur'
    ? { title: 'قریب کاریگر', back: 'واپس', loading: 'کاریگر تلاش ہو رہے ہیں…', empty: 'اس کام کے لیے ابھی کوئی کاریگر دستیاب نہیں۔', retry: 'دوبارہ تلاش کریں', request: 'پروفائل دیکھیں', rating: 'ریٹنگ', jobs: 'مکمل کام', km: 'کلومیٹر دور', fail: 'فہرست لوڈ نہیں ہوئی' }
    : { title: search?.classification.tradeSlug ? `${search.classification.tradeSlug.replaceAll('-', ' ')} workers nearby` : 'Workers nearby', back: 'Back', loading: 'Finding nearby workers…', empty: 'No available worker matched this request. Try a wider description or another trade.', retry: 'Change request', request: 'View profile', rating: 'Rating', jobs: 'jobs completed', km: 'away', fail: 'Could not load workers' };

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

  return <Stage><Screen skin="cust" defaultLang="en" id="s-c2" extra="rr-screen">
    <header className="top">
      <Link className="iconbtn" href="/customer/describe" aria-label={copy.back}><Icon name="i-back" cls="s24 flip" /></Link>
      <h1 className="b bold fx" style={{ textTransform: 'capitalize' }}>{copy.title}</h1>
      <LangSwitch fallback="en" style={{ flex: 'none', width: '176px' }} /><ExitBtn />
    </header>
    <main className="col g12 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
      {search && <div className="card col g4" style={{ padding: 14, borderRadius: 16 }}><span className="soft">Your request</span><b>{search.description}</b><small>Suggested fix: {search.classification.likelyFix} · {search.classification.provider}</small></div>}
      {!online && <OfflineState />}
      {loading && <LoadingState message={copy.loading} />}
      {!loading && workers.length === 0 && !error && <NoResults message={copy.empty} actionLabel={copy.retry} href="/customer/describe" />}
      {error && <ErrorState message={error} />}
      {workers.map((worker) => <article key={worker.id} className="wc" style={{ flex: 'none' }}>
        <div className="row g12">
          <span className="av">{worker.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div className="col fx g4">
            <div className="row sb g8"><b>{worker.name}</b><span className="num">{lang === 'ur' ? worker.distance.ur : worker.distance.en}</span></div>
            <span className="soft">{worker.trade.nameEn} · {worker.area}</span>
            <span className="row g8"><span>★ {Number(worker.rating).toFixed(1)} {copy.rating}</span><span>· {worker.jobsCompleted} {copy.jobs}</span></span>
            <span>Rs {worker.rateMin.toLocaleString()}–{worker.rateMax.toLocaleString()}</span>
            {worker.ranking?.reason && <p className="why"><span>{worker.ranking.reason}</span></p>}
            {worker.trustSummary && <small className="soft">{worker.trustSummary.summaryEn} ({worker.trustSummary.sourceReviewCount})</small>}
          </div>
        </div>
        <Link className="btn btn-t" style={{ marginTop: 12, minHeight: 48 }} href={`/customer/profile?workerId=${worker.id}`}>{copy.request}</Link>
      </article>)}
    </main>
  </Screen></Stage>;
}
