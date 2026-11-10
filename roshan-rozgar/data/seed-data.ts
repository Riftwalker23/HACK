/**
 * Raw material for `db/seed.ts`. Data only — no DB, no AI, no imports.
 *
 * Everything here is FABRICATED for the demo: the brief says there will be no
 * real users during judging, so the README must disclose exactly this. Names,
 * bios, job descriptions, chat turns and review texts below are written by
 * hand to read like real Islamabad/Rawalpindi households talking to real
 * tradesmen — they are not transcripts of anything.
 *
 * Bilingual on purpose: a customer may describe a fault in English, in Urdu
 * script, or in Roman Urdu, and the seeded world has to show all three or the
 * bilingual claim is untested at the judging table.
 */

export type TradeSlug =
  | 'electrician'
  | 'plumber'
  | 'ac-technician'
  | 'carpenter'
  | 'mechanic'
  | 'painter'
  | 'mason';

export const TRADE_SLUG_KEYS: TradeSlug[] = [
  'electrician',
  'plumber',
  'ac-technician',
  'carpenter',
  'mechanic',
  'painter',
  'mason',
];

export function isTradeSlug(slug: string): slug is TradeSlug {
  return (TRADE_SLUG_KEYS as string[]).includes(slug);
}

/** A name in both scripts. The worker never types it; he says it. */
export type BilingualName = { en: string; ur: string };

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

export const MALE_FIRST_NAMES: BilingualName[] = [
  { en: 'Aslam', ur: 'اسلم' },
  { en: 'Muhammad', ur: 'محمد' },
  { en: 'Nadeem', ur: 'ندیم' },
  { en: 'Shahid', ur: 'شاہد' },
  { en: 'Riaz', ur: 'ریاض' },
  { en: 'Javed', ur: 'جاوید' },
  { en: 'Zafar', ur: 'ظفر' },
  { en: 'Imran', ur: 'عمران' },
  { en: 'Tariq', ur: 'طارق' },
  { en: 'Abdul Rehman', ur: 'عبدالرحمٰن' },
  { en: 'Rashid', ur: 'راشد' },
  { en: 'Saleem', ur: 'سلیم' },
  { en: 'Naveed', ur: 'نوید' },
  { en: 'Asif', ur: 'آصف' },
  { en: 'Sajjad', ur: 'سجاد' },
  { en: 'Farooq', ur: 'فاروق' },
  { en: 'Yasir', ur: 'یاسر' },
  { en: 'Zahid', ur: 'زاہد' },
  { en: 'Akram', ur: 'اکرم' },
  { en: 'Waqar', ur: 'وقار' },
  { en: 'Shakeel', ur: 'شکیل' },
  { en: 'Ilyas', ur: 'الیاس' },
  { en: 'Bashir', ur: 'بشیر' },
  { en: 'Ghulam Rasool', ur: 'غلام رسول' },
  { en: 'Mushtaq', ur: 'مشتاق' },
  { en: 'Ejaz', ur: 'اعجاز' },
  { en: 'Khalid', ur: 'خالد' },
  { en: 'Liaqat', ur: 'لیاقت' },
  { en: 'Noor Muhammad', ur: 'نور محمد' },
  { en: 'Qasim', ur: 'قاسم' },
  { en: 'Rafiq', ur: 'رفیق' },
  { en: 'Sarfraz', ur: 'سرفراز' },
  { en: 'Shabbir', ur: 'شبیر' },
  { en: 'Umar Hayat', ur: 'عمر حیات' },
  { en: 'Wasim', ur: 'وسیم' },
  { en: 'Yaqoob', ur: 'یعقوب' },
  { en: 'Zubair', ur: 'زبیر' },
  { en: 'Haider', ur: 'حیدر' },
  { en: 'Jameel', ur: 'جمیل' },
  { en: 'Allah Ditta', ur: 'اللہ دتہ' },
  { en: 'Nasir', ur: 'ناصر' },
  { en: 'Pervaiz', ur: 'پرویز' },
  { en: 'Rizwan', ur: 'رضوان' },
  { en: 'Sohail', ur: 'سہیل' },
  { en: 'Talib Hussain', ur: 'طالب حسین' },
];

export const FEMALE_FIRST_NAMES: BilingualName[] = [
  { en: 'Ayesha', ur: 'عائشہ' },
  { en: 'Fatima', ur: 'فاطمہ' },
  { en: 'Zainab', ur: 'زینب' },
  { en: 'Sana', ur: 'ثناء' },
  { en: 'Maryam', ur: 'مریم' },
  { en: 'Hina', ur: 'حنا' },
  { en: 'Nadia', ur: 'نادیہ' },
  { en: 'Saba', ur: 'صبا' },
  { en: 'Rabia', ur: 'رابعہ' },
  { en: 'Kiran', ur: 'کرن' },
  { en: 'Farah', ur: 'فرح' },
  { en: 'Shazia', ur: 'شازیہ' },
  { en: 'Amna', ur: 'آمنہ' },
  { en: 'Nimra', ur: 'نمرہ' },
];

export const SURNAMES: BilingualName[] = [
  { en: 'Khan', ur: 'خان' },
  { en: 'Masih', ur: 'مسیح' },
  { en: 'Butt', ur: 'بٹ' },
  { en: 'Awan', ur: 'اعوان' },
  { en: 'Abbasi', ur: 'عباسی' },
  { en: 'Gujjar', ur: 'گجر' },
  { en: 'Rajput', ur: 'راجپوت' },
  { en: 'Qureshi', ur: 'قریشی' },
  { en: 'Mughal', ur: 'مغل' },
  { en: 'Cheema', ur: 'چیمہ' },
  { en: 'Bhatti', ur: 'بھٹی' },
  { en: 'Sheikh', ur: 'شیخ' },
  { en: 'Malik', ur: 'ملک' },
  { en: 'Chaudhry', ur: 'چوہدری' },
  { en: 'Satti', ur: 'ستی' },
  { en: 'Janjua', ur: 'جنجوعہ' },
  { en: 'Niazi', ur: 'نیازی' },
  { en: 'Tanoli', ur: 'تنولی' },
  { en: 'Baig', ur: 'بیگ' },
  { en: 'Ansari', ur: 'انصاری' },
  { en: 'Hussain', ur: 'حسین' },
  { en: 'Ahmed', ur: 'احمد' },
  { en: 'Iqbal', ur: 'اقبال' },
  { en: 'Shah', ur: 'شاہ' },
  { en: 'Raza', ur: 'رضا' },
  { en: 'Nawaz', ur: 'نواز' },
  { en: 'Akhtar', ur: 'اختر' },
  { en: 'Siddiqui', ur: 'صدیقی' },
  { en: 'Kiyani', ur: 'کیانی' },
  { en: 'Dar', ur: 'ڈار' },
];

// ---------------------------------------------------------------------------
// Skills a worker would actually claim out loud
// ---------------------------------------------------------------------------

export type SkillSeed = { labelEn: string; labelUr: string };

