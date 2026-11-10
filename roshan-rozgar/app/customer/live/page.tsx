'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, LangSwitch, Screen } from '@/components/ui';
import JobChat from '@/components/job-chat';
import { api } from '@/lib/client-api';

type Job = {
  id: string; status: string; worker: { name: string; phone: string; area: string };
  customer: { addressLabel: string }; trade: { nameEn: string };
  description: { raw: string };
  price: { amount: number | null; unit: string | null; confirmedByCustomer: boolean; confirmedByWorker: boolean };
};

export default function LivePage() {
  const { lang } = useLang('en');
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const refresh = useCallback(async (id: string) => {
    const { data } = await api<Job>(`/api/jobs/${id}`);
    setJob(data); setError('');
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('jobId') || (() => {
      try { return (JSON.parse(localStorage.getItem('rr_active_job') ?? 'null') as { id?: string } | null)?.id ?? ''; } catch { return ''; }
    })();
    setJobId(id);
    if (!id) { setError('No booking selected. Find a worker first.'); return; }
    let mounted = true;
    void refresh(id).catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : 'Could not load job.'); });
    const timer = window.setInterval(() => { void refresh(id).catch(() => undefined); }, 4000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [refresh]);

  async function confirmPrice() {
    if (!jobId) return;
    setWorking(true); setError('');
    try { await api(`/api/jobs/${jobId}/price`, { method: 'POST', body: JSON.stringify({ mode: 'confirm', actor: 'customer', confirm: true }) }); await refresh(jobId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Price confirmation failed.'); }
    finally { setWorking(false); }
  }

  const labels = lang === 'ur'
    ? { title: 'آپ کی درخواست', status: 'موجودہ حالت', waiting: 'کاریگر کے جواب کا انتظار ہے…', price: 'قیمت منظور کریں', progress: 'کام مکمل' }
    : { title: 'Your booking', status: 'Current status', waiting: 'Waiting for the worker to respond…', price: 'Agree to this price', progress: 'Job progress' };

  return <Stage><Screen skin="cust" defaultLang="en" id="s-c5" extra="rr-screen">
    <header className="top"><h1 className="b bold fx">{labels.title}</h1><LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} /><ExitBtn /></header>
    <main className="col g12 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
      {error && <p role="alert" style={{ color: '#b3162b' }}>{error}</p>}
      {!job && !error && <p>{labels.waiting}</p>}
      {job && <>
        <div className="card col g8" style={{ padding: 16, borderRadius: 18 }}>
          <span className="soft">{labels.status}</span><b style={{ fontSize: 22 }}>{job.status.replaceAll('_', ' ')}</b>
          <span>{job.trade.nameEn} · {job.description.raw}</span>
          <span>Worker: {job.worker.name} · {job.worker.area}</span>
          <span>Address: {job.customer.addressLabel}</span>
          {job.price.amount !== null && <div className="row sb"><b>Rs {job.price.amount.toLocaleString()} {job.price.unit}</b>{job.price.confirmedByCustomer ? <span className="pill free">You agreed</span> : <button className="btn btn-t" disabled={working} onClick={() => void confirmPrice()}>{labels.price}</button>}</div>}
        </div>
        <div className="col g8"><b>{labels.progress}</b><div className="row sb l"><span>Requested</span><span>Accepted</span><span>In progress</span><span>Done</span></div><div className="rail"><span className="n done"/><span className="ln done"/><span className={`n ${['ACCEPTED','PRICE_AGREED','IN_PROGRESS','COMPLETED'].includes(job.status) ? 'done' : ''}`}/><span className="ln"/><span className={`n ${job.status === 'IN_PROGRESS' || job.status === 'COMPLETED' ? 'done' : ''}`}/><span className="ln"/><span className={`n ${job.status === 'COMPLETED' ? 'done' : ''}`}/></div></div>
        <JobChat jobId={job.id} actor="customer" />
        {job.status === 'COMPLETED' && <Link className="btn btn-t" href={`/customer/review?jobId=${job.id}`}>Leave a review</Link>}
      </>}
      {!job && <Link className="btn btn-t" href="/customer/describe">Find a worker</Link>}
    </main>
  </Screen></Stage>;
}
