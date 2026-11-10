'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { AiChip, aiProvider } from '@/components/customer/ai-chip';
import { Wave } from '@/components/voice/wave';
import { useVoiceInput, type Transcript } from '@/lib/voice/use-voice-input';
import { api, getSession, saveSearch, signInDemo, type Classification } from '@/lib/client-api';
import { useBrowserValue } from '@/lib/customer/client-store';

type Upload = { url: string; kind: string; bytes: number };

/** Voice-mode copy. The text/photo copy below is kept exactly as it was. */
const D: Record<Lang, Record<string, string>> = {
  ur: { speak: 'بول کر بتائیں', tap: 'مائیک دبائیں اور مسئلہ بولیں', listening: 'سن رہے ہیں… ختم کرنے کے لیے دوبارہ دبائیں', transcribing: 'آپ کی بات لکھ رہے ہیں…', classifying: 'مسئلہ سمجھ رہے ہیں…', heard: 'ہم نے یہ سنا', heardNote: 'سنا گیا', again: 'دوبارہ بولیں', retry: 'دوبارہ کوشش کریں', orType: 'یا نیچے لکھیں', noMic: 'اس براؤزر میں آواز ریکارڈ نہیں ہو سکتی۔ براہ کرم نیچے لکھیں یا تصویر لگائیں۔', micErr: 'آواز سے بتانا نہیں ہو سکا', empty: 'کوئی الفاظ سنائی نہیں دیے۔ فون کے قریب ہو کر دوبارہ بولیں۔', classifyErr: 'مسئلہ سمجھ نہیں سکے', lang: 'آپ کس زبان میں بولیں گے؟', ur: 'اردو', en: 'English', micLabel: 'مسئلہ بول کر بتائیں', stopLabel: 'ریکارڈنگ ختم کریں' },
  rm: { speak: 'Bol kar batayein', tap: 'Mic dabayein aur masla bolein', listening: 'Sun rahe hain… khatam karne ke liye dobara dabayein', transcribing: 'Aap ki baat likh rahe hain…', classifying: 'Masla samajh rahe hain…', heard: 'Humne yeh suna', heardNote: 'suna gaya', again: 'Dobara bolein', retry: 'Dobara koshish karein', orType: 'Ya neeche likhein', noMic: 'Is browser mein awaaz record nahi ho sakti. Neeche likhein ya tasveer lagayein.', micErr: 'Awaaz se batana nahi ho saka', empty: 'Koi alfaaz sunai nahi diye. Phone ke qareeb ho kar dobara bolein.', classifyErr: 'Masla samajh nahi sake', lang: 'Aap kis zabaan mein bolenge?', ur: 'Urdu', en: 'English', micLabel: 'Masla bol kar batayein', stopLabel: 'Recording khatam karein' },
  en: { speak: 'Say it instead', tap: 'Tap the microphone and describe the problem', listening: 'Listening… tap again to finish', transcribing: 'Writing down what you said…', classifying: 'Understanding the problem…', heard: 'What we heard', heardNote: 'heard', again: 'Speak again', retry: 'Try again', orType: 'Or type it below', noMic: 'This browser cannot record audio. Please type the problem or add a photo below.', micErr: 'Voice input did not work', empty: 'We could not hear any words. Move closer to the phone and try again.', classifyErr: 'Could not understand the problem', lang: 'Which language will you speak?', ur: 'Urdu', en: 'English', micLabel: 'Describe the problem by voice', stopLabel: 'Finish recording' },
};

/** "What the AI understood" card, shared by the typed, photo and spoken paths. */
function Understood({ title, result, provider }: { title: string; result: Classification; provider?: string | null }) {
  return (
    <div className="card col g4" style={{ padding: 14, borderRadius: 16 }}>
      <b>{title}</b>
      <span>{result.tradeSlug} · {result.likelyFix}</span>
      <span className="row g8"><AiChip provider={provider ?? result.provider} /><small className="soft">{Math.round(result.confidence * 100)}%</small></span>
    </div>
  );
}

