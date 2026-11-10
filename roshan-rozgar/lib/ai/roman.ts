/**
 * Roman Urdu transliteration utilities.
 * Used for reading mode and converting Urdu script to Roman Urdu.
 */

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

export function toRomanUrdu(input: string): string {
  return input
    .replace(DROPPED, '')
    .split(/(\s+)/)
    .map((chunk) => {
      if (/^\s*$/.test(chunk)) return chunk;

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
