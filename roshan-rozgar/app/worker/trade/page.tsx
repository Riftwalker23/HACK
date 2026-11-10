'use client';

/**
 * W3 · Confirm trade 2/4 — `W3-Trade.dc.html` on the canvas.
 *
 * The tile for the trade extracted from his own words is pre-selected and the
 * headline asks "Are you a <trade>?". Tapping a tile selects it and says its
 * name. "Something else? Say it" records a new clip and re-extracts.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, rise } from '@/components/ui';
import { Wave } from '@/components/voice/wave';
import { AiChip } from '@/components/worker/ai-chip';
import { EmptyDraft, ErrorNote, LoadingNote, SayBtn, useSpeakOnLoad } from '@/components/worker/onboarding-ui';
import { useVoiceInput } from '@/lib/voice/use-voice-input';
import { speakAloud, stopAloud } from '@/lib/speech';
import { TRADE_SLUGS, tradeKey, tradeName } from '@/lib/worker/trades';
import {
  addClip,
  extractProfile,
  hasTranscript,
  mergeExtraction,
  updateDraft,
  useDraft,
  useHydrated,
} from '@/lib/worker/onboarding';

const D = {
  ur: {
    ask: (n: string) => `کیا آپ ${n} ہیں؟`,
    which: 'آپ کون سا کام کرتے ہیں؟ اپنی تصویر دبائیں۔',
    guess: 'ہم نے یہ سنا',
    yes: 'ہاں، یہی ہے',
    other: 'کچھ اور؟ بولیں',
    sayIt: 'کوئی اور کام بول کر بتائیں',
    stop: 'بات ختم، بھیجیں',
    writing: 'سمجھ رہے ہیں…',
    step: 'مرحلہ 2 از 4',
    read: 'یہ صفحہ سنیں',
    hear: 'سنیں',
    pick: 'پہلے اپنے کام کی تصویر دبائیں۔',
    notCaught: 'کام کا نام سمجھ نہیں آیا۔ اپنے کام کی تصویر دبائیں، یا دوبارہ بولیں۔',
    errHear: 'آواز سمجھ نہیں آئی۔ دوبارہ بولیں یا تصویر دبائیں۔',
    errUnderstand: 'ابھی سمجھ نہیں سکے۔ دوبارہ کوشش کریں یا تصویر دبائیں۔',
    retry: 'دوبارہ بولیں',
  },
  rm: {
    ask: (n: string) => `Kya aap ${n} hain?`,
    which: 'Aap kaunsa kaam karte hain? Apni tasveer dabayein.',
    guess: 'humne yeh suna',
    yes: 'Haan, yahi hai',
    other: 'Kuch aur? Bolein',
    sayIt: 'Koi aur kaam bol kar batayein',
    stop: 'Baat khatam, bhejein',
    writing: 'Samajh rahe hain…',
    step: 'Marhala 2 az 4',
    read: 'Yeh safha sunein',
    hear: 'Sunein',
    pick: 'Pehle apne kaam ki tasveer dabayein.',
    notCaught: 'Kaam ka naam samajh nahi aaya. Apne kaam ki tasveer dabayein, ya dobara bolein.',
    errHear: 'Awaaz samajh nahi aayi. Dobara bolein ya tasveer dabayein.',
    errUnderstand: 'Abhi samajh nahi sake. Dobara koshish karein ya tasveer dabayein.',
    retry: 'Dobara bolein',
  },
  en: {
    ask: (n: string) => `Are you ${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n.toLowerCase().replace(/^ac /, 'AC ')}?`,
    which: 'Which work do you do? Tap your picture.',
    guess: 'we heard this',
    yes: 'Yes, that’s me',
    other: 'Something else? Say it',
    sayIt: 'Say another trade',
    stop: 'Done, send',
    writing: 'Understanding…',
    step: 'Step 2 of 4',
    read: 'Read this page aloud',
    hear: 'Hear',
    pick: 'First tap the picture of your work.',
    notCaught: 'We did not catch the trade. Tap the picture of your work, or say it again.',
    errHear: 'We could not understand that. Say it again or tap a picture.',
    errUnderstand: 'We could not understand that yet. Try again or tap a picture.',
    retry: 'Say it again',
  },
};

function headline(slug: string | null, lang: Lang) {
  const t = D[lang];
  return slug ? t.ask(tradeName(slug, lang)) : t.which;
}

export default function TradePage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const router = useRouter();
  const draft = useDraft();
  const hydrated = useHydrated();
  const [ex, setEx] = useState<{ status: 'idle' | 'loading' | 'error'; error?: string }>({ status: 'idle' });

  const sel = draft.tradeSlug;
  const q = headline(sel, lang);
  const empty = hydrated && !hasTranscript(draft) && !sel;

  useSpeakOnLoad(q, lang, hydrated && !empty);

  const voice = useVoiceInput({
    language: lang === 'en' ? 'en' : 'ur',
    onTranscript: async (tr) => {
      addClip({ textUr: tr.textUr, textRoman: tr.textRoman, provider: tr.provider });
      setEx({ status: 'loading' });
      try {
        const { profile, provider } = await extractProfile(tr.textUr.trim() || tr.textRoman.trim());
        const before = sel;
        const next = updateDraft((d) => mergeExtraction(d, profile, provider, 'trade'));
        setEx({ status: 'idle' });
        if (profile.tradeSlug && next.tradeSlug) {
          void speakAloud(headline(next.tradeSlug, lang), lang);
        } else {
          void speakAloud(before ? `${t.notCaught} ${headline(before, lang)}` : t.notCaught, lang);
        }
      } catch (err) {
        setEx({ status: 'error', error: (err as Error).message });
        void speakAloud(t.errUnderstand, lang);
      }
    },
  });

  useEffect(() => {
    if (voice.phase === 'error' && voice.error) void speakAloud(t.errHear, lang);
  }, [voice.phase, voice.error, t.errHear, lang]);

  const recording = voice.phase === 'recording';
  const busy = voice.phase === 'transcribing' || ex.status === 'loading';

  const choose = (slug: string) => {
    updateDraft((d) => ({ ...d, tradeSlug: slug, missing: d.missing.filter((m) => m !== 'tradeSlug') }));
    void speakAloud(tradeName(slug, lang), lang);
  };

  const sayOther = async () => {
    if (busy) return;
    if (!voice.supported) {
      void speakAloud(t.pick, lang);
      return;
    }
    if (!recording) stopAloud();
    await voice.toggle();
  };

  const confirm = () => {
    if (!sel) {
      void speakAloud(t.pick, lang);
      return;
    }
    router.push('/worker/skills');
  };

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w3" extra="rr-screen">
        <header className="top">
          <SayBtn label={t.read} say={q} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div className="rail sm" role="img" aria-label={t.step}>
            <span className="n done">
              <Icon name="i-chk" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n cur">
              <Icon name="i-tools" cls="s20" />
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

          {!hydrated ? (
            <LoadingNote lang={lang} />
          ) : empty ? (
            <EmptyDraft lang={lang} />
          ) : (
            <>
              <div className="row sb g8" aria-live="polite">
                <h1 className="t nq">{q}</h1>
                {sel && sel === draft.aiTradeSlug && <AiChip provider={draft.extractProvider} note={t.guess} />}
              </div>

              {voice.phase === 'error' && (
                <ErrorNote lang={lang} message={t.errHear} detail={voice.error} onRetry={() => void sayOther()} retryLabel={t.retry} />
              )}
              {ex.status === 'error' && (
                <ErrorNote lang={lang} message={t.errUnderstand} detail={ex.error} onRetry={() => void sayOther()} retryLabel={t.retry} />
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '12px',
                  flex: 1,
                  minHeight: '480px',
                }}
              >
                {TRADE_SLUGS.map((slug, i) => {
                  const id = tradeKey(slug)!;
                  const on = slug === sel;
                  const name = tradeName(slug, lang);
                  return (
                    <div key={slug} className={`tile tr-${id} ${on ? 'sel' : ''} rr-rise`.trim()} style={rise(i)}>
                      <button
                        type="button"
                        className="tm"
                        aria-pressed={on}
                        data-speaks=""
                        onClick={() => choose(slug)}
                      >
                        <span className={`gl s56${on ? ' rr-spring' : ''}`}>
                          <Glyph name={`g-${id}`} />
                        </span>
                        <span className="l bold">{name}</span>
                      </button>
                      {on && (
                        <span className="tick rr-pop" aria-hidden="true">
                          <Icon name="i-chk" cls="s20" />
                        </span>
                      )}
                      <SayBtn label={`${t.hear}: ${name}`} say={name} lang={lang} cls="spk" iconCls="s24" />
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="tile rr-rise"
                  aria-label={recording ? t.stop : t.sayIt}
                  aria-pressed={recording}
                  aria-busy={busy}
                  data-no-prompt=""
                  onClick={() => void sayOther()}
                  style={{
                    borderRadius: 'var(--r-lg)',
                    border: recording ? '3px solid var(--decline)' : '3px dashed var(--line)',
                    background: recording ? 'color-mix(in srgb, var(--decline) 10%, transparent)' : 'transparent',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    color: recording ? 'var(--decline)' : 'var(--soft)',
                    opacity: busy ? 0.6 : 1,
                    ['--i' as string]: TRADE_SLUGS.length,
                  }}
                >
                  {recording ? (
                    <>
                      <div style={{ width: '100%', height: '48px', overflow: 'hidden' }}>
                        <Wave level={voice.level} active bars={10} />
                      </div>
                      <Icon name="i-send" cls="lg" />
                      <span className="l bold">{t.stop}</span>
                    </>
                  ) : (
                    <>
                      <Icon name={busy ? 'i-clock' : 'i-mic'} cls="lg" />
                      <span className="l">{busy ? t.writing : t.other}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </main>

        {!empty && (
          <div className="dock">
            <button
              type="button"
              className="btn btn-ok big"
              aria-disabled={!sel}
              data-speaks=""
              onClick={confirm}
              style={{ opacity: sel ? 1 : 0.5 }}
            >
              <Icon name="i-chk" cls="lg" />
              {t.yes}
            </button>
          </div>
        )}
      </Screen>
    </Stage>
  );
}
