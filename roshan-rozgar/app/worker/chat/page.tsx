'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { ExitBtn, LangSwitch, Screen } from '@/components/ui';
import JobChat from '@/components/job-chat';

export default function WorkerChatPage() {
  const [jobId, setJobId] = useState('');
  useEffect(() => { setJobId(new URLSearchParams(window.location.search).get('jobId') ?? ''); }, []);
  return <Stage><Screen skin="work" defaultLang="ur" id="s-w8" extra="rr-screen">
    <header className="top"><div className="col fx"><h1 className="t">Customer chat</h1><span className="soft">Messages are translated for both sides</span></div><LangSwitch fallback="ur" /><ExitBtn /></header>
    <main className="col g12 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
      {jobId ? <JobChat jobId={jobId} actor="worker" /> : <p>Open a job request from your dashboard to start chatting.</p>}
      <Link className="btn btn-o" href="/worker/home">Back to requests</Link>
    </main>
  </Screen></Stage>;
}