const fmtSecs = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function DescribePage() {
  const { lang } = useLang('en');
  const v = D[lang];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'text' | 'voice' | 'photo'>('text');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Classification | null>(null);
  // The saved session's address, read during render (empty on the server render).
  const where = useBrowserValue(() => getSession('customer')?.addressLabel ?? '', '');
  const inBrowser = useBrowserValue(() => true, false);

  // ---- Speak mode ----
  const [speakLang, setSpeakLang] = useState<'ur' | 'en'>('ur');
  const [heard, setHeard] = useState<Transcript | null>(null);
  const [voiceResult, setVoiceResult] = useState<{ data: Classification; provider: string | null } | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState('');
  const [voiceNote, setVoiceNote] = useState('');

  /** The words to classify and to save as the description. */
  const spokenText = (t: Transcript) => (t.textUr.trim() || t.textRoman.trim()).slice(0, 2000);

  async function classifySpoken(t: Transcript) {
    setClassifying(true); setClassifyError(''); setVoiceResult(null);
    try {
      const { data, meta } = await api<Classification>('/api/ai/classify-problem', {
        method: 'POST',
        body: JSON.stringify({ text: spokenText(t) }),
      });
      setVoiceResult({ data, provider: aiProvider(meta) ?? data.provider ?? null });
    } catch (cause) {
      setClassifyError(cause instanceof Error ? cause.message : 'Could not connect to the service. Please try again.');
    } finally {
      setClassifying(false);
    }
  }

  const voice = useVoiceInput({
    language: speakLang,
    onTranscript: async (t) => {
      if (!spokenText(t)) { setHeard(null); setVoiceNote(v.empty); return; }
      setVoiceNote('');
      setHeard(t);
      await classifySpoken(t);
    },
  });

  function startOrStop() {
    if (voice.phase === 'idle' || voice.phase === 'error') {
      // A fresh recording replaces the previous attempt.
      setVoiceNote(''); setClassifyError(''); setHeard(null); setVoiceResult(null);
      voice.clearError();
    }
    void voice.toggle();
  }

  // Proceed with the spoken description only when nothing was typed or attached since.
  const proceedSpoken = !!heard && !!voiceResult && !description.trim() && !file;

  async function proceedWithVoice() {
    if (!heard || !voiceResult) return;
    setError('');
    setBusy(true);
    try {
      await signInDemo('customer');
      saveSearch({ description: spokenText(heard), source: 'voice', classification: { ...voiceResult.data, provider: voiceResult.provider ?? voiceResult.data.provider } });
      router.push('/customer/results');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the service. Please try again.');
    } finally {
      setBusy(false);
    }
  }

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

  const recording = voice.phase === 'recording';
  const transcribing = voice.phase === 'transcribing';
  const voiceBusy = recording || transcribing || classifying;
  const voiceError = voice.phase === 'error' ? voice.error : null;
  // `supported` is false on the server render too; only call it unsupported once we are in the browser.
  const micUnsupported = inBrowser && !voice.supported;

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c1" extra="rr-screen">
        <header className="top">
          <span className="row g4 l bold fx"><Icon name="i-pin" cls="s20 tl" /> {where || '—'}</span>
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>
        <main className="col g16 fx px" style={{ paddingBottom: 18, overflowY: 'auto' }}>
          <h1 className="t">{labels.title}</h1>
          <p className="l soft" style={{ marginTop: -10 }}>{labels.hint}</p>

          {/* ---- Speak mode ---- */}
          <section className="card col g12" aria-label={v.speak} style={{ padding: 14, borderRadius: 18, flex: 'none', alignItems: 'center' }}>
            <span className="l bold row g8" style={{ alignSelf: 'stretch' }}><Icon name="i-mic" cls="s20" />{v.speak}</span>
            {micUnsupported ? (
              <p className="l soft" role="status" style={{ alignSelf: 'stretch' }}>{v.noMic}</p>
            ) : (
              <>
                <div className="row g8" role="radiogroup" aria-label={v.lang} style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
                  {(['ur', 'en'] as const).map((l) => (
                    <button type="button" key={l} className={`tm ${speakLang === l ? 'on' : ''}`.trim()} role="radio" aria-checked={speakLang === l} disabled={voiceBusy} onClick={() => setSpeakLang(l)} style={{ minHeight: 44 }}>
                      <span lang={l}>{v[l]}</span>
                    </button>
                  ))}
                </div>
                <div className="orb">
                  <button type="button" className="mic" aria-label={recording ? v.stopLabel : v.micLabel} aria-pressed={recording} disabled={transcribing || classifying || busy} onClick={startOrStop}>
                    <Icon name={recording ? 'i-chk' : 'i-mic'} cls="lg" />
                  </button>
                </div>
                {recording && <Wave level={voice.level} active />}
                <p className="l bold" aria-live="polite" style={{ textAlign: 'center' }}>
                  {recording ? <>{v.listening} <span className="num soft" dir="ltr">{fmtSecs(voice.elapsedMs)}</span></>
                    // classification runs inside onTranscript, while the hook still reports 'transcribing'
                    : classifying ? v.classifying
                      : transcribing ? v.transcribing
                        : !heard && !voiceError && !voiceNote ? v.tap : null}
                </p>
              </>
            )}

            {(voiceError || voiceNote) && (
              <div className="col g8" role="alert" style={{ alignSelf: 'stretch' }}>
                <b style={{ color: '#b3162b' }}>{voiceNote ? voiceNote : v.micErr}</b>
                {voiceError && <span className="l soft">{voiceError}</span>}
                <div className="row g8">
                  <button type="button" className="btn btn-o fx" style={{ minHeight: 44 }} onClick={startOrStop}><Icon name="i-mic" cls="s20" />{v.retry}</button>
                  <button type="button" className="btn btn-o fx" style={{ minHeight: 44 }} onClick={() => textRef.current?.focus()}><Icon name="i-kb" cls="s20" />{v.orType}</button>
                </div>
              </div>
            )}

            {heard && (
              <div className="col g4" style={{ alignSelf: 'stretch' }} aria-live="polite">
                <span className="row sb"><span className="l bold soft">{v.heard}</span><AiChip provider={heard.provider} note={v.heardNote} /></span>
                {heard.textUr.trim() && <p className="b" lang={speakLang} dir={speakLang === 'ur' ? 'rtl' : 'ltr'}>{heard.textUr}</p>}
                {heard.textRoman.trim() && heard.textRoman.trim() !== heard.textUr.trim() && <p className="l soft" lang={speakLang === 'ur' ? 'ur-Latn' : 'en'} dir="ltr">{heard.textRoman}</p>}
              </div>
            )}

            {heard && classifyError && (
              <div className="col g8" role="alert" style={{ alignSelf: 'stretch' }}>
                <b style={{ color: '#b3162b' }}>{v.classifyErr}</b>
                <span className="l soft">{classifyError}</span>
                <button type="button" className="btn btn-o" style={{ minHeight: 44 }} disabled={classifying} onClick={() => void classifySpoken(heard)}><Icon name="i-replay" cls="s20" />{v.retry}</button>
              </div>
            )}

            {heard && voiceResult && <div style={{ alignSelf: 'stretch' }} aria-live="polite"><Understood title={labels.understood} result={voiceResult.data} provider={voiceResult.provider} /></div>}

            {heard && !voiceBusy && !voiceError && <button type="button" className="btn btn-o" style={{ minHeight: 44, alignSelf: 'stretch' }} onClick={startOrStop}><Icon name="i-mic" cls="s20" />{v.again}</button>}
          </section>

          <label className="col g8 l bold" htmlFor="job-description">{labels.describe}
            <textarea ref={textRef} id="job-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={2000} placeholder="e.g. The kitchen tap is leaking" style={{ resize: 'vertical', minHeight: 112, border: '2px solid var(--line)', borderRadius: 16, padding: 14, font: 'inherit', color: 'var(--ink)', background: 'var(--surface, #fff)' }} />
          </label>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { setFile(event.target.files?.[0] ?? null); if (event.target.files?.[0]) setSource('photo'); }} />
          {file ? <div className="row sb card" style={{ padding: 12, borderRadius: 14 }}><span className="l fx">{file.name}</span><button type="button" className="see" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}>{labels.remove}</button></div> : <button type="button" className="btn btn-o" onClick={() => inputRef.current?.click()}><Icon name="i-cam" />{labels.photo}</button>}
          {result && <Understood title={labels.understood} result={result} />}
          {error && <p role="alert" style={{ color: '#b3162b', margin: 0 }}>{error}</p>}
          <p className="xs soft">Your request is sent to your backend. The demo customer is Ayesha Siddiqui.</p>
        </main>
        <div className="dock">
          <button type="button" className="btn btn-t" style={{ minHeight: 56 }} disabled={busy || (voiceBusy && !description.trim() && !file)} onClick={() => void (proceedSpoken ? proceedWithVoice() : findWorkers())}>
            <Icon name="i-search" cls="s24" />{busy ? labels.analyzing : labels.find}
          </button>
        </div>
      </Screen>
    </Stage>
  );
}
