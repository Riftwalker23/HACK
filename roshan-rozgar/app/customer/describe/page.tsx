'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { api, saveSearch, signInDemo, type Classification } from '@/lib/client-api';

type Upload = { url: string; kind: string; bytes: number };

export default function DescribePage() {
  const { lang } = useLang('en');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'text' | 'voice' | 'photo'>('text');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Classification | null>(null);

  const labels = lang === 'ur'
    ? { title: 'کیا کام کروانا ہے؟', hint: 'مسئلہ اپنے الفاظ میں لکھیں یا تصویر لگائیں۔', describe: 'مسئلہ بتائیں', photo: 'تصویر شامل کریں', find: 'قریب کاریگر تلاش کریں', analyzing: 'مسئلہ سمجھ رہے ہیں…', understood: 'AI نے یہ سمجھا', remove: 'تصویر ہٹائیں' }
    : lang === 'rm'
      ? { title: 'Kya kaam karwana hai?', hint: 'Masla apne alfaaz mein likhein ya tasveer lagayein.', describe: 'Masla batayein', photo: 'Tasveer lagayein', find: 'Qareeb kaarigar dhoondein', analyzing: 'Masla samajh rahe hain…', understood: 'AI ne yeh samjha', remove: 'Tasveer hatayein' }
      : { title: 'What needs fixing?', hint: 'Describe the problem in your own words or add a photo.', describe: 'Describe the problem', photo: 'Add a photo', find: 'Find nearby workers', analyzing: 'Understanding the problem…', understood: 'AI understood', remove: 'Remove photo' };

  async function findWorkers() {
    setError('');
    if (description.trim().length < 3 && !file) {
      setError(lang === 'ur' ? 'براہ کرم مسئلہ لکھیں یا تصویر شامل کریں۔' : 'Describe the problem or add a photo first.');
      return;
    }
    setBusy(true);
    try {
      await signInDemo('customer');
      let photoUrl: string | undefined;
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploaded = await fetch('/api/upload', { method: 'POST', body: form });
        const payload = await uploaded.json() as { ok: boolean; data?: Upload; error?: { message: string } };
        if (!uploaded.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? 'Photo upload failed.');
        photoUrl = payload.data.url;
      }
      const { data } = await api<Classification>('/api/ai/classify-problem', {
        method: 'POST',
        body: JSON.stringify({ text: description.trim() || undefined, imageUrl: photoUrl }),
      });
      setResult(data);
      saveSearch({ description: description.trim() || data.likelyFix, source: file ? 'photo' : source, photoUrl, classification: data });
      router.push('/customer/results');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the service. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c1" extra="rr-screen">
        <header className="top">
          <span className="row g4 l bold fx"><Icon name="i-pin" cls="s20 tl" /> G-11, Islamabad</span>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>
        <main className="col g16 fx px" style={{ paddingBottom: 18, overflowY: 'auto' }}>
          <h1 className="t">{labels.title}</h1>
          <p className="l soft" style={{ marginTop: -10 }}>{labels.hint}</p>
          <label className="col g8 l bold" htmlFor="job-description">{labels.describe}
            <textarea id="job-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} placeholder="e.g. The kitchen tap is leaking" style={{ resize: 'vertical', minHeight: 112, border: '2px solid var(--line)', borderRadius: 16, padding: 14, font: 'inherit', color: 'var(--ink)', background: 'var(--surface, #fff)' }} />
          </label>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { setFile(event.target.files?.[0] ?? null); if (event.target.files?.[0]) setSource('photo'); }} />
          {file ? <div className="row sb card" style={{ padding: 12, borderRadius: 14 }}><span className="l fx">{file.name}</span><button type="button" className="see" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}>{labels.remove}</button></div> : <button type="button" className="btn btn-o" onClick={() => inputRef.current?.click()}><Icon name="i-cam" />{labels.photo}</button>}
          {result && <div className="card col g4" style={{ padding: 14, borderRadius: 16 }}><b>{labels.understood}</b><span>{result.tradeSlug} · {result.likelyFix}</span><small className="soft">AI: {result.provider} · {Math.round(result.confidence * 100)}%</small></div>}
          {error && <p role="alert" style={{ color: '#b3162b', margin: 0 }}>{error}</p>}
          <p className="xs soft">Your request is sent to your backend. The demo customer is Ayesha Siddiqui.</p>
        </main>
        <div className="dock">
          <button type="button" className="btn btn-t" style={{ minHeight: 56 }} disabled={busy} onClick={findWorkers}>
            <Icon name="i-search" cls="s24" />{busy ? labels.analyzing : labels.find}
          </button>
        </div>
      </Screen>
    </Stage>
  );
}