export const TRADE_SKILLS: Record<TradeSlug, SkillSeed[]> = {
  electrician: [
    { labelEn: 'House wiring', labelUr: 'گھر کی وائرنگ' },
    { labelEn: 'Switchboard repair', labelUr: 'سوئچ بورڈ کی مرمت' },
    { labelEn: 'Ceiling fan installation', labelUr: 'پنکھا لگانا' },
    { labelEn: 'Fuse and breaker replacement', labelUr: 'فیوز اور بریکر تبدیلی' },
    { labelEn: 'UPS and battery setup', labelUr: 'یو پی ایس اور بیٹری' },
    { labelEn: 'Short circuit fault finding', labelUr: 'شارٹ سرکٹ تلاش کرنا' },
    { labelEn: 'LED light fitting', labelUr: 'ایل ای ڈی لائٹ فٹنگ' },
    { labelEn: 'Meter and main line work', labelUr: 'میٹر اور مین لائن کا کام' },
    { labelEn: 'Generator changeover', labelUr: 'جنریٹر چینج اوور' },
    { labelEn: 'Water motor connection', labelUr: 'پانی کی موٹر کا کنکشن' },
  ],
  plumber: [
    { labelEn: 'Pipe leak repair', labelUr: 'پائپ لیک کی مرمت' },
    { labelEn: 'Geyser installation', labelUr: 'گیزر لگانا' },
    { labelEn: 'Tap and faucet replacement', labelUr: 'نل تبدیل کرنا' },
    { labelEn: 'Drain unblocking', labelUr: 'نالی کھولنا' },
    { labelEn: 'Commode and flush fitting', labelUr: 'کموڈ اور فلش فٹنگ' },
    { labelEn: 'Water tank cleaning', labelUr: 'ٹینکی کی صفائی' },
    { labelEn: 'Water motor repair', labelUr: 'پانی کی موٹر کی مرمت' },
    { labelEn: 'Bathroom fitting', labelUr: 'باتھ روم فٹنگ' },
    { labelEn: 'Sewerage line clearing', labelUr: 'سیوریج لائن کی صفائی' },
    { labelEn: 'Seepage treatment', labelUr: 'سیم اور سیلن کا علاج' },
  ],
  'ac-technician': [
    { labelEn: 'AC gas refilling', labelUr: 'اے سی گیس ری فلنگ' },
    { labelEn: 'Split AC installation', labelUr: 'سپلٹ اے سی انسٹالیشن' },
    { labelEn: 'AC service and cleaning', labelUr: 'اے سی سروس اور صفائی' },
    { labelEn: 'Compressor replacement', labelUr: 'کمپریسر کی تبدیلی' },
    { labelEn: 'Inverter AC repair', labelUr: 'انورٹر اے سی کی مرمت' },
    { labelEn: 'Outdoor unit shifting', labelUr: 'آؤٹ ڈور یونٹ شفٹنگ' },
    { labelEn: 'Refrigerator repair', labelUr: 'فریج کی مرمت' },
    { labelEn: 'Deep freezer repair', labelUr: 'ڈیپ فریزر کی مرمت' },
    { labelEn: 'PCB card repair', labelUr: 'پی سی بی کارڈ کی مرمت' },
    { labelEn: 'Cooling coil cleaning', labelUr: 'کولنگ کوائل کی صفائی' },
  ],
  carpenter: [
    { labelEn: 'Door frame fitting', labelUr: 'دروازے کی چوکھٹ لگانا' },
    { labelEn: 'Wardrobe making', labelUr: 'الماری بنانا' },
    { labelEn: 'Kitchen cabinet work', labelUr: 'کچن کیبنٹ کا کام' },
    { labelEn: 'Furniture polish', labelUr: 'فرنیچر پالش' },
    { labelEn: 'Bed repair', labelUr: 'بیڈ کی مرمت' },
    { labelEn: 'Window fitting', labelUr: 'کھڑکی لگانا' },
    { labelEn: 'Drawer and hinge repair', labelUr: 'دراز اور قبضے کی مرمت' },
    { labelEn: 'Termite proofing', labelUr: 'دیمک سے بچاؤ' },
    { labelEn: 'Lock installation', labelUr: 'تالا لگانا' },
    { labelEn: 'Wooden partition', labelUr: 'لکڑی کا پارٹیشن' },
  ],
  mechanic: [
    { labelEn: 'Engine tuning', labelUr: 'انجن ٹیوننگ' },
    { labelEn: 'Battery and self repair', labelUr: 'بیٹری اور سیلف کی مرمت' },
    { labelEn: 'Brake and clutch work', labelUr: 'بریک اور کلچ کا کام' },
    { labelEn: 'Puncture and tyre work', labelUr: 'پنکچر اور ٹائر کا کام' },
    { labelEn: 'Oil and filter change', labelUr: 'آئل اور فلٹر کی تبدیلی' },
    { labelEn: 'Motorcycle chain setting', labelUr: 'موٹر سائیکل چین سیٹنگ' },
    { labelEn: 'Carburettor cleaning', labelUr: 'کاربوریٹر کی صفائی' },
    { labelEn: 'Generator repair', labelUr: 'جنریٹر کی مرمت' },
    { labelEn: 'Rickshaw repair', labelUr: 'رکشہ کی مرمت' },
    { labelEn: 'Vehicle wiring', labelUr: 'گاڑی کی وائرنگ' },
  ],
  painter: [
    { labelEn: 'Interior wall painting', labelUr: 'اندرونی دیوار کی پینٹنگ' },
    { labelEn: 'Whitewash and distemper', labelUr: 'سفیدی اور ڈسٹمپر' },
    { labelEn: 'Putty and primer work', labelUr: 'پٹی اور پرائمر کا کام' },
    { labelEn: 'Emulsion finishing', labelUr: 'ایملشن فنشنگ' },
    { labelEn: 'Ceiling painting', labelUr: 'چھت کی پینٹنگ' },
    { labelEn: 'Wood and door polish', labelUr: 'لکڑی اور دروازے کی پالش' },
    { labelEn: 'Spray painting', labelUr: 'سپرے پینٹ' },
    { labelEn: 'Damp patch treatment', labelUr: 'سیلن کے داغ کا علاج' },
    { labelEn: 'Grille and gate painting', labelUr: 'گرل اور گیٹ کی پینٹنگ' },
    { labelEn: 'Texture and stencil work', labelUr: 'ٹیکسچر اور اسٹینسل کا کام' },
  ],
  mason: [
    { labelEn: 'Brick masonry', labelUr: 'اینٹوں کی چنائی' },
    { labelEn: 'Plaster work', labelUr: 'پلستر کا کام' },
    { labelEn: 'Floor tile fixing', labelUr: 'فرش پر ٹائل لگانا' },
    { labelEn: 'Bathroom tiling', labelUr: 'باتھ روم ٹائلنگ' },
    { labelEn: 'Marble fitting', labelUr: 'ماربل فٹنگ' },
    { labelEn: 'Roof waterproofing', labelUr: 'چھت کی واٹر پروفنگ' },
    { labelEn: 'Boundary wall construction', labelUr: 'باؤنڈری وال کی تعمیر' },
    { labelEn: 'Crack filling', labelUr: 'دراڑ بھرنا' },
    { labelEn: 'Concrete slab work', labelUr: 'کنکریٹ سلیب کا کام' },
    { labelEn: 'Paver block laying', labelUr: 'پیور بلاک لگانا' },
  ],
};

// ---------------------------------------------------------------------------
// Work-photo tag vocabularies — what a vision model would plausibly name in a
// photo of this trade's work. Kept in English because tags are matched, not read.
// ---------------------------------------------------------------------------

