'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Stage from '@/components/stage';
import { ExitBtn, LangSwitch, Screen } from '@/components/ui';
import JobChat from '@/components/job-chat';

/**
 * The job id comes from the URL (?jobId=…). It is read with useSearchParams
 * rather than copied into state inside an effect, so there is no extra render
 * and no `react-hooks/set-state-in-effect` violation. App Router requires that
 * hook to sit inside a Suspense boundary.
 */
function ChatBody() {
  const jobId = useSearchParams().get('jobId') ?? '';
  return jobId ? (
    <JobChat jobId={jobId} actor="worker" />
  ) : (
    <p>Open a job request from your dashboard to start chatting.</p>
  );
}

export default function WorkerChatPage() {
  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w8" extra="rr-screen">
        <header className="top">
          <div className="col fx">
            <h1 className="t">Customer chat</h1>
            <span className="soft">Messages are translated for both sides</span>
          </div>
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>
        <main className="col g12 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
          <Suspense fallback={<p aria-live="polite">Loading the chat…</p>}>
            <ChatBody />
          </Suspense>
          <Link className="btn btn-o" href="/worker/home">
            Back to requests
          </Link>
        </main>
      </Screen>
    </Stage>
  );
}
