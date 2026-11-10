/**
 * Whisper provider — Urdu speech-to-text ONLY.
 *
 * This is the capability the whole product stands on: the worker may not be
 * able to read or type, so if this fails there is no other input path he can
 * use (PROJECT.md §2.1, row 1). It therefore leads the `transcribe` chain in
 * lib/ai/index.ts and falls back to the stub rather than to an error.
 *
 * Deliberately implemented with plain `fetch` + FormData against the audio
 * endpoint instead of the `openai` npm package: the package is not installed,
 * and one multipart POST does not justify a dependency.
 */

import { env, hasOpenAI } from '@/lib/env';
import {
  transcription,
  type AiProvider,
  type AiResult,
  type TranscribeInput,
  type Transcription,
} from './types';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// Roman Urdu transliteration
//
// Why this exists: the UI has a Roman-Urdu reading mode, and every keyword list
// in data/trades.ts is matched in Roman Urdu as well as Urdu script. Whisper
// returns Urdu script, so without this step the transcript cannot be matched
// against a Roman keyword and cannot be shown in Roman mode.
// ---------------------------------------------------------------------------

/** The words that carry almost every onboarding and chat sentence. Hand-mapped
 *  because a letter-by-letter pass mangles exactly the words users notice. */
const WORD_MAP: Record<string, string> = {
  میرا: 'mera', میری: 'meri', میرے: 'mere', نام: 'naam',
  ہے: 'hai', ہیں: 'hain', ہوں: 'hoon', ہو: 'ho', تھا: 'tha', تھی: 'thi',
  میں: 'main', آپ: 'aap', وہ: 'woh', یہ: 'yeh', ہم: 'hum',
  کام: 'kaam', کرتا: 'karta', کرتی: 'karti', کرتے: 'karte', کریں: 'karein',
  سال: 'saal', برس: 'baras', تجربہ: 'tajurba', مہینہ: 'mahina', دن: 'din',
  کا: 'ka', کی: 'ki', کے: 'ke', کو: 'ko', سے: 'se', پر: 'par', تک: 'tak',
  اور: 'aur', یا: 'ya', بھی: 'bhi', نہیں: 'nahi', نہ: 'na',
  گیا: 'gaya', گئی: 'gayi', رہا: 'raha', رہی: 'rahi', رہے: 'rahe',
  بجلی: 'bijli', پانی: 'paani', گیزر: 'geyser', پائپ: 'pipe', نل: 'nal',
  ٹینکی: 'tanki', نالی: 'nali', کموڈ: 'commode', موٹر: 'motor',
  تار: 'taar', سوئچ: 'switch', بلب: 'bulb', پنکھا: 'pankha', میٹر: 'meter',
  کرنٹ: 'current', گیس: 'gas', فریج: 'fridge', ٹھنڈا: 'thanda',
  لکڑی: 'lakri', دروازہ: 'darwaza', الماری: 'almari', فرنیچر: 'furniture',
  کھڑکی: 'khirki', دیمک: 'deemak', گاڑی: 'gaari', انجن: 'engine',
  بیٹری: 'battery', ٹائر: 'tyre', بریک: 'brake', رنگ: 'rang', پینٹ: 'paint',
  دیوار: 'deewar', سفیدی: 'safedi', چھت: 'chhat', اینٹ: 'eent',
  سیمنٹ: 'cement', پلستر: 'plaster', ٹائل: 'tile', فرش: 'farsh',
  روپے: 'rupay', ہزار: 'hazaar', سو: 'sau', لاکھ: 'lakh',
  ڈھائی: 'dhai', ڈیڑھ: 'derh', ساڑھے: 'saarhay', آدھا: 'aadha',
  ایک: 'ek', دو: 'do', تین: 'teen', چار: 'char', پانچ: 'paanch',
  چھ: 'che', سات: 'saat', آٹھ: 'aath', نو: 'nau', دس: 'das',
  گیارہ: 'gyarah', بارہ: 'barah', پندرہ: 'pandrah', بیس: 'bees',
  پچیس: 'pachees', تیس: 'tees', پچاس: 'pachaas',
  ٹھیک: 'theek', اچھا: 'acha', بہت: 'bohat', خراب: 'kharab',
  جلدی: 'jaldi', فورا: 'foran', ابھی: 'abhi', خطرہ: 'khatra',
  شکریہ: 'shukriya', معاف: 'maaf', کیجیے: 'kijiye',
  مٹیریل: 'material', سامان: 'saman', الگ: 'alag', شامل: 'shamil',
  لگیں: 'lagein', لگے: 'lage', ہوگا: 'hoga', مکمل: 'mukammal',
  اسلام: 'Islamabad', آباد: '', راولپنڈی: 'Rawalpindi', صدر: 'Saddar',
  بحریہ: 'Bahria', ٹاؤن: 'Town', چکلالہ: 'Chaklala', بازار: 'Bazaar',
  لیک: 'leak', ٹپک: 'tapak', سروس: 'service', مستری: 'mistri',
  بڑھئی: 'barhai', پلمبر: 'plumber', پینٹر: 'painter', راج: 'raj',
  والا: 'waala', گھر: 'ghar', کمرہ: 'kamra', باتھ: 'bath', روم: 'room',
};

