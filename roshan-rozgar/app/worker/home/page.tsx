'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { ExitBtn, LangSwitch, Screen } from '@/components/ui';
import { api, getSession, saveSession, signInDemo, type DemoUser } from '@/lib/client-api';

type Job = {
  id: string; status: string; worker: { id: string; name: string; status: string };
  customer: { name: string; addressLabel: string };
  trade: { nameEn: string }; description: { raw: string };
  price: { amount: number | null; unit: string | null; confirmedByWorker: boolean; confirmedByCustomer: boolean };
  timestamps: { requestedAt: string };
};

export default function WorkerHomePage() {
  const [worker, setWorker] = useState<DemoUser | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (id: string) => {
    try {
      const { data } = await api<Job[]>(`/api/jobs?workerId=${id}&status=REQUESTED,ACCEPTED,PRICE_AGREED,IN_PROGRESS`);
      setJobs(data);
      const me = getSession('worker');
      if (me) setWorker({ ...me, status: data.some((job) => job.status === 'ACCEPTED' || job.status === 'PRICE_AGREED' || job.status === 'IN_PROGRESS') ? 'BUSY' : me.status });
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    void (async () => {
      try {
        const me = getSession('worker') ?? await signInDemo('worker');
        if (stopped) return;
        setWorker(me);
        await refresh(me.id);
        timer = window.setInterval(() => { void refresh(me.id); }, 5000);
      } catch (cause) { if (!stopped) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); setLoading(false); } }
    })();
    return () => { stopped = true; if (timer !== undefined) window.clearInterval(timer); };
  }, [refresh]);

  async function act(job: Job, action: 'accept' | 'price' | 'start' | 'complete') {
    if (!worker) return;
    setBusyId(job.id); setError('');
    try {
      if (action === 'price') {
        const amount = Math.max(500, Math.round((Number(worker.rateMin ?? 1500) + Number(worker.rateMax ?? 3000)) / 2));
        await api(`/api/jobs/${job.id}/price`, { method: 'POST', body: JSON.stringify({ mode: 'propose', actor: 'worker', amount, unit: 'fixed', includes: ['Labour'] }) });
      } else if (action === 'complete') {
        await api(`/api/jobs/${job.id}/complete`, { method: 'POST', body: '{}' });
        const available = { ...worker, status: 'FREE' as const };
        setWorker(available);
        saveSession('worker', available);
      } else {
        await api(`/api/jobs/${job.id}/${action}`, { method: 'POST', body: '{}' });
      }
      await refresh(worker.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'That action could not be completed.'); }
    finally { setBusyId(''); }
  }

  async function toggleAvailability() {
    if (!worker) return;
    const status = worker.status === 'OFF' ? 'FREE' : 'OFF';
    try {
      const { data } = await api<DemoUser>(`/api/workers/${worker.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      const updated = { ...worker, status: data.status };
      setWorker(updated);
      saveSession('worker', updated);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update availability.'); }
  }

  return <Stage><Screen skin="work" defaultLang="ur" id="s-w-home" extra="rr-screen">
    <header className="top"><div className="col fx g4"><b className="t">Assalam-o-Alaikum{worker ? `, ${worker.name.split(' ')[0]}` : ''}</b><span className="soft">{worker?.tradeNameEn ?? 'Your work'}</span></div><LangSwitch fallback="ur" /><ExitBtn /></header>
    <main className="col g12 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
      {worker && <div className="card row sb" style={{ padding: 14, borderRadius: 16 }}><div className="col g4"><b>Work availability</b><span className="soft">{worker.status === 'OFF' ? 'You are hidden from customers' : worker.status === 'BUSY' ? 'You have an active job' : 'Customers can request you'}</span></div><button type="button" className={`pill ${worker.status === 'FREE' ? 'free' : 'busy'}`} disabled={worker.status === 'BUSY'} onClick={() => void toggleAvailability()}>{worker.status === 'OFF' ? 'Go available' : worker.status === 'BUSY' ? 'Busy' : 'Go offline'}</button></div>}
      <h2 className="b bold">Requests and active jobs</h2>
      {loading && <p aria-live="polite">Loading your requests…</p>}
      {!loading && jobs.length === 0 && <div className="card col g8" style={{ padding: 18, borderRadius: 18 }}><b>No open requests yet</b><span className="soft">New customer requests appear here automatically.</span></div>}
      {jobs.map((job) => <article key={job.id} className="card col g12" style={{ padding: 16, borderRadius: 18, flex: 'none' }}>
        <div className="row sb g8"><b>{job.trade.nameEn} · {job.customer.name}</b><span className="pill busy">{job.status.replaceAll('_', ' ')}</span></div>
        <span>{job.description.raw}</span><span className="soft">{job.customer.addressLabel}</span>
        {job.price.amount !== null && <b>Proposed: Rs {job.price.amount.toLocaleString()} {job.price.unit}</b>}
        <div className="row g8 wrap">
          {job.status === 'REQUESTED' && <button className="btn btn-ok" disabled={busyId === job.id} onClick={() => void act(job, 'accept')}>Accept request</button>}
          {job.status === 'ACCEPTED' && <button className="btn btn-ok" disabled={busyId === job.id} onClick={() => void act(job, 'price')}>{job.price.amount ? 'Update price proposal' : 'Propose a fair price'}</button>}
          {job.status === 'PRICE_AGREED' && <button className="btn btn-ok" disabled={busyId === job.id} onClick={() => void act(job, 'start')}>Start this job</button>}
          {job.status === 'IN_PROGRESS' && <button className="btn btn-ok" disabled={busyId === job.id} onClick={() => void act(job, 'complete')}>Mark complete</button>}
          <Link className="btn btn-o" href={`/worker/chat?jobId=${job.id}`}>Open chat</Link>
        </div>
      </article>)}
      {error && <p role="alert" style={{ color: '#b3162b' }}>{error}</p>}
      {worker && <p className="xs soft">Signed in as {worker.name}. Data is read from your backend.</p>}
    </main>
  </Screen></Stage>;
}