export const TRADE_PHOTO_TAGS: Record<TradeSlug, string[]> = {
  electrician: [
    'switchboard', 'exposed wiring', 'distribution board', 'circuit breaker',
    'ceiling fan', 'conduit pipe', 'voltage tester', 'junction box',
    'led panel light', 'electric meter', 'ups battery', 'insulation tape',
    'wire stripper', 'light fitting',
  ],
  plumber: [
    'pvc pipe', 'pipe wrench', 'water tap', 'geyser', 'drain pipe', 'commode',
    'wash basin', 'flush tank', 'water motor', 'teflon tape', 'leak stain',
    'bathroom fitting', 'water tank', 'pipe joint',
  ],
  'ac-technician': [
    'split ac indoor unit', 'outdoor condenser', 'refrigerant gauge',
    'copper tubing', 'ac filter', 'cooling coil', 'compressor', 'vacuum pump',
    'gas cylinder', 'pcb card', 'wall bracket', 'insulation sleeve',
  ],
  carpenter: [
    'wooden door', 'wardrobe', 'kitchen cabinet', 'chisel', 'hand saw',
    'wood plank', 'door hinge', 'drawer rail', 'polished surface',
    'measuring tape', 'plywood sheet', 'wood shavings',
  ],
  mechanic: [
    'car engine bay', 'motorcycle', 'open bonnet', 'spanner set', 'car battery',
    'brake disc', 'tyre', 'oil filter', 'jack stand', 'carburettor',
    'spark plug', 'workshop floor',
  ],
  painter: [
    'paint roller', 'painted wall', 'paint bucket', 'masking tape', 'ladder',
    'putty knife', 'spray gun', 'ceiling work', 'colour swatch', 'drop sheet',
    'primer coat', 'wall texture',
  ],
  mason: [
    'brick wall', 'cement mortar', 'trowel', 'floor tiles', 'spirit level',
    'plastered wall', 'marble slab', 'concrete mix', 'wheelbarrow',
    'tile cutter', 'steel rebar', 'boundary wall',
  ],
};

// ---------------------------------------------------------------------------
// Rate bands, whole PKR. PROJECT.md §4 caps the world at 800–5,000.
// ---------------------------------------------------------------------------

export type RateBand = { min: number; max: number };

export const TRADE_RATE_BANDS: Record<TradeSlug, RateBand[]> = {
  electrician: [
    { min: 800, max: 1500 }, { min: 1200, max: 2500 },
    { min: 1800, max: 3500 }, { min: 2500, max: 5000 },
  ],
  plumber: [
    { min: 900, max: 1600 }, { min: 1300, max: 2600 },
    { min: 2000, max: 3800 }, { min: 2800, max: 5000 },
  ],
  'ac-technician': [
    { min: 1500, max: 3000 }, { min: 2000, max: 4000 },
    { min: 2500, max: 4500 }, { min: 3000, max: 5000 },
  ],
  carpenter: [
    { min: 1000, max: 2000 }, { min: 1500, max: 3000 },
    { min: 2200, max: 4000 }, { min: 3000, max: 5000 },
  ],
  mechanic: [
    { min: 800, max: 1400 }, { min: 1000, max: 2200 },
    { min: 1600, max: 3200 }, { min: 2200, max: 4500 },
  ],
  painter: [
    { min: 1000, max: 1800 }, { min: 1400, max: 2800 },
    { min: 2000, max: 3600 }, { min: 2600, max: 4800 },
  ],
  mason: [
    { min: 1100, max: 2000 }, { min: 1500, max: 3000 },
    { min: 2200, max: 4200 }, { min: 3000, max: 5000 },
  ],
};

export const PRICE_UNITS = ['job', 'visit', 'day', 'per point'] as const;

export const PRICE_INCLUDES = [
  'labour only',
  'small parts included',
  'materials extra',
  'transport included',
  'one month warranty',
  'second visit free',
] as const;

// ---------------------------------------------------------------------------
// Job descriptions, as a customer would actually give them.
// ---------------------------------------------------------------------------

export type JobDescriptionSeed = {
  /** Which script the customer used. 'roman' is Urdu written in Latin letters. */
  lang: 'en' | 'ur' | 'roman';
  text: string;
  likelyFix: string;
  urgency: 'low' | 'normal' | 'urgent';
  keywords: string[];
};

