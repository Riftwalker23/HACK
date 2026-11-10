'use client';

/**
 * W4 · Skills 3/4 — `W4-Skills.dc.html` on the canvas.
 *
 * The big number is the years he said (adjustable), the list is the skills
 * extracted from his own words (tap X to remove), and the quote is his real
 * transcript. "Tell more" records another clip and APPENDS the new skills.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen, rise } from '@/components/ui';
import { Wave } from '@/components/voice/wave';
import { AiChip } from '@/components/worker/ai-chip';
import { EmptyDraft, ErrorNote, LoadingNote, SayBtn, useSpeakOnLoad } from '@/components/worker/onboarding-ui';
import { useVoiceInput } from '@/lib/voice/use-voice-input';
import { speakAloud, stopAloud } from '@/lib/speech';
import { tradeClass } from '@/lib/worker/trades';
import {
  addClip,
  extractProfile,
  getDraft,
  hasTranscript,
  mergeExtraction,
  skillIcon,
  skillLabel,
  spokenText,
  updateDraft,
  useDraft,
  useHydrated,
  type DraftSkill,
} from '@/lib/worker/onboarding';

const D = {
  ur: {
    years: 'سال',
    title: 'آپ کے ہنر',
    from: 'آپ کی باتوں سے',
    more: 'اور بتائیں',
    stop: 'بات ختم، بھیجیں',
    writing: 'سمجھ رہے ہیں…',
    ok: 'ٹھیک ہے',
    rm: 'ہٹائیں',
    less: 'ایک سال کم',
    plus: 'ایک سال زیادہ',
    step: 'مرحلہ 3 از 4',
    read: 'یہ صفحہ سنیں',
    none: 'ابھی کوئی ہنر نہیں ملا۔ "اور بتائیں" دبا کر بتائیں کہ آپ کون کون سے کام کرتے ہیں۔',
    howTo: 'ہٹانے کے لیے لال نشان دبائیں۔',
    added: (n: number) => `${n} نئے ہنر شامل ہو گئے:`,
    nothingNew: 'کوئی نیا ہنر نہیں ملا۔ دوبارہ بتائیں کہ آپ کون سے کام کرتے ہیں۔',
    removed: 'ہٹا دیا:',
    errHear: 'آواز سمجھ نہیں آئی۔ دوبارہ "اور بتائیں" دبا کر بولیں۔',
    errUnderstand: 'آپ کی بات محفوظ ہے، لیکن ابھی سمجھ نہیں سکے۔ دوبارہ کوشش کریں۔',
    retry: 'دوبارہ کوشش کریں',
  },
  rm: {
    years: 'saal',
    title: 'Aap ke hunar',
    from: 'aap ki baaton se',
    more: 'Aur batayein',
    stop: 'Baat khatam, bhejein',
    writing: 'Samajh rahe hain…',
    ok: 'Theek hai',
    rm: 'Hatayein',
    less: 'Ek saal kam',
    plus: 'Ek saal zyada',
    step: 'Marhala 3 az 4',
    read: 'Yeh safha sunein',
    none: 'Abhi koi hunar nahi mila. "Aur batayein" daba kar batayein ke aap kaun kaun se kaam karte hain.',
    howTo: 'Hatane ke liye laal nishan dabayein.',
    added: (n: number) => `${n} naye hunar shamil ho gaye:`,
    nothingNew: 'Koi naya hunar nahi mila. Dobara batayein ke aap kaun se kaam karte hain.',
    removed: 'Hata diya:',
    errHear: 'Awaaz samajh nahi aayi. Dobara "Aur batayein" daba kar bolein.',
    errUnderstand: 'Aap ki baat mehfooz hai, lekin abhi samajh nahi sake. Dobara koshish karein.',
    retry: 'Dobara koshish karein',
  },
  en: {
    years: 'years',
    title: 'Your skills',
    from: 'from your own words',
    more: 'Tell more',
    stop: 'Done, send',
    writing: 'Understanding…',
    ok: 'Looks right',
    rm: 'Remove',
    less: 'One year less',
    plus: 'One year more',
    step: 'Step 3 of 4',
    read: 'Read this page aloud',
    none: 'No skills yet. Tap "Tell more" and say which jobs you do.',
    howTo: 'Tap the red cross to remove one.',
    added: (n: number) => `${n} new skills added:`,
    nothingNew: 'No new skills heard. Tell us again which jobs you do.',
    removed: 'Removed:',
    errHear: 'We could not understand that. Tap "Tell more" and speak again.',
    errUnderstand: 'Your words are saved, but we could not understand them yet. Try again.',
    retry: 'Try again',
  },
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Marks the skill words inside his own transcript, as the design does. */
function highlight(text: string, skills: DraftSkill[]): React.ReactNode[] {
  const terms = skills
    .flatMap((s) => [s.labelEn, s.labelUr ?? ''])
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe);
  if (!terms.length) return [text];
  const re = new RegExp(`(${terms.join('|')})`, 'giu');
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export default function SkillsPage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const router = useRouter();
  const draft = useDraft();
  const hydrated = useHydrated();
  const [ex, setEx] = useState<{ status: 'idle' | 'loading' | 'error'; error?: string; text?: string }>({
    status: 'idle',
  });

  const empty = hydrated && !hasTranscript(draft);
  const skills = draft.skills;
  const names = skills.map((s) => skillLabel(s, lang));
  const intro = skills.length ? `${t.title}: ${names.join('، ')}. ${t.howTo}` : t.none;
  useSpeakOnLoad(intro, lang, hydrated && !empty);

  /** Extract one extra clip and append what is new. */
  const extractMore = async (text: string) => {
    setEx({ status: 'loading' });
    const before = getDraft().skills.length;
    try {
      const { profile, provider } = await extractProfile(text);
      const next = updateDraft((d) => mergeExtraction(d, profile, provider, 'fillEmpty'));
      setEx({ status: 'idle' });
      const fresh = next.skills.slice(before).map((s) => skillLabel(s, lang));
      void speakAloud(fresh.length ? `${t.added(fresh.length)} ${fresh.join('، ')}` : t.nothingNew, lang);
    } catch (err) {
      setEx({ status: 'error', error: (err as Error).message, text });
      void speakAloud(t.errUnderstand, lang);
    }
  };

  const voice = useVoiceInput({
    language: lang === 'en' ? 'en' : 'ur',
    onTranscript: async (tr) => {
      addClip({ textUr: tr.textUr, textRoman: tr.textRoman, provider: tr.provider });
      await extractMore(tr.textUr.trim() || tr.textRoman.trim());
    },
  });

  useEffect(() => {
    if (voice.phase === 'error' && voice.error) void speakAloud(t.errHear, lang);
  }, [voice.phase, voice.error, t.errHear, lang]);

  const recording = voice.phase === 'recording';
  const busy = voice.phase === 'transcribing' || ex.status === 'loading';

  const tellMore = async () => {
    if (busy) return;
    if (!voice.supported) {
      void speakAloud(t.errHear, lang);
      return;
    }
    if (!recording) stopAloud();
    await voice.toggle();
  };

  const remove = (s: DraftSkill) => {
    updateDraft((d) => ({ ...d, skills: d.skills.filter((x) => x !== s && x.labelEn !== s.labelEn) }));
    void speakAloud(`${t.removed} ${skillLabel(s, lang)}`, lang);
  };

  const bump = (by: number) => {
    const next = updateDraft((d) => ({
      ...d,
      yearsExperience: Math.min(70, Math.max(0, (d.yearsExperience ?? 0) + by)),
    }));
    void speakAloud(`${next.yearsExperience} ${t.years}`, lang);
  };

  const said = spokenText(draft, lang);
  const tc = tradeClass(draft.tradeSlug) || 'tr-elec';

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w4" extra="rr-screen">
        <header className="top">
          <SayBtn label={t.read} say={intro} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <main className="col g12 fx px" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div className="rail sm" role="img" aria-label={t.step}>
            <span className="n done">
              <Icon name="i-chk" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n done">
              <Icon name="i-chk" cls="s20" />
            </span>
            <span className="ln done" />
            <span className="n cur">
              <Icon name="i-tools" cls="s20" />
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
              <div className="row g12">
                <div
                  className="col ctr"
                  role="img"
                  aria-label={`${draft.yearsExperience ?? '?'} ${t.years}`}
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '24px',
                    background: 'var(--roshan)',
                    color: '#0B1020',
                    flex: 'none',
                  }}
                >
                  <span className="d num" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {draft.yearsExperience ?? '?'}
                  </span>
                  <span className="l bold">{t.years}</span>
                </div>
                <div className="col g8 fx">
                  <h1 className="t nq">{t.title}</h1>
                  <div className="row g8 wrap">
                    <AiChip provider={draft.extractProvider} />
                    <span className="l soft">{t.from}</span>
                  </div>
                  <div className="row g8">
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={t.less}
                      title={t.less}
                      data-speaks=""
                      onClick={() => bump(-1)}
                    >
                      <Icon name="i-up" style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={t.plus}
                      title={t.plus}
                      data-speaks=""
                      onClick={() => bump(1)}
                    >
                      <Icon name="i-up" />
                    </button>
                  </div>
                </div>
              </div>

              {said && (
                <p
                  className="l card"
                  aria-live="polite"
                  style={{ padding: '12px 14px', borderRadius: '16px', overflowWrap: 'anywhere' }}
                >
                  “{highlight(said, skills)}”
                </p>
              )}

              {voice.phase === 'error' && (
                <ErrorNote lang={lang} message={t.errHear} detail={voice.error} onRetry={() => void tellMore()} retryLabel={t.retry} />
              )}
              {ex.status === 'error' && (
                <ErrorNote
                  lang={lang}
                  message={t.errUnderstand}
                  detail={ex.error}
                  onRetry={() => (ex.text ? void extractMore(ex.text) : void tellMore())}
                  retryLabel={t.retry}
                />
              )}

              {skills.length ? (
                <ul className="col g8" aria-label={t.title} aria-live="polite">
                  {skills.map((s, i) => {
                    const name = skillLabel(s, lang);
                    return (
                      <li className="sk rr-rise" key={`${s.labelEn}-${i}`} style={rise(i)}>
                        <span className={`gl s40 ${tc}`}>
                          <Icon name={skillIcon(s)} cls="s24" />
                        </span>
                        <span className="b bold fx" style={{ overflowWrap: 'anywhere' }}>
                          {name}
                        </span>
                        <button
                          type="button"
                          className="x"
                          aria-label={`${t.rm}: ${name}`}
                          title={`${t.rm}: ${name}`}
                          data-speaks=""
                          onClick={() => remove(s)}
                          style={{ width: '56px', height: '56px' }}
                        >
                          <Icon name="i-x" cls="s24" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="card row g12" style={{ padding: '16px', borderStyle: 'dashed' }}>
                  <span className="gl s40" style={{ ['--c' as string]: 'var(--line)', ['--g' as string]: 'var(--soft)' }}>
                    <Icon name="i-mic" cls="s24" />
                  </span>
                  <p className="b fx">{t.none}</p>
                </div>
              )}
            </>
          )}
        </main>

        {!empty && (
          <div className="dock">
            {recording && <Wave level={voice.level} active />}
            <div className="row g12">
              <button
                type="button"
                className="btn btn-o fx"
                aria-pressed={recording}
                aria-busy={busy}
                data-no-prompt=""
                onClick={() => void tellMore()}
                style={{
                  minHeight: '72px',
                  ...(recording ? { borderColor: 'var(--decline)', color: 'var(--decline)' } : {}),
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Icon
                  name={busy ? 'i-clock' : recording ? 'i-send' : 'i-mic'}
                  style={{ color: recording ? 'var(--decline)' : 'var(--roshan-text)' }}
                />
                {busy ? t.writing : recording ? t.stop : t.more}
              </button>
              <button
                type="button"
                className="btn btn-ok fx"
                data-speaks=""
                onClick={() => router.push('/worker/proof')}
                style={{ minHeight: '72px' }}
              >
                <Icon name="i-chk" />
                {t.ok}
              </button>
            </div>
          </div>
        )}
      </Screen>
    </Stage>
  );
}