/** Longest first so digraphs win over their first letter. */
const LETTER_MAP: ReadonlyArray<readonly [string, string]> = [
  ['آ', 'aa'], ['ای', 'ai'], ['اؤ', 'au'],
  ['ا', 'a'], ['ب', 'b'], ['پ', 'p'], ['ت', 't'], ['ٹ', 't'], ['ث', 's'],
  ['ج', 'j'], ['چ', 'ch'], ['ح', 'h'], ['خ', 'kh'], ['د', 'd'], ['ڈ', 'd'],
  ['ذ', 'z'], ['ر', 'r'], ['ڑ', 'r'], ['ز', 'z'], ['ژ', 'zh'], ['س', 's'],
  ['ش', 'sh'], ['ص', 's'], ['ض', 'z'], ['ط', 't'], ['ظ', 'z'], ['ع', 'a'],
  ['غ', 'gh'], ['ف', 'f'], ['ق', 'q'], ['ک', 'k'], ['گ', 'g'], ['ل', 'l'],
  ['م', 'm'], ['ن', 'n'], ['ں', 'n'], ['و', 'o'], ['ۃ', 'h'], ['ہ', 'h'],
  ['ھ', 'h'], ['ء', ''], ['ی', 'i'], ['ے', 'e'], ['ئ', 'y'],
  ['۰', '0'], ['۱', '1'], ['۲', '2'], ['۳', '3'], ['۴', '4'],
  ['۵', '5'], ['۶', '6'], ['۷', '7'], ['۸', '8'], ['۹', '9'],
  ['،', ','], ['۔', '.'], ['؟', '?'], ['؛', ';'],
];

/** Diacritics and joiners carry no Roman form; drop them before mapping. */
const DROPPED = /[ً-ْٰٓ-ٕ‌‍ﷲ]/g;

function transliterateWord(word: string): string {
  let out = '';
  let i = 0;
  while (i < word.length) {
    const match = LETTER_MAP.find(([ur]) => word.startsWith(ur, i));
    if (match) {
      out += match[1];
      i += match[0].length;
      continue;
    }
    out += word[i];
    i += 1;
  }
  return out;
}

/** Urdu script -> Roman Urdu. Word dictionary first, letters as the fallback. */
export function toRomanUrdu(input: string): string {
  return input
    .replace(DROPPED, '')
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s*$/.test(chunk)) return chunk;

      // Keep leading/trailing punctuation outside the lookup.
      const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(chunk);
      const [, lead = '', core = '', trail = ''] = m ?? [];
      if (!core) return chunk;

      const mapped = WORD_MAP[core];
      const roman = mapped !== undefined ? mapped : transliterateWord(core);
      return `${lead}${roman}${trail}`;
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

/** Whisper rejects an upload whose filename has no recognised extension. */
function filenameFor(mimeType: string): string {
  const base = mimeType.split(';')[0]!.trim().toLowerCase();
  return `audio.${EXTENSIONS[base] ?? 'webm'}`;
}

type VerboseSegment = { avg_logprob?: number; no_speech_prob?: number };
type WhisperResponse = { text?: string; segments?: VerboseSegment[] };

/**
 * Whisper returns no confidence field. `verbose_json` does return per-segment
 * log-probabilities, so the geometric mean of exp(avg_logprob) is a real (if
 * rough) confidence rather than a made-up constant. Urdu audio recorded on a
 * phone at a street corner genuinely is low-confidence sometimes, and the UI
 * uses this to decide whether to ask the worker to repeat himself.
 */
function estimateConfidence(segments: VerboseSegment[] | undefined): number {
  const usable = (segments ?? []).filter((s) => typeof s.avg_logprob === 'number');
  if (!usable.length) return 0.7;

  const total = usable.reduce((sum, s) => {
    const spoken = 1 - Math.min(1, Math.max(0, s.no_speech_prob ?? 0));
    return sum + Math.exp(s.avg_logprob!) * spoken;
  }, 0);

  return Math.min(1, Math.max(0, total / usable.length));
}

async function transcribe(input: TranscribeInput): Promise<AiResult<Transcription>> {
  const started = Date.now();
  const model = env.OPENAI_STT_MODEL;

  // Copied into a plain ArrayBuffer because a Uint8Array may be backed by a
  // SharedArrayBuffer, which is not a valid BlobPart.
  const buffer = new ArrayBuffer(input.audio.byteLength);
  new Uint8Array(buffer).set(input.audio);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: input.mimeType }), filenameFor(input.mimeType));
  form.append('model', model);
  // Ask for Urdu explicitly: auto-detection confuses Urdu with Hindi and
  // Persian, and a Hindi-script transcript is useless to every downstream step.
  form.append('language', input.language ?? 'ur');
  form.append(
    'prompt',
    'Pakistani trade worker speaking Urdu about electrical, plumbing, AC, carpentry, mechanic, painting or masonry work, areas of Islamabad and Rawalpindi, and prices in rupees.',
  );
  // Only the whisper-* family supports verbose_json; the newer transcription
  // models reject it, so ask for segments only when they are available.
  form.append('response_format', model.startsWith('whisper') ? 'verbose_json' : 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      controller.signal.aborted
        ? `whisper timed out after ${TIMEOUT_MS}ms`
        : `whisper request failed: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`whisper ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as WhisperResponse;
  const textUr = (payload.text ?? '').trim();
  if (!textUr) throw new Error('whisper returned an empty transcript');

  const result = transcription.parse({
    textUr,
    textRoman: toRomanUrdu(textUr),
    confidence: estimateConfidence(payload.segments),
  });

  return {
    result,
    meta: { provider: 'openai', model, latencyMs: Date.now() - started, cached: false },
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const provider: AiProvider = {
  name: 'openai',
  available: hasOpenAI(),

  // Speech only. Every other capability is deliberately absent so the
  // dispatcher routes it to Claude, then to the stub.
  transcribe,
};

export default provider;
