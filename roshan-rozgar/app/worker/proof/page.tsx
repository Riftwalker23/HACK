'use client';

/**
 * W5 · Proof photos 4/4 — `W5-Proof.dc.html` on the canvas.
 *
 * The shutter opens the camera. Each photo is uploaded (/api/upload), tagged
 * (/api/ai/tag-photo) and shown as a real thumbnail with its tags; the tags
 * become extra skills. "Hear your profile" reads it all back. "Publish" creates
 * the worker (POST /api/workers), attaches the photos
 * (POST /api/workers/{id}/photos), signs him in and opens his home screen.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { ExitBtn, Glyph, Icon, LangSwitch, Screen, rise } from '@/components/ui';
import { Wave } from '@/components/voice/wave';
import { AiChip } from '@/components/worker/ai-chip';
import { EmptyDraft, ErrorNote, LoadingNote, SayBtn, useSpeakOnLoad } from '@/components/worker/onboarding-ui';
import type { DemoUser } from '@/lib/client-api';
import { useVoiceInput } from '@/lib/voice/use-voice-input';
import { uploadMedia } from '@/lib/voice/api';
import { speakAloud, stopAloud } from '@/lib/speech';
import { tradeClass, tradeGlyph, tradeName } from '@/lib/worker/trades';
import {
  PublishError,
  addClip,
  attachPhotos,
  extractProfile,
  finishPublish,
  getDraft,
  hasTranscript,
  mergeSkills,
  photoSkills,
  profileSpeech,
  publishDraft,
  rateFor,
  shrinkImage,
  tagPhoto,
  updateDraft,
  useDraft,
  useHydrated,
  type DraftPhoto,
  type PublishStage,
} from '@/lib/worker/onboarding';

const D = {
  ur: {
    q: 'اپنے کام کی تصویر دکھائیں',
    intro: 'اپنے کام کی تصویر دکھائیں۔ کیمرے کا بٹن دبائیں۔ پھر شائع کریں دبائیں۔',
    vfEmpty: 'کیمرے کا بٹن دبا کر اپنے کیے ہوئے کام کی تصویر لیں',
    tags: 'ہر تصویر کا نام خود لگ گیا — یہ آپ کے ہنر بن گئے',
    demoTags: 'یہ ڈیمو ٹیگ ہیں، اصل AI نے نہیں دیکھے',
    noTags: 'AI اس تصویر میں کام نہیں پہچان سکا',
    optional: 'تصویر ضروری نہیں، لیکن گاہک کو بھروسہ دیتی ہے',
    hear: 'اپنا پروفائل سنیں',
    snap: 'تصویر لیں',
    pub: 'شائع کریں',
    hearS: 'سنیں',
    snapS: 'تصویر',
    pubS: 'شائع',
    read: 'یہ صفحہ سنیں',
    uploading: 'بھیج رہے ہیں…',
    tagging: 'پہچان رہے ہیں…',
    tagged: 'تصویر میں یہ ملا:',
    errPhoto: 'تصویر نہیں بھیج سکے۔ دوبارہ کوشش کریں۔',
    remove: 'تصویر ہٹائیں',
    show: 'یہ تصویر دیکھیں',
    nameQ: 'آپ کا نام کیا ہے؟',
    nameLabel: 'نام',
    namePh: 'اپنا نام لکھیں',
    nameSay: 'نام بول کر بتائیں',
    nameStop: 'بات ختم، بھیجیں',
    nameEdit: 'نام بدلیں',
    nameIs: 'آپ کا نام:',
    nameAgain: 'نام سمجھ نہیں آیا۔ دوبارہ بولیں یا لکھیں۔',
    rate: 'ریٹ',
    typical: 'عام ریٹ',
    yrs: 'سال',
    needTrade: 'پہلے اپنا کام چنیں۔',
    toTrade: 'کام چنیں',
    needName: 'شائع کرنے سے پہلے اپنا نام بتائیں۔',
    waitPhotos: 'تصویریں ابھی جا رہی ہیں، ذرا رکیں۔',
    publishing: 'آپ کا پروفائل شائع ہو رہا ہے…',
    locating: 'علاقہ ڈھونڈ رہے ہیں',
    creating: 'پروفائل بنا رہے ہیں',
    signingIn: 'پہلے سے بنا اکاؤنٹ کھول رہے ہیں',
    photos: 'تصویریں لگا رہے ہیں',
    done: 'مبارک ہو! آپ کا پروفائل شائع ہو گیا۔',
    doneExisting: 'یہ نمبر پہلے سے رجسٹر ہے، اسی اکاؤنٹ میں داخل کر دیا۔',
    errPublish: 'پروفائل شائع نہیں ہو سکا۔ دوبارہ کوشش کریں۔',
    errPhotosAttach: 'پروفائل بن گیا، لیکن تصویریں نہیں لگ سکیں۔',
    retryPhotos: 'تصویریں دوبارہ لگائیں',
    skipPhotos: 'تصویروں کے بغیر آگے',
    errHear: 'آواز سمجھ نہیں آئی۔ دوبارہ بولیں یا لکھیں۔',
  },
  rm: {
    q: 'Apne kaam ki tasveer dikhayein',
    intro: 'Apne kaam ki tasveer dikhayein. Camera ka button dabayein. Phir shaaye karein dabayein.',
    vfEmpty: 'Camera ka button daba kar apne kiye hue kaam ki tasveer lein',
    tags: 'Har tasveer ka naam khud lag gaya — yeh aap ke hunar ban gaye',
    demoTags: 'Yeh demo tags hain, asli AI ne nahi dekhe',
    noTags: 'AI is tasveer mein kaam nahi pehchaan saka',
    optional: 'Tasveer zaroori nahi, lekin gahak ko bharosa deti hai',
    hear: 'Apna profile sunein',
    snap: 'Tasveer lein',
    pub: 'Shaaye karein',
    hearS: 'Sunein',
    snapS: 'Tasveer',
    pubS: 'Shaaye',
    read: 'Yeh safha sunein',
    uploading: 'Bhej rahe hain…',
    tagging: 'Pehchaan rahe hain…',
    tagged: 'Tasveer mein yeh mila:',
    errPhoto: 'Tasveer nahi bhej sake. Dobara koshish karein.',
    remove: 'Tasveer hatayein',
    show: 'Yeh tasveer dekhein',
    nameQ: 'Aap ka naam kya hai?',
    nameLabel: 'Naam',
    namePh: 'Apna naam likhein',
    nameSay: 'Naam bol kar batayein',
    nameStop: 'Baat khatam, bhejein',
    nameEdit: 'Naam badlein',
    nameIs: 'Aap ka naam:',
    nameAgain: 'Naam samajh nahi aaya. Dobara bolein ya likhein.',
    rate: 'Rate',
    typical: 'aam rate',
    yrs: 'saal',
    needTrade: 'Pehle apna kaam chunein.',
    toTrade: 'Kaam chunein',
    needName: 'Shaaye karne se pehle apna naam batayein.',
    waitPhotos: 'Tasveerein abhi ja rahi hain, zara rukein.',
    publishing: 'Aap ka profile shaaye ho raha hai…',
    locating: 'Ilaqa dhoond rahe hain',
    creating: 'Profile bana rahe hain',
    signingIn: 'Pehle se bana account khol rahe hain',
    photos: 'Tasveerein laga rahe hain',
    done: 'Mubarak ho! Aap ka profile shaaye ho gaya.',
    doneExisting: 'Yeh number pehle se registered hai, usi account mein daakhil kar diya.',
    errPublish: 'Profile shaaye nahi ho saka. Dobara koshish karein.',
    errPhotosAttach: 'Profile ban gaya, lekin tasveerein nahi lag sakin.',
    retryPhotos: 'Tasveerein dobara lagayein',
    skipPhotos: 'Tasveeron ke baghair aage',
    errHear: 'Awaaz samajh nahi aayi. Dobara bolein ya likhein.',
  },
  en: {
    q: 'Show a photo of your work',
    intro: 'Show a photo of your work. Tap the camera button. Then tap publish.',
    vfEmpty: 'Tap the camera button and take a photo of work you have done',
    tags: 'Each photo tagged itself — the tags became your skills',
    demoTags: 'These are demo tags, not seen by a live AI',
    noTags: 'The AI could not recognise the work in this photo',
    optional: 'A photo is optional, but it helps customers trust you',
    hear: 'Hear your profile',
    snap: 'Take photo',
    pub: 'Publish',
    hearS: 'Hear',
    snapS: 'Photo',
    pubS: 'Publish',
    read: 'Read this page aloud',
    uploading: 'Sending…',
    tagging: 'Recognising…',
    tagged: 'In the photo:',
    errPhoto: 'Could not send the photo. Try again.',
    remove: 'Remove photo',
    show: 'Show this photo',
    nameQ: 'What is your name?',
    nameLabel: 'Name',
    namePh: 'Type your name',
    nameSay: 'Say your name',
    nameStop: 'Done, send',
    nameEdit: 'Change name',
    nameIs: 'Your name:',
    nameAgain: 'We did not catch the name. Say it again or type it.',
    rate: 'Rate',
    typical: 'typical rate',
    yrs: 'years',
    needTrade: 'First choose your work.',
    toTrade: 'Choose work',
    needName: 'Tell us your name before publishing.',
    waitPhotos: 'Photos are still sending, wait a moment.',
    publishing: 'Publishing your profile…',
    locating: 'Finding your area',
    creating: 'Creating your profile',
    signingIn: 'Opening the existing account',
    photos: 'Adding your photos',
    done: 'Congratulations! Your profile is published.',
    doneExisting: 'This number was already registered, so we signed you in to that account.',
    errPublish: 'Could not publish the profile. Try again.',
    errPhotosAttach: 'Your profile was created, but the photos could not be added.',
    retryPhotos: 'Add photos again',
    skipPhotos: 'Continue without photos',
    errHear: 'We could not understand that. Say it again or type it.',
  },
};

type Pending = {
  id: string;
  preview: string;
  blob: Blob;
  url: string | null;
  stage: 'upload' | 'tag' | 'error';
  error?: string;
};

type Pub =
  | { state: 'idle' }
  | { state: 'busy'; stage: PublishStage }
  | { state: 'done'; existed: boolean }
  | { state: 'error'; message: string; detail?: string; code: 'trade' | 'name' | 'wait' | 'create' | 'login' | 'photos'; user?: DemoUser };

const STAGES: Array<{ id: PublishStage; icon: string; key: 'locating' | 'creating' | 'signingIn' | 'photos' }> = [
  { id: 'locating', icon: 'i-pin', key: 'locating' },
  { id: 'creating', icon: 'i-up', key: 'creating' },
  { id: 'signing-in', icon: 'i-phone', key: 'signingIn' },
  { id: 'photos', icon: 'i-cam', key: 'photos' },
];

const MAX_PHOTOS = 12;

/** A short name from a clip like "Aslam" when the extractor returns none. */
function guessName(text: string): string | null {
  const clean = text.replace(/[.,،۔!?؟"“”]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  return words.length >= 1 && words.length <= 3 && clean.length >= 2 ? clean.slice(0, 80) : null;
}

function tagNames(p: DraftPhoto) {
  return p.tags.map((t) => t.label);
}

export default function ProofPage() {
  const { lang } = useLang('ur');
  const t = D[lang];
  const router = useRouter();
  const draft = useDraft();
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [pending, setPending] = useState<Pending[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [pub, setPub] = useState<Pub>({ state: 'idle' });

  const empty = hydrated && !hasTranscript(draft) && !draft.tradeSlug;
  useSpeakOnLoad(t.intro, lang, hydrated && !empty);

  /* ------------------------------------------------------------ photos ---- */

  const patch = (id: string, p: Partial<Pending>) =>
    setPending((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const drop = (id: string) =>
    setPending((list) => {
      const gone = list.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((x) => x.id !== id);
    });

  /** upload (unless already uploaded) -> tag -> into the draft. */
  const runPhoto = async (item: Pending) => {
    let url = item.url;
    try {
      const blob = await shrinkImage(item.blob);
      if (!url) {
        patch(item.id, { stage: 'upload', error: undefined });
        url = (await uploadMedia(blob, blob.type === 'image/png' ? 'work.png' : blob.type === 'image/webp' ? 'work.webp' : 'work.jpg')).url;
      }
      patch(item.id, { stage: 'tag', url, error: undefined });
      const tagged = await tagPhoto(blob);
      const photo: DraftPhoto = { url, tags: tagged.tags, tradeGuess: tagged.tradeGuess, provider: tagged.provider };
      updateDraft((d) => ({
        ...d,
        photos: [...d.photos.filter((p) => p.url !== photo.url), photo].slice(0, MAX_PHOTOS),
        skills: mergeSkills(d.skills, photoSkills(photo)),
      }));
      drop(item.id);
      setFocus(photo.url);
      if (photo.tags.length) void speakAloud(`${t.tagged} ${tagNames(photo).join(', ')}`, lang);
    } catch (err) {
      patch(item.id, { stage: 'error', url, error: (err as Error).message });
      void speakAloud(t.errPhoto, lang);
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - getDraft().photos.length - pending.length;
    const items: Pending[] = Array.from(files)
      .slice(0, Math.max(0, room))
      .map((f) => ({ id: `p${++seq.current}`, preview: URL.createObjectURL(f), blob: f, url: null, stage: 'upload' }));
    if (!items.length) return;
    setPending((list) => [...list, ...items]);
    setFocus(items[items.length - 1]!.id);
    // One at a time: the vision quota is small and order should match the camera roll.
    for (const it of items) await runPhoto(it);
  };

  const openCamera = () => {
    if (pub.state === 'busy') return;
    stopAloud();
    fileRef.current?.click();
  };

  const removePhoto = (p: DraftPhoto) => {
    updateDraft((d) => {
      const photos = d.photos.filter((x) => x.url !== p.url);
      const stillTagged = new Set(photos.flatMap((x) => tagNames(x).map((l) => l.toLowerCase())));
      const mine = new Set(tagNames(p).map((l) => l.toLowerCase()));
      const skills = d.skills.filter(
        (s) => s.source === 'speech' || !mine.has(s.labelEn.toLowerCase()) || stillTagged.has(s.labelEn.toLowerCase()),
      );
      return { ...d, photos, skills };
    });
    setFocus(null);
  };

  /* -------------------------------------------------------------- name ---- */

  const setName = (name: string) =>
    updateDraft((d) => ({ ...d, name: name || null, missing: name ? d.missing.filter((m) => m !== 'name') : d.missing }));

  const nameVoice = useVoiceInput({
    language: lang === 'en' ? 'en' : 'ur',
    onTranscript: async (tr) => {
      const text = tr.textUr.trim() || tr.textRoman.trim();
      addClip({ textUr: tr.textUr, textRoman: tr.textRoman, provider: tr.provider });
      setNameBusy(true);
      let nm: string | null = null;
      try {
        const { profile } = await extractProfile(text);
        nm = profile.name?.trim() || null;
      } catch {
        /* fall through to the plain guess */
      }
      nm = nm ?? guessName(lang === 'ur' ? text : tr.textRoman.trim() || text);
      setNameBusy(false);
      if (nm) {
        setName(nm);
        setEditingName(false);
        if (pub.state === 'error' && pub.code === 'name') setPub({ state: 'idle' });
        void speakAloud(`${t.nameIs} ${nm}`, lang);
      } else {
        void speakAloud(t.nameAgain, lang);
      }
    },
  });

  useEffect(() => {
    if (nameVoice.phase === 'error' && nameVoice.error) void speakAloud(t.errHear, lang);
  }, [nameVoice.phase, nameVoice.error, t.errHear, lang]);

  const nameRecording = nameVoice.phase === 'recording';
  const nameWorking = nameVoice.phase === 'transcribing' || nameBusy;

  const sayName = async () => {
    if (nameWorking) return;
    if (!nameVoice.supported) {
      nameRef.current?.focus();
      void speakAloud(t.errHear, lang);
      return;
    }
    if (!nameRecording) stopAloud();
    await nameVoice.toggle();
  };

  /* ----------------------------------------------------------- publish ---- */

  const goHome = (user: DemoUser, existed: boolean) => {
    finishPublish(user);
    setPub({ state: 'done', existed });
    void speakAloud(existed ? `${t.doneExisting} ${t.done}` : t.done, lang);
    router.push('/worker/home');
  };

  const publish = async () => {
    if (pub.state === 'busy' || pub.state === 'done') return;
    const d = getDraft();
    if (!d.tradeSlug) {
      setPub({ state: 'error', message: t.needTrade, code: 'trade' });
      void speakAloud(t.needTrade, lang);
      return;
    }
    const name = (d.name ?? '').trim();
    if (name.length < 2) {
      setEditingName(true);
      setPub({ state: 'error', message: t.needName, code: 'name' });
      void speakAloud(`${t.needName} ${t.nameQ}`, lang);
      requestAnimationFrame(() => nameRef.current?.focus());
      return;
    }
    if (pending.some((p) => p.stage !== 'error')) {
      setPub({ state: 'error', message: t.waitPhotos, code: 'wait' });
      void speakAloud(t.waitPhotos, lang);
      return;
    }
    stopAloud();
    setPub({ state: 'busy', stage: 'locating' });
    void speakAloud(t.publishing, lang);
    try {
      const { existed } = await publishDraft(d, name, (stage) => setPub({ state: 'busy', stage }));
      setPub({ state: 'done', existed });
      void speakAloud(existed ? `${t.doneExisting} ${t.done}` : t.done, lang);
      router.push('/worker/home');
    } catch (err) {
      const e = err instanceof PublishError ? err : new PublishError((err as Error).message, 'create');
      const message = e.code === 'photos' ? t.errPhotosAttach : t.errPublish;
      setPub({ state: 'error', message, detail: e.message, code: e.code, user: e.user });
      void speakAloud(message, lang);
    }
  };

  const retryPhotos = async (user: DemoUser) => {
    setPub({ state: 'busy', stage: 'photos' });
    try {
      await attachPhotos(user, getDraft());
      goHome(user, false);
    } catch (err) {
      setPub({ state: 'error', message: t.errPhotosAttach, detail: (err as Error).message, code: 'photos', user });
      void speakAloud(t.errPhotosAttach, lang);
    }
  };

  /* ------------------------------------------------------------ render ---- */

  const photos = draft.photos;
  const focusedPhoto = photos.find((p) => p.url === focus) ?? null;
  const focusedPending = pending.find((p) => p.id === focus) ?? null;
  const shown =
    focusedPhoto ?? focusedPending ?? (pending.length ? pending[pending.length - 1]! : photos[photos.length - 1] ?? null);
  const shownPhoto = shown && 'tags' in shown ? (shown as DraftPhoto) : null;
  const shownPending = shown && 'stage' in shown ? (shown as Pending) : null;
  const latestProvider = shownPhoto?.provider ?? photos[photos.length - 1]?.provider ?? null;
  const anyDemo = photos.some((p) => p.provider === 'stub' || !p.provider);
  const busy = pub.state === 'busy' || pub.state === 'done';
  const rate = rateFor(draft);
  const hearText = `${profileSpeech(draft, lang, draft.name)}. ${t.rate}: ${rate.min} - ${rate.max}`;
  const stageIdx = pub.state === 'busy' ? STAGES.findIndex((s) => s.id === pub.stage) : -1;

  return (
    <Stage>
      <Screen skin="work" defaultLang="ur" id="s-w5" extra="rr-screen">
        <header className="top">
          <SayBtn label={t.read} say={t.intro} lang={lang} />
          <LangSwitch fallback="ur" />
          <ExitBtn />
        </header>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            const files = e.target.files;
            void onFiles(files).finally(() => {
              if (fileRef.current) fileRef.current.value = '';
            });
          }}
        />

        <main className="col g12 fx px" style={{ overflowY: 'auto', minHeight: 0, paddingBottom: '4px' }}>
          {!hydrated ? (
            <LoadingNote lang={lang} />
          ) : empty ? (
            <EmptyDraft lang={lang} />
          ) : (
            <>
              <div className="row sb g8">
                <h1 className="t nq">{t.q}</h1>
                <AiChip provider={latestProvider} />
              </div>

              {/* who he is, at a glance: name (editable), trade, years, area, rate */}
              <section className="card col g8" style={{ padding: '12px 14px', borderRadius: '18px' }}>
                {draft.name && !editingName ? (
                  <div className="row g12">
                    <span className="gl s40" style={{ ['--c' as string]: 'var(--roshan)', ['--g' as string]: '#0B1020' }}>
                      <Icon name="i-smile" cls="s24" />
                    </span>
                    <span className="b bold fx" style={{ overflowWrap: 'anywhere' }}>
                      {draft.name}
                    </span>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={t.nameEdit}
                      title={t.nameEdit}
                      data-no-prompt=""
                      onClick={() => {
                        setEditingName(true);
                        requestAnimationFrame(() => nameRef.current?.focus());
                      }}
                    >
                      <Icon name="i-pen" />
                    </button>
                  </div>
                ) : (
                  <div className="col g8">
                    <span className="l bold">{t.nameQ}</span>
                    <div className="row g8">
                      <input
                        ref={nameRef}
                        type="text"
                        value={draft.name ?? ''}
                        onChange={(e) => {
                          setEditingName(true); // keep the field open while he types
                          setName(e.target.value);
                          if (pub.state === 'error' && pub.code === 'name') setPub({ state: 'idle' });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (draft.name ?? '').trim().length >= 2) setEditingName(false);
                        }}
                        placeholder={t.namePh}
                        aria-label={t.nameLabel}
                        autoComplete="name"
                        maxLength={80}
                        className="b fx"
                        style={{
                          minHeight: '56px',
                          padding: '0 14px',
                          borderRadius: '18px',
                          border: `3px solid ${pub.state === 'error' && pub.code === 'name' ? 'var(--decline)' : 'var(--line)'}`,
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          font: 'inherit',
                          minWidth: 0,
                        }}
                      />
                      <button
                        type="button"
                        className="iconbtn"
                        aria-label={nameRecording ? t.nameStop : t.nameSay}
                        title={nameRecording ? t.nameStop : t.nameSay}
                        aria-pressed={nameRecording}
                        aria-busy={nameWorking}
                        data-no-prompt=""
                        onClick={() => void sayName()}
                        style={
                          nameRecording
                            ? { background: 'var(--decline)', borderColor: 'var(--decline)', color: '#fff' }
                            : { background: 'var(--roshan)', borderColor: 'var(--roshan-deep)', color: '#0B1020', opacity: nameWorking ? 0.6 : 1 }
                        }
                      >
                        <Icon name={nameWorking ? 'i-clock' : nameRecording ? 'i-send' : 'i-mic'} />
                      </button>
                    </div>
                    {nameRecording && <Wave level={nameVoice.level} active bars={14} />}
                    {nameVoice.phase === 'error' && (
                      <ErrorNote lang={lang} message={t.errHear} detail={nameVoice.error} onRetry={() => void sayName()} />
                    )}
                  </div>
                )}
                <div className="row g8 wrap">
                  {draft.tradeSlug && (
                    <span className={`chip sm ${tradeClass(draft.tradeSlug)}`} style={{ borderColor: 'var(--c)' }}>
                      <span className="gl" style={{ width: '22px', height: '22px' }}>
                        <Glyph name={tradeGlyph(draft.tradeSlug)} />
                      </span>
                      {tradeName(draft.tradeSlug, lang)}
                    </span>
                  )}
                  {draft.yearsExperience !== null && (
                    <span className="chip sm">
                      <Icon name="i-clock" cls="s20" />
                      <span className="num">{draft.yearsExperience}</span> {t.yrs}
                    </span>
                  )}
                  {draft.area && (
                    <span className="chip sm">
                      <Icon name="i-pin" cls="s20" />
                      {draft.area}
                    </span>
                  )}
                  <span className="chip sm" title={rate.typical ? t.typical : undefined}>
                    <Icon name="i-coin" cls="s20" />
                    <span className="num" dir="ltr">
                      Rs {rate.min.toLocaleString('en-US')}–{rate.max.toLocaleString('en-US')}
                    </span>
                    {rate.typical && <span className="soft">· {t.typical}</span>}
                  </span>
                </div>
              </section>

              {/* the viewfinder: the latest (or chosen) photo, its tags, its status */}
              <div className="vf" style={{ height: '230px', flex: 'none' }}>
                {shownPhoto ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shownPhoto.url}
                      alt={tagNames(shownPhoto).join(', ') || t.q}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div
                      className="row g8 wrap"
                      style={{ position: 'absolute', insetInline: '10px', insetBlockEnd: '10px' }}
                      aria-live="polite"
                    >
                      {shownPhoto.tags.length === 0 && (
                        <span
                          style={{
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            border: '2px dashed var(--line)',
                            font: '700 13px/1.2 "Plus Jakarta Sans", "Noto Naskh Arabic", sans-serif',
                            padding: '7px 9px',
                            borderRadius: '8px',
                          }}
                        >
                          {t.noTags}
                        </span>
                      )}
                      {shownPhoto.tags.map((tag, i) => (
                        <span
                          key={`${tag.label}-${i}`}
                          className="rr-pop"
                          style={{
                            background: 'var(--roshan)',
                            color: '#0B1020',
                            font: '800 13px/1 "Plus Jakarta Sans", "Noto Naskh Arabic", sans-serif',
                            padding: '7px 9px',
                            borderRadius: '8px',
                            animationDelay: `${i * 120}ms`,
                          }}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <div style={{ position: 'absolute', insetBlockStart: '10px', insetInlineEnd: '10px' }}>
                      <AiChip provider={shownPhoto.provider} style={{ background: 'var(--surface)' }} />
                    </div>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={t.remove}
                      title={t.remove}
                      data-no-prompt=""
                      disabled={busy}
                      onClick={() => removePhoto(shownPhoto)}
                      style={{ position: 'absolute', insetBlockStart: '10px', insetInlineStart: '10px', color: 'var(--decline)' }}
                    >
                      <Icon name="i-x" />
                    </button>
                  </>
                ) : shownPending ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shownPending.preview}
                      alt=""
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                    />
                    <div
                      className="col g8 ctr"
                      role="status"
                      style={{ position: 'absolute', inset: 0, color: '#fff', padding: '16px' }}
                    >
                      {shownPending.stage === 'error' ? (
                        <ErrorNote
                          lang={lang}
                          message={t.errPhoto}
                          detail={shownPending.error}
                          onRetry={() => void runPhoto(shownPending)}
                        />
                      ) : (
                        <>
                          <Icon name={shownPending.stage === 'upload' ? 'i-up' : 'i-spark'} cls="xl" />
                          <span className="b bold">{shownPending.stage === 'upload' ? t.uploading : t.tagging}</span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="col g12 ctr"
                    aria-label={t.snap}
                    data-no-prompt=""
                    onClick={openCamera}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      border: 0,
                      background: 'transparent',
                      color: '#fff',
                      padding: '24px',
                    }}
                  >
                    <span className="gl s72" style={{ ['--c' as string]: 'var(--roshan)', ['--g' as string]: '#0B1020' }}>
                      <Icon name="i-cam" cls="lg" />
                    </span>
                    <span className="b bold">{t.vfEmpty}</span>
                  </button>
                )}
              </div>

              {photos.length + pending.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                  {photos.map((p, i) => (
                    <button
                      type="button"
                      key={p.url}
                      className="th rr-rise"
                      aria-label={`${t.show}: ${tagNames(p).join(', ')}`}
                      aria-pressed={shownPhoto?.url === p.url}
                      data-no-prompt=""
                      onClick={() => setFocus(p.url)}
                      style={{
                        ...rise(i),
                        padding: 0,
                        width: '100%',
                        borderColor: shownPhoto?.url === p.url ? 'var(--roshan-deep)' : undefined,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      {p.tags[0] && <span className="tg">{p.tags[0].label}</span>}
                    </button>
                  ))}
                  {pending.map((p, i) => (
                    <button
                      type="button"
                      key={p.id}
                      className="th rr-rise"
                      aria-label={p.stage === 'error' ? t.errPhoto : p.stage === 'upload' ? t.uploading : t.tagging}
                      data-no-prompt=""
                      onClick={() => (p.stage === 'error' ? void runPhoto(p) : setFocus(p.id))}
                      style={{
                        ...rise(photos.length + i),
                        padding: 0,
                        width: '100%',
                        borderColor: p.stage === 'error' ? 'var(--decline)' : undefined,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.55 }} />
                      <span
                        style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: p.stage === 'error' ? 'var(--decline)' : '#fff' }}
                      >
                        <Icon name={p.stage === 'error' ? 'i-replay' : p.stage === 'upload' ? 'i-up' : 'i-spark'} cls="lg" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <p className="l soft">
                {photos.some((p) => p.tags.length) ? (anyDemo ? `${t.tags} (${t.demoTags})` : t.tags) : t.optional}
              </p>

              <div aria-live="assertive" className="col g8">
                {pub.state === 'busy' && (
                  <section className="card col g8" role="status" style={{ padding: '14px', borderColor: 'var(--accept)' }}>
                    <span className="b bold">{t.publishing}</span>
                    {STAGES.filter((s) => s.id !== 'signing-in' || pub.stage === 'signing-in').map((s) => {
                      const idx = STAGES.findIndex((x) => x.id === s.id);
                      const doneStage = idx < stageIdx;
                      const cur = idx === stageIdx;
                      return (
                        <span
                          key={s.id}
                          className="row g8 l"
                          style={{ color: doneStage ? 'var(--accept)' : cur ? 'var(--text)' : 'var(--soft)', fontWeight: cur ? 800 : 600 }}
                        >
                          <Icon name={doneStage ? 'i-chk' : s.icon} cls="s24" />
                          {t[s.key]}
                          {cur ? '…' : ''}
                        </span>
                      );
                    })}
                  </section>
                )}
                {pub.state === 'done' && (
                  <section className="card row g12 rr-pop" role="status" style={{ padding: '14px', borderColor: 'var(--accept)' }}>
                    <Icon name="i-chk" cls="lg" style={{ color: 'var(--accept)' }} />
                    <span className="b bold">{pub.existed ? t.doneExisting : t.done}</span>
                  </section>
                )}
                {pub.state === 'error' && pub.code === 'photos' && pub.user ? (
                  <>
                    <ErrorNote
                      lang={lang}
                      message={pub.message}
                      detail={pub.detail}
                      onRetry={() => void retryPhotos(pub.user!)}
                      retryLabel={t.retryPhotos}
                    />
                    <button type="button" className="btn btn-o" onClick={() => goHome(pub.user!, false)}>
                      <Icon name="i-chev" />
                      {t.skipPhotos}
                    </button>
                  </>
                ) : pub.state === 'error' && pub.code === 'trade' ? (
                  <>
                    <ErrorNote lang={lang} message={pub.message} />
                    <button type="button" className="btn btn-p" onClick={() => router.push('/worker/trade')}>
                      <Icon name="i-tools" />
                      {t.toTrade}
                    </button>
                  </>
                ) : pub.state === 'error' ? (
                  <ErrorNote
                    lang={lang}
                    message={pub.message}
                    detail={pub.code === 'create' || pub.code === 'login' ? pub.detail : null}
                    onRetry={pub.code === 'create' || pub.code === 'login' ? () => void publish() : undefined}
                  />
                ) : null}
              </div>
            </>
          )}
        </main>

        {!empty && (
          <div className="dock">
            <div className="row sb">
              <SayBtn
                label={t.hear}
                say={hearText}
                lang={lang}
                icon="i-play"
                iconCls="lg"
                style={{ width: '72px', height: '72px', borderRadius: '22px' }}
              />
              <button
                type="button"
                className="shutter"
                aria-label={t.snap}
                title={t.snap}
                aria-disabled={busy}
                onClick={openCamera}
                style={busy ? { opacity: 0.5 } : undefined}
              >
                <Icon name="i-cam" cls="lg" />
              </button>
              <button
                type="button"
                className="iconbtn"
                aria-label={t.pub}
                title={t.pub}
                aria-busy={pub.state === 'busy'}
                data-speaks=""
                onClick={() => void publish()}
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '22px',
                  background: 'var(--accept)',
                  borderColor: 'var(--accept)',
                  color: '#fff',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Icon name={pub.state === 'busy' ? 'i-clock' : 'i-up'} cls="lg" />
              </button>
            </div>
            <div className="row sb l bold" style={{ textAlign: 'center' }}>
              <span style={{ width: '88px' }}>{t.hearS}</span>
              <span style={{ width: '110px' }}>{t.snapS}</span>
              <span style={{ width: '88px' }}>{t.pubS}</span>
            </div>
          </div>
        )}
      </Screen>
    </Stage>
  );
}

