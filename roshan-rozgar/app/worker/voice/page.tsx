'use client';

/**
 * W2 · Voice onboarding 1/4 — `W2-Voice.dc.html` on the canvas.
 *
 * The question is spoken on load. Tap the mic, speak, tap again: the clip is
 * transcribed (/api/ai/transcribe), shown live under "You said", then
 * /api/ai/extract-profile fills the trade / years / area / name chips. Anything
 * still missing is asked for aloud. The keyboard is the fallback (and opens by
 * itself when there is no microphone or it failed).
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen } from '@/components/ui';
import { Wave } from '@/components/voice/wave';
import { AiChip } from '@/components/worker/ai-chip';
import { ErrorNote, SayBtn, TypeBox, useSpeakOnLoad } from '@/components/worker/onboarding-ui';
import { useVoiceInput } from '@/lib/voice/use-voice-input';
import { speakAloud, stopAloud } from '@/lib/speech';
import { tradeClass, tradeGlyph, tradeName } from '@/lib/worker/trades';
import {
  addClip,
  extractProfile,
  followUpQuestion,
  getDraft,
  hasTranscript,
  mergeExtraction,
  spokenText,
  transcriptOf,
  updateDraft,
  useDraft,
} from '@/lib/worker/onboarding';

const D = {
  ur: {
    q: 'آپ کیا کام کرتے ہیں؟',
    hint: 'مائیک دبا کر بولیں: آپ کا نام، کام، کتنے سال سے، اور کس علاقے میں۔',
    heard: 'آپ نے کہا',
    filling: 'خود بخود بھر رہا ہے',
    yrs: 'سال',
    listening: 'سن رہے ہیں… بات ختم ہو تو دوبارہ دبائیں',
    writing: 'آپ کی بات لکھ رہے ہیں…',
    understanding: 'سمجھ رہے ہیں…',
    tapTalk: 'مائیک دبائیں اور بولیں',
    tapMore: 'مزید بتانے کے لیے مائیک دبائیں',
    mic: 'مائیک: بولنا شروع کریں',
    micStop: 'بات ختم، بھیجیں',
    type: 'لکھ کر بتائیں',
    typeHint: 'یہاں لکھیں: میرا نام…، میں … کا کام کرتا ہوں',
    send: 'بھیجیں',
    next: 'ٹھیک ہے، آگے',
    needAnswer: 'پہلے مائیک دبا کر بتائیں کہ آپ کیا کام کرتے ہیں۔',
    again: 'سوال دوبارہ سنیں',
    step: 'مرحلہ 1 از 4',
    read: 'یہ صفحہ سنیں',
    errHear: 'آواز سمجھ نہیں آئی۔ دوبارہ مائیک دبا کر بولیں، یا لکھ کر بتائیں۔',
    errMic: 'اس فون پر مائیک نہیں چل رہا۔ آپ لکھ کر بتا سکتے ہیں۔',
    errUnderstand: 'آپ کی بات محفوظ ہے، لیکن ابھی سمجھ نہیں سکے۔ دوبارہ کوشش کریں۔',
    retryRec: 'دوبارہ بولیں',
    retryExtract: 'دوبارہ سمجھیں',
    gotIt: 'شکریہ! سب سمجھ آ گیا۔ آگے جانے کے لیے ہرا نشان دبائیں۔',
  },
  rm: {
    q: 'Aap kya kaam karte hain?',
    hint: 'Mic daba kar bolein: aap ka naam, kaam, kitne saal se, aur kis ilaqe mein.',
    heard: 'Aap ne kaha',
    filling: 'Khud ba khud bhar raha hai',
    yrs: 'saal',
    listening: 'Sun rahe hain… baat khatam ho to dobara dabayein',
    writing: 'Aap ki baat likh rahe hain…',
    understanding: 'Samajh rahe hain…',
    tapTalk: 'Mic dabayein aur bolein',
    tapMore: 'Mazeed batane ke liye mic dabayein',
    mic: 'Mic: bolna shuru karein',
    micStop: 'Baat khatam, bhejein',
    type: 'Likh kar batayein',
    typeHint: 'Yahan likhein: mera naam…, main … ka kaam karta hoon',
    send: 'Bhejein',
    next: 'Theek hai, aage',
    needAnswer: 'Pehle mic daba kar batayein ke aap kya kaam karte hain.',
    again: 'Sawal dobara sunein',
    step: 'Marhala 1 az 4',
    read: 'Yeh safha sunein',
    errHear: 'Awaaz samajh nahi aayi. Dobara mic daba kar bolein, ya likh kar batayein.',
    errMic: 'Is phone par mic nahi chal raha. Aap likh kar bata sakte hain.',
    errUnderstand: 'Aap ki baat mehfooz hai, lekin abhi samajh nahi sake. Dobara koshish karein.',
    retryRec: 'Dobara bolein',
    retryExtract: 'Dobara samjhein',
    gotIt: 'Shukriya! Sab samajh aa gaya. Aage jaane ke liye hara nishan dabayein.',
  },
  en: {
    q: 'What work do you do?',
    hint: 'Tap the mic and say: your name, your work, for how many years, and in which area.',
    heard: 'You said',
    filling: 'Filling in by itself',
    yrs: 'years',
    listening: 'Listening… tap again when you finish',
    writing: 'Writing down your words…',
    understanding: 'Understanding…',
    tapTalk: 'Tap the mic and speak',
    tapMore: 'Tap the mic to add more',
    mic: 'Microphone: start speaking',
    micStop: 'Done, send',
    type: 'Type instead',
    typeHint: 'Type here: my name is…, I do … work',
    send: 'Send',
    next: 'OK, next',
    needAnswer: 'First tap the mic and tell us what work you do.',
    again: 'Hear the question again',
    step: 'Step 1 of 4',
    read: 'Read this page aloud',
    errHear: 'We could not understand that. Tap the mic and speak again, or type it.',
    errMic: 'The microphone is not working on this phone. You can type instead.',
    errUnderstand: 'Your words are saved, but we could not understand them yet. Try again.',
    retryRec: 'Speak again',
    retryExtract: 'Try understanding again',
    gotIt: 'Thank you! We have everything. Tap the green tick to go on.',
  },
};

type Extract = { status: 'idle' | 'loading' | 'error'; error?: string };

export default function VoicePage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const router = useRouter();
  const draft = useDraft();
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [ex, setEx] = useState<Extract>({ status: 'idle' });
  const typeRef = useRef<HTMLTextAreaElement>(null);

  useSpeakOnLoad(`${t.q} ${t.hint}`, lang);

  /** Re-reads the whole interview so far and folds the result into the draft. */
  const runExtract = async () => {
    const transcript = transcriptOf(getDraft());
    if (!transcript) return;
    setEx({ status: 'loading' });
    try {
      const { profile, provider } = await extractProfile(transcript);
      const next = updateDraft((d) => mergeExtraction(d, profile, provider, 'all'));
      setEx({ status: 'idle' });
      const follow = followUpQuestion(next.missing, lang);
      void speakAloud(follow || t.gotIt, lang);
    } catch (err) {
      setEx({ status: 'error', error: (err as Error).message });
      void speakAloud(t.errUnderstand, lang);
    }
  };

  const voice = useVoiceInput({
    language: lang === 'en' ? 'en' : 'ur',
    onTranscript: async (tr) => {
      addClip({ textUr: tr.textUr, textRoman: tr.textRoman, provider: tr.provider });
      await runExtract();
    },
  });

  const recording = voice.phase === 'recording';
  const transcribing = voice.phase === 'transcribing';
  const extracting = ex.status === 'loading';
  const busy = transcribing || extracting;
  const micFailed = !voice.supported || voice.phase === 'error';
  const showType = typing || micFailed;
  const said = spokenText(draft, lang);
  const lastProvider = draft.clips.length ? draft.clips[draft.clips.length - 1]!.provider : null;
  const ready = hasTranscript(draft);

  // A blocked microphone and a failed transcription need different words: "we
  // could not understand you" is wrong when nothing was recorded at all.
  const voiceMessage = voice.micBlocked ? t.errMic : t.errHear;
  // Once he has answered by typing, a stale "mic blocked" note is noise, not help.
  const showVoiceError = voice.phase === 'error' && !(voice.micBlocked && ready);

  // A microphone / transcription failure is said aloud, not only shown.
  useEffect(() => {
    if (voice.phase === 'error' && voice.error) void speakAloud(voiceMessage, lang);
  }, [voice.phase, voice.error, voiceMessage, lang]);

  const onMic = async () => {
    if (!voice.supported) {
      setTyping(true);
      void speakAloud(t.errMic, lang);
      return;
    }
    if (busy) return;
    if (!recording) stopAloud(); // never record our own voice
    await voice.toggle();
  };

  const onKeyboard = () => {
    const open = !typing;
    setTyping(open);
    if (open) requestAnimationFrame(() => typeRef.current?.focus());
  };

  const submitTyped = async () => {
    const text = typed.trim();
    if (!text || busy) return;
    setTyped('');
    addClip({ textUr: text, textRoman: text, provider: 'typed' });
    await runExtract();
  };

  const onNext = () => {
    if (!ready) {
      void speakAloud(t.needAnswer, lang);
      return;
    }
    router.push('/worker/trade');
  };

  const status = recording
    ? `${t.listening} ${Math.floor(voice.elapsedMs / 1000)}s`
    : transcribing
      ? t.writing
      : extracting
        ? t.understanding
        : ready
          ? t.tapMore
          : t.tapTalk;

  const years = draft.yearsExperience;

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w2" extra="rr-screen">
        <header className="top">
          <SayBtn label={t.read} say={`${t.q} ${t.hint}`} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g16 fx px" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div className="rail" role="img" aria-label={t.step}>
            <span className="n cur">
              <Icon name="i-tools" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-clock" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-pin" cls="s20" />
            </span>
            <span className="ln" />
            <span className="n">
              <Icon name="i-cam" cls="s20" />
            </span>
          </div>

          <section
            className="card col g12"
            style={{ padding: '20px', background: 'var(--tint)', borderColor: 'var(--roshan)' }}
          >
            <div className="row g12">
              <SayBtn
                label={t.again}
                say={`${t.q} ${t.hint}`}
                lang={lang}
                icon="i-replay"
                style={{ borderColor: 'var(--roshan)', background: 'var(--surface)' }}
              />
              <h1 className="t nq fx">{t.q}</h1>
            </div>
          </section>

          <section className="col g8" aria-live="polite" aria-busy={busy}>
            <div className="row sb">
              <span className="l soft">{t.heard}</span>
              <AiChip provider={lastProvider === 'typed' ? null : lastProvider} />
            </div>
            <p className="b bold" style={{ minHeight: '90px', overflowWrap: 'anywhere' }}>
              {said ? (
                <>“{said}”</>
              ) : (
                <span className="soft" style={{ fontWeight: 600 }}>
                  {recording ? t.listening : transcribing ? t.writing : t.hint}
                </span>
              )}
              {(recording || transcribing) && (
                <span
                  className="rr-caret"
                  style={{
                    display: 'inline-block',
                    width: '3px',
                    height: '1.1em',
                    background: 'var(--roshan)',
                    verticalAlign: 'middle',
                    marginInlineStart: '4px',
                  }}
                />
              )}
            </p>
          </section>

          {showVoiceError && (
            <ErrorNote
              lang={lang}
              message={voiceMessage}
              detail={voice.error}
              onRetry={() => void onMic()}
              retryLabel={t.retryRec}
            />
          )}

          {ex.status === 'error' && (
            <ErrorNote
              lang={lang}
              message={t.errUnderstand}
              detail={ex.error}
              onRetry={() => void runExtract()}
              retryLabel={t.retryExtract}
            />
          )}

          {showType && (
            <TypeBox
              value={typed}
              onChange={setTyped}
              onSubmit={() => void submitTyped()}
              placeholder={t.typeHint}
              sendLabel={t.send}
              busy={busy}
              inputRef={typeRef}
            />
          )}

          <section className="col g8" aria-live="polite">
            <div className="row sb">
              <span className="l soft">{extracting ? t.understanding : t.filling}</span>
              <AiChip provider={draft.extractProvider} />
            </div>
            <div className="row g8 wrap">
              {draft.tradeSlug ? (
                <span className={`chip ${tradeClass(draft.tradeSlug)} rr-rise`} style={{ borderColor: 'var(--c)' }}>
                  <span className="gl s32">
                    <Glyph name={tradeGlyph(draft.tradeSlug)} />
                  </span>
                  {tradeName(draft.tradeSlug, lang)}
                </span>
              ) : (
                <Pending icon="i-tools" />
              )}
              {years !== null ? (
                <span className="chip rr-rise" style={{ borderColor: 'var(--accept)', ['--i' as string]: 1 }}>
                  <Icon name="i-clock" cls="s24" style={{ color: 'var(--accept)' }} />
                  <span className="num">{years}</span> {t.yrs}
                </span>
              ) : (
                <Pending icon="i-clock" i={1} />
              )}
              {draft.area ? (
                <span className="chip rr-rise" style={{ borderColor: 'var(--cobalt)', ['--i' as string]: 2 }}>
                  <Icon name="i-pin" cls="s24" style={{ color: 'var(--cobalt)' }} />
                  {draft.area}
                </span>
              ) : (
                <Pending icon="i-pin" i={2} />
              )}
              {draft.name ? (
                <span className="chip rr-rise" style={{ ['--i' as string]: 3 }}>
                  <Icon name="i-smile" cls="s24" />
                  {draft.name}
                </span>
              ) : (
                <Pending icon="i-smile" i={3} />
              )}
            </div>
          </section>
        </main>

        <div className="dock" style={{ alignItems: 'center', gap: '14px' }}>
          <Wave level={voice.level} active={recording} />
          <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <button
              type="button"
              className="iconbtn"
              aria-label={t.type}
              title={t.type}
              aria-pressed={showType}
              data-no-prompt=""
              onClick={onKeyboard}
              style={showType ? { borderColor: 'var(--roshan-deep)', background: 'var(--tint)' } : undefined}
            >
              <Icon name="i-kb" />
            </button>
            <div className="orb">
              <button
                type="button"
                className="mic"
                aria-label={recording ? t.micStop : t.mic}
                aria-pressed={recording}
                aria-busy={busy}
                onClick={() => void onMic()}
                style={
                  recording
                    ? { background: 'var(--decline)', color: '#fff' }
                    : busy || !voice.supported
                      ? { opacity: 0.55, animation: 'none' }
                      : undefined
                }
              >
                <Icon name={busy ? 'i-clock' : recording ? 'i-send' : 'i-mic'} cls="lg" />
              </button>
            </div>
            <button
              type="button"
              className="iconbtn"
              aria-label={t.next}
              title={t.next}
              aria-disabled={!ready || busy}
              data-speaks=""
              onClick={onNext}
              style={{
                background: 'var(--accept)',
                borderColor: 'var(--accept)',
                color: '#fff',
                opacity: ready && !busy ? 1 : 0.45,
              }}
            >
              <Icon name="i-chk" />
            </button>
          </div>
          <span className="l bold rt" role="status">
            {status}
          </span>
        </div>
      </Screen>
    </Stage>
  );
}

/** A chip still waiting for its answer: dashed, with the field's icon. */
function Pending({ icon, i = 0 }: { icon: string; i?: number }) {
  return (
    <span
      className="chip rr-rise"
      style={{ borderStyle: 'dashed', color: 'var(--soft)', ['--i' as string]: i }}
    >
      <Icon name={icon} cls="s24" />…
    </span>
  );
}