export const TRADE_JOB_DESCRIPTIONS: Record<TradeSlug, JobDescriptionSeed[]> = {
  electrician: [
    {
      lang: 'en',
      text: 'The switchboard in the lounge sparked this morning and now two sockets are dead.',
      likelyFix: 'Replace the burnt socket and trace the circuit',
      urgency: 'urgent',
      keywords: ['socket', 'spark', 'switchboard'],
    },
    {
      lang: 'en',
      text: 'The ceiling fan in the bedroom runs very slow even at full speed.',
      likelyFix: 'Replace the fan capacitor',
      urgency: 'normal',
      keywords: ['fan', 'capacitor', 'slow'],
    },
    {
      lang: 'en',
      text: 'I need three new light points in the kitchen and one extra socket near the counter.',
      likelyFix: 'Run new wiring points',
      urgency: 'low',
      keywords: ['wiring', 'light point', 'socket'],
    },
    {
      lang: 'ur',
      text: 'رات سے پورے کمرے کی بجلی بند ہے، باقی گھر میں آ رہی ہے۔',
      likelyFix: 'Reset the tripped breaker and trace the short',
      urgency: 'urgent',
      keywords: ['بجلی', 'کمرہ', 'بریکر'],
    },
    {
      lang: 'ur',
      text: 'یو پی ایس بیٹری چارج نہیں ہو رہی، لائٹ جاتے ہی سب بند ہو جاتا ہے۔',
      likelyFix: 'Check the UPS charging circuit and battery terminals',
      urgency: 'normal',
      keywords: ['یو پی ایس', 'بیٹری', 'چارجنگ'],
    },
    {
      lang: 'ur',
      text: 'میٹر کے پاس سے تار جل گئی ہے اور جلنے کی بو آ رہی ہے۔',
      likelyFix: 'Replace the burnt main wire at the meter',
      urgency: 'urgent',
      keywords: ['میٹر', 'تار', 'جلنا'],
    },
    {
      lang: 'roman',
      text: 'Bathroom ke switch se current aata hai, chhoote hi jhatka lagta hai.',
      likelyFix: 'Replace the switch and earth the line',
      urgency: 'urgent',
      keywords: ['switch', 'current', 'jhatka'],
    },
    {
      lang: 'roman',
      text: 'Chhat ke do bulb holder toot gaye hain, naye lagwane hain.',
      likelyFix: 'Replace two light holders',
      urgency: 'low',
      keywords: ['bulb', 'holder', 'light'],
    },
    {
      lang: 'roman',
      text: 'Pankha chalate hi breaker trip ho jata hai, baqi sab theek chalta hai.',
      likelyFix: 'Trace the short in the fan wiring',
      urgency: 'normal',
      keywords: ['pankha', 'breaker', 'trip'],
    },
  ],
  plumber: [
    {
      lang: 'en',
      text: 'The kitchen sink drains very slowly and dirty water backs up into it.',
      likelyFix: 'Clear the blocked kitchen drain',
      urgency: 'normal',
      keywords: ['drain', 'blockage', 'sink'],
    },
    {
      lang: 'en',
      text: 'The geyser is leaking from the bottom and the bathroom floor stays wet all day.',
      likelyFix: 'Replace the geyser tank or the inlet joint',
      urgency: 'urgent',
      keywords: ['geyser', 'leak', 'bathroom'],
    },
    {
      lang: 'en',
      text: 'I want the bathroom tap and shower set replaced with new ones.',
      likelyFix: 'Fit a new tap and shower set',
      urgency: 'low',
      keywords: ['tap', 'shower', 'fitting'],
    },
    {
      lang: 'ur',
      text: 'کموڈ کا فلش ٹینک بھرتا نہیں، پانی مسلسل بہتا رہتا ہے۔',
      likelyFix: 'Replace the flush valve washer',
      urgency: 'normal',
      keywords: ['کموڈ', 'فلش', 'پانی'],
    },
    {
      lang: 'ur',
      text: 'چھت والی ٹینکی اوور فلو ہو کر پانی دیوار پر گرا رہی ہے۔',
      likelyFix: 'Fit a new float valve in the roof tank',
      urgency: 'urgent',
      keywords: ['ٹینکی', 'اوور فلو', 'دیوار'],
    },
    {
      lang: 'ur',
      text: 'صحن کی نالی بند ہے اور گندا پانی واپس آ رہا ہے۔',
      likelyFix: 'Clear the sewerage line blockage',
      urgency: 'urgent',
      keywords: ['نالی', 'بند', 'سیوریج'],
    },
    {
      lang: 'roman',
      text: 'Paani ki motor chal rahi hai lekin tanki mein paani charh nahi raha.',
      likelyFix: 'Check the suction line and the motor impeller',
      urgency: 'normal',
      keywords: ['motor', 'tanki', 'paani'],
    },
    {
      lang: 'roman',
      text: 'Wash basin ke neeche se paani tapak raha hai, alamari kharab ho rahi hai.',
      likelyFix: 'Replace the basin waste pipe seal',
      urgency: 'normal',
      keywords: ['basin', 'leak', 'waste pipe'],
    },
    {
      lang: 'roman',
      text: 'Poore ghar mein paani ka pressure bohat kam ho gaya hai.',
      likelyFix: 'Check the main line and the pressure pump',
      urgency: 'low',
      keywords: ['pressure', 'main line', 'pump'],
    },
  ],
  'ac-technician': [
    {
      lang: 'en',
      text: 'The split AC cools for ten minutes and then starts blowing warm air.',
      likelyFix: 'Gas refill with a leak test',
      urgency: 'normal',
      keywords: ['ac', 'cooling', 'gas'],
    },
    {
      lang: 'en',
      text: 'Water is dripping from the indoor unit onto the bed below it.',
      likelyFix: 'Clear the blocked drain pipe',
      urgency: 'urgent',
      keywords: ['ac', 'water', 'drain'],
    },
    {
      lang: 'en',
      text: 'Two ACs need servicing and the filters cleaned before summer starts.',
      likelyFix: 'Routine service of two units',
      urgency: 'low',
      keywords: ['service', 'filter', 'ac'],
    },
    {
      lang: 'ur',
      text: 'اے سی آن کرتے ہی بریکر ٹرپ ہو جاتا ہے، کمپریسر نہیں چلتا۔',
      likelyFix: 'Test the compressor and its capacitor',
      urgency: 'urgent',
      keywords: ['اے سی', 'کمپریسر', 'ٹرپ'],
    },
    {
      lang: 'ur',
      text: 'اے سی سے بہت آواز آ رہی ہے اور آؤٹ ڈور یونٹ ہل رہا ہے۔',
      likelyFix: 'Tighten the outdoor unit mount and fan',
      urgency: 'normal',
      keywords: ['آواز', 'آؤٹ ڈور', 'یونٹ'],
    },
    {
      lang: 'ur',
      text: 'فریج کا فریزر برف جما دیتا ہے مگر نیچے والا حصہ ٹھنڈا نہیں ہوتا۔',
      likelyFix: 'Clear the blocked defrost line and check the thermostat',
      urgency: 'normal',
      keywords: ['فریج', 'فریزر', 'ٹھنڈا'],
    },
    {
      lang: 'roman',
      text: 'AC ka remote kaam kar raha hai par unit respond nahi karti.',
      likelyFix: 'Check the PCB card and the IR receiver',
      urgency: 'normal',
      keywords: ['remote', 'pcb', 'ac'],
    },
    {
      lang: 'roman',
      text: 'Naya AC khareeda hai, deewar mein install karwana hai aur bracket bhi chahiye.',
      likelyFix: 'Install a new split unit',
      urgency: 'low',
      keywords: ['install', 'split', 'bracket'],
    },
    {
      lang: 'roman',
      text: 'Deep freezer thanda karna chor gaya hai, gosht kharab ho raha hai.',
      likelyFix: 'Gas refill and thermostat check',
      urgency: 'urgent',
      keywords: ['freezer', 'cooling', 'gas'],
    },
  ],
  carpenter: [
    {
      lang: 'en',
      text: 'The main bedroom door does not close, it rubs hard against the frame.',
      likelyFix: 'Plane the door edge and reset the hinges',
      urgency: 'normal',
      keywords: ['door', 'frame', 'hinge'],
    },
    {
      lang: 'en',
      text: 'I want a built-in wardrobe made for a small room, floor to ceiling.',
      likelyFix: 'Build a new fitted wardrobe',
      urgency: 'low',
      keywords: ['wardrobe', 'built-in', 'room'],
    },
    {
      lang: 'en',
      text: 'Two kitchen cabinet doors have come off their hinges and hang open.',
      likelyFix: 'Replace the cabinet hinges',
      urgency: 'normal',
      keywords: ['cabinet', 'hinge', 'kitchen'],
    },
    {
      lang: 'ur',
      text: 'بیڈ کی پٹی ٹوٹ گئی ہے اور گدا بیچ میں دھنس جاتا ہے۔',
      likelyFix: 'Replace the broken bed slat',
      urgency: 'normal',
      keywords: ['بیڈ', 'پٹی', 'گدا'],
    },
    {
      lang: 'ur',
      text: 'دروازے کی چوکھٹ میں دیمک لگ گئی ہے، لکڑی بھربھری ہو گئی ہے۔',
      likelyFix: 'Replace the termite damaged frame',
      urgency: 'urgent',
      keywords: ['دیمک', 'چوکھٹ', 'لکڑی'],
    },
    {
      lang: 'ur',
      text: 'صوفے کی لکڑی ہل گئی ہے اور بیٹھنے پر چرچراتا ہے۔',
      likelyFix: 'Re-glue and screw the sofa frame',
      urgency: 'low',
      keywords: ['صوفہ', 'لکڑی', 'مرمت'],
    },
    {
      lang: 'roman',
      text: 'Kitchen ke drawer ki patri kharab ho gayi hai, poori khulti nahi.',
      likelyFix: 'Replace the drawer rail',
      urgency: 'normal',
      keywords: ['drawer', 'rail', 'kitchen'],
    },
    {
      lang: 'roman',
      text: 'Almari ka taala toot gaya hai, naya lagwana hai aur chabi bhi chahiye.',
      likelyFix: 'Fit a new wardrobe lock',
      urgency: 'normal',
      keywords: ['taala', 'almari', 'lock'],
    },
    {
      lang: 'roman',
      text: 'Khirki ka wooden frame hil gaya hai, baarish mein paani andar aata hai.',
      likelyFix: 'Reseal and refix the window frame',
      urgency: 'normal',
      keywords: ['khirki', 'frame', 'baarish'],
    },
  ],
  mechanic: [
    {
      lang: 'en',
      text: 'The car does not start in the morning, the battery seems weak.',
      likelyFix: 'Test the battery and the alternator',
      urgency: 'urgent',
      keywords: ['car', 'battery', 'starting'],
    },
    {
      lang: 'en',
      text: 'The bike chain keeps slipping and makes a noise in second gear.',
      likelyFix: 'Adjust and lubricate the chain set',
      urgency: 'normal',
      keywords: ['bike', 'chain', 'gear'],
    },
    {
      lang: 'en',
      text: 'I need an oil change and general tuning before a long trip.',
      likelyFix: 'Oil, filter and tuning service',
      urgency: 'low',
      keywords: ['oil change', 'tuning', 'service'],
    },
    {
      lang: 'ur',
      text: 'گاڑی کے بریک دباتے ہوئے آواز آتی ہے اور گاڑی ایک طرف کھنچتی ہے۔',
      likelyFix: 'Replace the brake pads and bleed the line',
      urgency: 'urgent',
      keywords: ['بریک', 'آواز', 'گاڑی'],
    },
    {
      lang: 'ur',
      text: 'موٹر سائیکل کا سیلف کام نہیں کر رہا، صرف کک سے سٹارٹ ہوتی ہے۔',
      likelyFix: 'Repair the self starter motor',
      urgency: 'normal',
      keywords: ['موٹر سائیکل', 'سیلف', 'سٹارٹ'],
    },
    {
      lang: 'ur',
      text: 'جنریٹر سٹارٹ ہوتا ہے مگر دو منٹ بعد خود بند ہو جاتا ہے۔',
      likelyFix: 'Clean the carburettor and the fuel line',
      urgency: 'normal',
      keywords: ['جنریٹر', 'بند', 'کاربوریٹر'],
    },
    {
      lang: 'roman',
      text: 'Gaari ka AC chal raha hai magar thanda nahi karta.',
      likelyFix: 'Car AC gas and compressor check',
      urgency: 'normal',
      keywords: ['gaari', 'ac', 'cooling'],
    },
    {
      lang: 'roman',
      text: 'Tyre mein puncture hai aur stepney bhi flat pari hai.',
      likelyFix: 'Puncture repair on two tyres',
      urgency: 'urgent',
      keywords: ['tyre', 'puncture', 'stepney'],
    },
    {
      lang: 'roman',
      text: 'Rickshaw ka clutch bohat tight ho gaya hai, haath dukhne lagta hai.',
      likelyFix: 'Adjust the rickshaw clutch cable',
      urgency: 'normal',
      keywords: ['rickshaw', 'clutch', 'cable'],
    },
  ],
  painter: [
    {
      lang: 'en',
      text: 'Two bedrooms need repainting, the walls have marks and small cracks.',
      likelyFix: 'Putty, primer and emulsion on two rooms',
      urgency: 'low',
      keywords: ['paint', 'wall', 'crack'],
    },
    {
      lang: 'en',
      text: 'There is a damp patch on the lounge ceiling after last week of rain.',
      likelyFix: 'Treat the damp and repaint the ceiling',
      urgency: 'normal',
      keywords: ['damp', 'ceiling', 'rain'],
    },
    {
      lang: 'en',
      text: 'The main gate and the window grilles need painting, they have started rusting.',
      likelyFix: 'Enamel paint on the gate and grilles',
      urgency: 'low',
      keywords: ['gate', 'grille', 'rust'],
    },
    {
      lang: 'ur',
      text: 'پورے گھر کی سفیدی کرانی ہے، شادی سے پہلے مکمل ہو جائے۔',
      likelyFix: 'Whitewash the full house',
      urgency: 'normal',
      keywords: ['سفیدی', 'گھر', 'شادی'],
    },
    {
      lang: 'ur',
      text: 'دیوار سے پینٹ چھل رہا ہے اور ہاتھ لگانے پر پاؤڈر گرتا ہے۔',
      likelyFix: 'Scrape, re-putty and repaint the wall',
      urgency: 'normal',
      keywords: ['پینٹ', 'دیوار', 'چھلنا'],
    },
    {
      lang: 'ur',
      text: 'کچن کی دیوار پر چکنائی کے داغ ہیں، واشیبل پینٹ کرانا ہے۔',
      likelyFix: 'Washable paint in the kitchen',
      urgency: 'low',
      keywords: ['کچن', 'داغ', 'پینٹ'],
    },
    {
      lang: 'roman',
      text: 'Bachon ke kamray mein halka neela paint karwana hai, aik hafte mein.',
      likelyFix: 'Emulsion paint one room',
      urgency: 'low',
      keywords: ['paint', 'kamra', 'emulsion'],
    },
    {
      lang: 'roman',
      text: 'Darwazon ki polish utar gayi hai, dobara karwani hai.',
      likelyFix: 'Re-polish the wooden doors',
      urgency: 'low',
      keywords: ['polish', 'darwaza', 'wood'],
    },
    {
      lang: 'roman',
      text: 'Chhat par seelan ke dhabbay hain, pehle treatment chahiye phir paint.',
      likelyFix: 'Damp treatment then repaint',
      urgency: 'normal',
      keywords: ['seelan', 'chhat', 'treatment'],
    },
  ],
  mason: [
    {
      lang: 'en',
      text: 'The bathroom floor tiles have come loose and water seeps underneath them.',
      likelyFix: 'Re-lay the loose floor tiles',
      urgency: 'normal',
      keywords: ['tile', 'floor', 'seepage'],
    },
    {
      lang: 'en',
      text: 'There is a crack running along the boundary wall near the gate.',
      likelyFix: 'Fill the crack and re-plaster',
      urgency: 'normal',
      keywords: ['crack', 'boundary wall', 'plaster'],
    },
    {
      lang: 'en',
      text: 'I need a small store room built on the roof, about eight by ten feet.',
      likelyFix: 'Construct a roof store room',
      urgency: 'low',
      keywords: ['construction', 'roof', 'store room'],
    },
    {
      lang: 'ur',
      text: 'چھت سے بارش کا پانی ٹپک رہا ہے، واٹر پروفنگ کرانی ہے۔',
      likelyFix: 'Roof waterproofing',
      urgency: 'urgent',
      keywords: ['چھت', 'پانی', 'واٹر پروفنگ'],
    },
    {
      lang: 'ur',
      text: 'باتھ روم کی ٹائلیں بدلوانی ہیں اور پلستر بھی خراب ہو چکا ہے۔',
      likelyFix: 'Retile the bathroom and patch the plaster',
      urgency: 'normal',
      keywords: ['ٹائل', 'باتھ روم', 'پلستر'],
    },
    {
      lang: 'ur',
      text: 'صحن کا فرش بیٹھ گیا ہے، بارش کا پانی کھڑا ہو جاتا ہے۔',
      likelyFix: 'Re-level the courtyard floor',
      urgency: 'normal',
      keywords: ['فرش', 'صحن', 'پانی'],
    },
    {
      lang: 'roman',
      text: 'Deewar mein se seelan aa rahi hai aur plaster gir raha hai.',
      likelyFix: 'Chip out the damp plaster and redo it',
      urgency: 'normal',
      keywords: ['seelan', 'plaster', 'deewar'],
    },
    {
      lang: 'roman',
      text: 'Marble ki stairs mein se do steps toot gaye hain.',
      likelyFix: 'Replace two marble steps',
      urgency: 'normal',
      keywords: ['marble', 'stairs', 'toot'],
    },
    {
      lang: 'roman',
      text: 'Gate ke paas paver blocks ukhar gaye hain, gaari khari karna mushkil hai.',
      likelyFix: 'Re-lay the paver blocks',
      urgency: 'low',
      keywords: ['paver', 'block', 'gate'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Bios. Tokens are filled in by the seeder: {name} {nameUr} {years}
// {area} {areaUr} {trade} {tradeUr} {skill1} {skill1Ur} {skill2} {skill2Ur}
// ---------------------------------------------------------------------------

export type BioTemplate = { en: string; ur: string };

export const BIO_TEMPLATES: BioTemplate[] = [
  {
    en: '{name} has worked as a {trade} in and around {area} for {years} years. Most of his work is {skill1} and {skill2}.',
    ur: '{nameUr} {years} سال سے {areaUr} اور آس پاس {tradeUr} کا کام کر رہے ہیں۔ زیادہ تر {skill1Ur} اور {skill2Ur} کا کام کرتے ہیں۔',
  },
  {
    en: '{years} years on the tools. {name} takes {skill1} jobs in {area} and tries to finish the same day.',
    ur: '{years} سال کا تجربہ۔ {nameUr} {areaUr} میں {skill1Ur} کا کام لیتے ہیں اور اسی دن مکمل کرنے کی کوشش کرتے ہیں۔',
  },
  {
    en: 'Based in {area}. {name} learned the {trade} trade from his ustad and has worked on his own for {years} years. Strongest on {skill1}.',
    ur: '{areaUr} میں رہتے ہیں۔ {nameUr} نے {tradeUr} کا کام اپنے استاد سے سیکھا اور {years} سال سے خود کام کر رہے ہیں۔ {skill1Ur} میں مہارت ہے۔',
  },
  {
    en: '{name}, {trade} in {area}, {years} years experience. Does {skill1}, {skill2} and takes emergency call-outs at night.',
    ur: '{nameUr}، {areaUr} کے {tradeUr}، {years} سال کا تجربہ۔ {skill1Ur}، {skill2Ur} اور رات کی ایمرجنسی کال بھی لیتے ہیں۔',
  },
  {
    en: 'Works mainly in {area} and the nearby sectors. {years} years as a {trade}. Brings his own tools and quotes the price before starting.',
    ur: 'زیادہ تر {areaUr} اور قریبی سیکٹرز میں کام کرتے ہیں۔ {years} سال سے {tradeUr}۔ اپنا سامان ساتھ لاتے ہیں اور کام شروع کرنے سے پہلے ریٹ بتا دیتے ہیں۔',
  },
  {
    en: '{name} has been taking {trade} work in {area} for {years} years. He prefers {skill1} jobs and leaves the place clean.',
    ur: '{nameUr} {years} سال سے {areaUr} میں {tradeUr} کا کام لے رہے ہیں۔ {skill1Ur} کا کام زیادہ پسند ہے اور جگہ صاف چھوڑتے ہیں۔',
  },
  {
    en: 'Fair rates, no middleman. {name} is a {trade} with {years} years in {area}, mostly {skill1} and {skill2}.',
    ur: 'جائز ریٹ، کوئی درمیانی بندہ نہیں۔ {nameUr} {areaUr} میں {years} سال سے {tradeUr} ہیں، زیادہ تر {skill1Ur} اور {skill2Ur}۔',
  },
  {
    en: '{years} years of {trade} work around {area}. {name} handles {skill1} himself and brings a helper for {skill2}.',
    ur: '{areaUr} کے گرد {years} سال {tradeUr} کا کام۔ {nameUr} {skill1Ur} خود کرتے ہیں اور {skill2Ur} کے لیے مددگار ساتھ لاتے ہیں۔',
  },
];

/** What the voice onboarding would have captured. Same token set as the bios. */
export const ONBOARDING_TRANSCRIPT_TEMPLATES: string[] = [
  'میرا نام {nameUr} ہے، میں {areaUr} میں رہتا ہوں۔ {years} سال سے {tradeUr} کا کام کرتا ہوں۔ {skill1Ur} اور {skill2Ur} کا کام آتا ہے۔ ریٹ {rateMin} سے {rateMax} روپے تک لیتا ہوں۔',
  'جی، {nameUr}۔ {tradeUr} کا کام ہے میرا، {years} سال سے کر رہا ہوں۔ {areaUr} میں رہتا ہوں، آس پاس سارا علاقہ کور کر لیتا ہوں۔ {skill1Ur} میں مہارت ہے۔ {rateMin} سے {rateMax} روپے۔',
  'نام {nameUr} ہے جی۔ {years} سال ہو گئے {tradeUr} کا کام کرتے ہوئے۔ {skill1Ur}، {skill2Ur}، سب کر لیتا ہوں۔ {areaUr} میں گھر ہے۔ کام کے {rateMin} سے {rateMax} روپے لیتا ہوں۔',
  'میں {nameUr}، {areaUr} سے۔ استاد کے ساتھ کام سیکھا، اب {years} سال سے خود {tradeUr} کا کام کرتا ہوں۔ {skill1Ur} زیادہ کرتا ہوں۔ {rateMin} سے {rateMax} تک ریٹ ہے۔',
  '{nameUr} بول رہا ہوں۔ {tradeUr} ہوں، {years} سال کا تجربہ ہے۔ {areaUr} اور قریبی سیکٹرز میں کام کرتا ہوں۔ {skill1Ur} اور {skill2Ur}۔ ریٹ {rateMin} سے {rateMax} روپے۔',
];

/** Customer address labels. Tokens: {house} {street} {area} */
export const ADDRESS_TEMPLATES: string[] = [
  'House {house}, Street {street}, {area}',
  'H# {house}, St# {street}, {area}',
  'Flat {house}, Block {street}, {area}',
  'House {house}, Lane {street}, {area}',
];

// ---------------------------------------------------------------------------
// Voice chat — Outcome 3. Every turn has BOTH scripts, because he speaks Urdu
// and she reads English. {price} is replaced with the job's agreed amount.
// ---------------------------------------------------------------------------

export type ChatTurn = {
  sender: 'worker' | 'customer';
  kind: 'voice' | 'text' | 'chip';
  ur: string;
  en: string;
  durationMs: number;
};

export const CONVERSATION_SCRIPTS: ChatTurn[][] = [
  [
    {
      sender: 'customer', kind: 'voice', durationMs: 4200,
      ur: 'باتھ روم کے نل سے پانی ٹپک رہا ہے، آج آ سکتے ہیں؟',
      en: 'Water is dripping from the bathroom tap. Can you come today?',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 3100,
      ur: 'جی باجی، شام چھ بجے تک پہنچ جاؤں گا۔',
      en: 'Yes sister, I will reach by six in the evening.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 5600,
      ur: 'کام کے {price} روپے لگیں گے، واشر اور ٹیپ کی قیمت شامل ہے۔',
      en: 'The work will cost {price} rupees, washer and tape included.',
    },
    {
      sender: 'customer', kind: 'voice', durationMs: 3800,
      ur: 'ٹھیک ہے، منظور ہے۔ گیٹ نمبر دو سے آ جائیں۔',
      en: 'That is fine, agreed. Come through gate number two.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 2900,
      ur: 'میں گلی میں پہنچ گیا ہوں، دو منٹ میں دروازے پر ہوں۔',
      en: 'I have reached the street, I will be at the door in two minutes.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 3300,
      ur: 'کام مکمل ہو گیا، ایک بار چیک کر لیں۔',
      en: 'The work is done, please check it once.',
    },
  ],
  [
    {
      sender: 'customer', kind: 'voice', durationMs: 5100,
      ur: 'ایک کمرے میں بجلی بالکل نہیں آ رہی، باقی گھر ٹھیک ہے۔',
      en: 'There is no electricity in one room, the rest of the house is fine.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4400,
      ur: 'بریکر ٹرپ ہوا ہو گا، میں دیکھ لوں گا۔ ابھی نکل رہا ہوں۔',
      en: 'The breaker must have tripped, I will check it. I am leaving now.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4800,
      ur: 'دیکھنے کی کوئی فیس نہیں، کام کے {price} روپے بنیں گے۔',
      en: 'There is no inspection fee, the work will come to {price} rupees.',
    },
    {
      sender: 'customer', kind: 'voice', durationMs: 3500,
      ur: 'منظور ہے، لیکن تار اچھی والی لگائیں۔',
      en: 'Agreed, but please use good quality wire.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 3900,
      ur: 'جی، تانبے والی تار لگاؤں گا، گارنٹی میری۔',
      en: 'Yes, I will use copper wire, I guarantee it.',
    },
    {
      sender: 'customer', kind: 'chip', durationMs: 0,
      ur: 'شکریہ، کام اچھا ہوا ہے۔',
      en: 'Thank you, the work has been done well.',
    },
  ],
  [
    {
      sender: 'customer', kind: 'voice', durationMs: 3600,
      ur: 'اے سی چل رہا ہے مگر ٹھنڈا نہیں کر رہا۔',
      en: 'The AC runs but it is not cooling.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 5200,
      ur: 'گیس کم ہو گی یا فلٹر بند ہوں گے، آ کر چیک کرتا ہوں۔',
      en: 'The gas may be low or the filters blocked, I will come and check.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4100,
      ur: 'گیس ری فل اور سروس ملا کر {price} روپے۔',
      en: 'Gas refill plus service together is {price} rupees.',
    },
    {
      sender: 'customer', kind: 'voice', durationMs: 2700,
      ur: 'آج شام کا وقت دے دیں۔',
      en: 'Please give me an evening slot today.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4300,
      ur: 'سات بجے پہنچ جاؤں گا، سیڑھی گھر میں موجود ہے؟',
      en: 'I will reach at seven. Is there a ladder at the house?',
    },
    {
      sender: 'customer', kind: 'text', durationMs: 0,
      ur: 'جی سیڑھی موجود ہے۔',
      en: 'Yes, a ladder is available.',
    },
  ],
  [
    {
      sender: 'customer', kind: 'voice', durationMs: 4000,
      ur: 'الماری کا دروازہ نیچے سے لٹک گیا ہے۔',
      en: 'The wardrobe door is hanging loose at the bottom.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4600,
      ur: 'قبضے بدلنے پڑیں گے، آدھے گھنٹے کا کام ہے۔',
      en: 'The hinges will need changing, it is half an hour of work.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 3700,
      ur: 'قبضوں سمیت {price} روپے لگیں گے۔',
      en: 'With the hinges it will be {price} rupees.',
    },
    {
      sender: 'customer', kind: 'voice', durationMs: 3000,
      ur: 'ٹھیک ہے، کل دوپہر آ جائیں۔',
      en: 'Fine, come tomorrow afternoon.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 3400,
      ur: 'ٹھیک باجی، کل بارہ بجے حاضر ہوں گا۔',
      en: 'All right sister, I will be there at twelve tomorrow.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4500,
      ur: 'کام ہو گیا، لکڑی میں دیمک نہیں تھی، فکر نہ کریں۔',
      en: 'The work is done, there was no termite in the wood, do not worry.',
    },
  ],
  [
    {
      sender: 'customer', kind: 'voice', durationMs: 5400,
      ur: 'چھت سے پانی ٹپک رہا ہے، بارش کے بعد زیادہ ہو گیا ہے۔',
      en: 'Water is dripping from the roof, it got worse after the rain.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4700,
      ur: 'واٹر پروفنگ کرنی پڑے گی، پہلے آ کر دیکھنا ہو گا۔',
      en: 'Waterproofing will be needed, I have to come and see it first.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 6100,
      ur: 'سیمنٹ اور کیمیکل سمیت {price} روپے، دو دن لگیں گے۔',
      en: 'With cement and chemical it is {price} rupees, it will take two days.',
    },
    {
      sender: 'customer', kind: 'voice', durationMs: 3200,
      ur: 'پیسے کام مکمل ہونے پر دوں گی۔',
      en: 'I will pay when the work is complete.',
    },
    {
      sender: 'worker', kind: 'voice', durationMs: 4900,
      ur: 'کوئی مسئلہ نہیں، کل صبح سامان لے کر آتا ہوں۔',
      en: 'No problem, I will bring the material tomorrow morning.',
    },
    {
      sender: 'customer', kind: 'voice', durationMs: 3100,
      ur: 'اللہ کا شکر، اب ٹپکنا بند ہو گیا۔',
      en: 'Thank God, the dripping has stopped now.',
    },
  ],
];

// ---------------------------------------------------------------------------
// Reviews. Each line exists in Urdu script, Roman Urdu and English, so the
// seeder can store either script as the spoken transcript and always keep a
// true English rendering alongside it.
// ---------------------------------------------------------------------------

export type ReviewTone = 'positive' | 'neutral' | 'negative';

export type ReviewLine = { tone: ReviewTone; ur: string; roman: string; en: string };

export const REVIEW_LINES: ReviewLine[] = [
  {
    tone: 'positive',
    ur: 'بہت اچھا کام کیا، وقت پر آیا۔',
    roman: 'Bohat acha kaam kiya, waqt par aya.',
    en: 'He did very good work and came on time.',
  },
  {
    tone: 'positive',
    ur: 'کام صاف ستھرا تھا اور قیمت بھی مناسب۔',
    roman: 'Kaam saaf suthra tha aur rate bhi theek.',
    en: 'The work was clean and the price was fair.',
  },
  {
    tone: 'positive',
    ur: 'فون کرنے کے آدھے گھنٹے میں پہنچ گیا۔',
    roman: 'Phone karne ke aadhe ghantay mein pohanch gaya.',
    en: 'He arrived within half an hour of my call.',
  },
  {
    tone: 'positive',
    ur: 'مسئلہ فوراً سمجھ گیا اور ٹھیک کر دیا۔',
    roman: 'Masla foran samajh gaya aur theek kar diya.',
    en: 'He understood the problem at once and fixed it.',
  },
  {
    tone: 'positive',
    ur: 'کام کے بعد جگہ صاف کر کے گیا۔',
    roman: 'Kaam ke baad jagah saaf kar ke gaya.',
    en: 'He cleaned up the place after finishing.',
  },
  {
    tone: 'positive',
    ur: 'بہت مہذب آدمی ہے، دوبارہ بلاؤں گی۔',
    roman: 'Bohat tameezdar banda hai, phir bulaon gi.',
    en: 'A very polite man, I will call him again.',
  },
  {
    tone: 'positive',
    ur: 'ریٹ پہلے بتا دیا، بعد میں کوئی اضافہ نہیں کیا۔',
    roman: 'Rate pehle bata diya, baad mein kuch extra nahi manga.',
    en: 'He told me the rate first and did not add anything later.',
  },
  {
    tone: 'positive',
    ur: 'تجربہ کار بندہ ہے، کام میں مہارت ہے۔',
    roman: 'Tajurba kaar banda hai, kaam mein maharat hai.',
    en: 'An experienced man, he knows his work.',
  },
  {
    tone: 'positive',
    ur: 'دو سال سے اسی سے کام کرواتی ہوں، کبھی شکایت نہیں ہوئی۔',
    roman: 'Do saal se isi se kaam karwati hoon, kabhi shikayat nahi hui.',
    en: 'I have used him for two years and never had a complaint.',
  },
  {
    tone: 'positive',
    ur: 'سامان بھی اچھا لگایا، گھٹیا چیز نہیں ڈالی۔',
    roman: 'Saamaan bhi acha lagaya, ghatiya cheez nahi daali.',
    en: 'He used good material, nothing cheap.',
  },
  {
    tone: 'positive',
    ur: 'محلے میں سب کو اس کا نمبر دے دیا ہے۔',
    roman: 'Mohallay mein sab ko iska number de diya hai.',
    en: 'I have given his number to everyone in the neighbourhood.',
  },
  {
    tone: 'positive',
    ur: 'رات کو بھی آ گیا، بہت شکریہ۔',
    roman: 'Raat ko bhi aa gaya, bohat shukriya.',
    en: 'He came even at night, many thanks.',
  },
  {
    tone: 'positive',
    ur: 'کام جلدی ہو گیا اور ضمانت بھی دی۔',
    roman: 'Kaam jaldi ho gaya aur guarantee bhi di.',
    en: 'The work was done quickly and he gave a guarantee.',
  },
  {
    tone: 'positive',
    ur: 'بات سمجھ کر کام کرتا ہے، بحث نہیں کرتا۔',
    roman: 'Baat samajh kar kaam karta hai, bahes nahi karta.',
    en: 'He listens and then works, he does not argue.',
  },
  {
    tone: 'positive',
    ur: 'صفائی کا خیال رکھا، فرش خراب نہیں کیا۔',
    roman: 'Safai ka khayal rakha, farsh kharab nahi kiya.',
    en: 'He was careful about cleanliness and did not spoil the floor.',
  },
  {
    tone: 'positive',
    ur: 'پیسے جائز لیے اور کام مکمل کیا۔',
    roman: 'Paise jaiz liye aur kaam mukammal kiya.',
    en: 'He charged a fair amount and completed the work.',
  },
  {
    tone: 'neutral',
    ur: 'کام ٹھیک ہو گیا لیکن آنے میں دیر کی۔',
    roman: 'Kaam theek ho gaya lekin aane mein der ki.',
    en: 'The work got done but he was late.',
  },
  {
    tone: 'neutral',
    ur: 'کام درست ہے، ریٹ کچھ زیادہ لگا۔',
    roman: 'Kaam durust hai, rate thora zyada laga.',
    en: 'The work is correct, the rate felt a bit high.',
  },
  {
    tone: 'neutral',
    ur: 'ٹھیک کام ہے، صفائی پر دھیان دینا چاہیے۔',
    roman: 'Theek kaam hai, safai par dhyan dena chahiye.',
    en: 'The work is fine, he should pay attention to cleaning up.',
  },
  {
    tone: 'neutral',
    ur: 'دوسری بار آ کر مکمل کیا، پہلی بار رہ گیا تھا۔',
    roman: 'Dusri baar aa kar mukammal kiya, pehli baar reh gaya tha.',
    en: 'He finished it on a second visit, the first one was incomplete.',
  },
  {
    tone: 'neutral',
    ur: 'کام چل جائے گا، کوئی خاص بات نہیں۔',
    roman: 'Kaam chal jaye ga, koi khaas baat nahi.',
    en: 'It will do, nothing special.',
  },
  {
    tone: 'negative',
    ur: 'وقت دے کر نہیں آیا، دوبارہ فون کرنا پڑا۔',
    roman: 'Waqt de kar nahi aya, dobara phone karna para.',
    en: 'He gave a time and did not come, I had to call again.',
  },
  {
    tone: 'negative',
    ur: 'کام ادھورا چھوڑ دیا اور پیسے پورے لیے۔',
    roman: 'Kaam adhoora chor diya aur paise poore liye.',
    en: 'He left the work unfinished and took the full payment.',
  },
  {
    tone: 'negative',
    ur: 'ایک ہفتے بعد پھر وہی خرابی ہو گئی۔',
    roman: 'Aik haftay baad phir wohi kharabi ho gayi.',
    en: 'The same fault came back after a week.',
  },
  {
    tone: 'negative',
    ur: 'بتائی ہوئی قیمت سے زیادہ مانگنے لگا۔',
    roman: 'Batai hui qeemat se zyada mangne laga.',
    en: 'He asked for more than the price he had quoted.',
  },
];

/**
 * The canonical review chips. A customer who cannot read still has to be able
 * to leave a review, so the tag set IS the review for many rows.
 */
export type ReviewTag = { en: string; ur: string; positive: boolean };

export const REVIEW_TAGS: ReviewTag[] = [
  { en: 'On time', ur: 'وقت پر آیا', positive: true },
  { en: 'Clean work', ur: 'صاف کام', positive: true },
  { en: 'Fair price', ur: 'مناسب قیمت', positive: true },
  { en: 'Polite', ur: 'مہذب', positive: true },
  { en: 'Skilled', ur: 'ماہر', positive: true },
  { en: 'Came quickly', ur: 'جلدی پہنچا', positive: true },
  { en: 'Cleaned up after', ur: 'صفائی کی', positive: true },
  { en: 'Honest', ur: 'ایماندار', positive: true },
  { en: 'Good materials', ur: 'اچھا سامان', positive: true },
  { en: 'Explained clearly', ur: 'بات سمجھائی', positive: true },
  { en: 'Late', ur: 'دیر سے آیا', positive: false },
  { en: 'Overpriced', ur: 'مہنگا', positive: false },
  { en: 'Left a mess', ur: 'گندگی چھوڑی', positive: false },
  { en: 'Work incomplete', ur: 'ادھورا کام', positive: false },
  { en: 'Did not return', ur: 'دوبارہ نہیں آیا', positive: false },
];

export const POSITIVE_TAGS = REVIEW_TAGS.filter((t) => t.positive).map((t) => t.en);
export const NEGATIVE_TAGS = REVIEW_TAGS.filter((t) => !t.positive).map((t) => t.en);

/** Mobile prefixes actually in use in Pakistan. Numbers themselves are fake. */
export const PHONE_PREFIXES = ['300', '301', '321', '333', '345'] as const;
