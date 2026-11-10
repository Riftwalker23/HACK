'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/client-api';

type ChatMessage = { id: string; sender: 'worker' | 'customer'; kind: string; transcriptEn: string | null; transcriptUr: string | null; createdAt: string };

export default function JobChat({ jobId, actor }: { jobId: string; actor: 'worker' | 'customer' }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  /** Fetches the thread; callers set state once it resolves. */
  const fetchMessages = useCallback(async () => {
    const { data } = await api<{ messages: ChatMessage[] }>(`/api/messages?jobId=${jobId}`);
    return data.messages;
  }, [jobId]);

  useEffect(() => {
    let mounted = true;
    const load = () => fetchMessages().then((rows) => { if (mounted) setMessages(rows); });
    void load().catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : 'Could not load chat.'); });
    const timer = window.setInterval(() => { void load().catch(() => undefined); }, 4000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [fetchMessages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true); setError('');
    try {
      await api('/api/messages', { method: 'POST', body: JSON.stringify({ jobId, sender: actor, kind: 'text', text: text.trim(), language: actor === 'worker' ? 'ur' : 'en' }) });
      setText(''); setMessages(await fetchMessages());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be sent.'); }
    finally { setSending(false); }
  }

  return <section className="col g8" aria-label="Job chat">
    <h2 className="b bold">Chat · translated messages</h2>
    <div className="col g8" style={{ maxHeight: 220, overflowY: 'auto' }} aria-live="polite">
      {messages.length === 0 && <p className="soft">No messages yet. Send a message to get started.</p>}
      {messages.map((message) => <div key={message.id} className="card" style={{ alignSelf: message.sender === actor ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: 12, borderRadius: 14 }}>
        <small className="soft">{message.sender === 'worker' ? 'Worker · Urdu' : 'Customer · English'}</small>
        <div>{actor === 'worker' ? message.transcriptUr || message.transcriptEn : message.transcriptEn || message.transcriptUr}</div>
      </div>)}
    </div>
    <form onSubmit={send} className="row g8">
      <input value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder={actor === 'worker' ? 'پیغام لکھیں' : 'Write a message'} aria-label="Message" style={{ flex: 1, minWidth: 0, border: '2px solid var(--line)', borderRadius: 14, padding: '12px 14px', font: 'inherit' }} />
      <button className="btn btn-t" disabled={sending || !text.trim()}>{sending ? '…' : 'Send'}</button>
    </form>
    {error && <small role="alert" style={{ color: '#b3162b' }}>{error}</small>}
  </section>;
}
