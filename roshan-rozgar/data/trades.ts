/**
 * The seven trades, from Design.md §3.3.
 *
 * Each trade is a QUADRUPLE: colour + glyph + Urdu word + spoken label. That is
 * the accessibility centrepiece — a worker who cannot read picks his trade by
 * recognising his own tool and hearing the word confirmed, and the same colour
 * then follows him through the entire product.
 *
 * `keywords` feed the problem classifier (and its offline stub), so they must
 * include the words a customer would actually use in English, Urdu and Roman
 * Urdu — "geyser", "گیزر", "geezar" all have to land on the plumber.
 */

export type TradeSeed = {
  slug: string;
  nameEn: string;
  nameUr: string;
  nameRoman: string;
  color: string;
  glyph: string;
  keywords: string[];
};

export const TRADES: TradeSeed[] = [
  {
    slug: 'electrician',
    nameEn: 'Electrician',
    nameUr: 'بجلی والا',
    nameRoman: 'bijli waala',
    color: '#F2B01E',
    glyph: 'bolt-socket',
    keywords: [
      'electric', 'electrician', 'wiring', 'wire', 'socket', 'switch', 'fuse',
      'breaker', 'short circuit', 'light', 'bulb', 'fan', 'meter', 'ups',
      'generator', 'load shedding', 'power', 'current', 'shock', 'mcb',
      'bijli', 'bijlee', 'taar', 'switch board', 'current nahi',
      'بجلی', 'تار', 'سوئچ', 'بلب', 'پنکھا', 'میٹر', 'کرنٹ',
    ],
  },
  {
    slug: 'plumber',
    nameEn: 'Plumber',
    nameUr: 'پلمبر',
    nameRoman: 'plumber',
    color: '#2A6FD7',
    glyph: 'droplet-wrench',
    keywords: [
      'plumber', 'plumbing', 'pipe', 'leak', 'leaking', 'tap', 'faucet',
      'geyser', 'geezar', 'water', 'drain', 'blockage', 'blocked', 'choked',
      'commode', 'toilet', 'flush', 'basin', 'sink', 'motor', 'water tank',
      'sewerage', 'seepage', 'nali', 'tanki', 'paani',
      'پانی', 'نل', 'ٹینکی', 'گیزر', 'پائپ', 'لیک', 'نالی', 'کموڈ',
    ],
  },
  {
    slug: 'ac-technician',
    nameEn: 'AC Technician',
    nameUr: 'اے سی والا',
    nameRoman: 'AC waala',
    color: '#2BB3C0',
    glyph: 'snowflake-split',
    keywords: [
      'ac', 'a/c', 'air conditioner', 'air conditioning', 'cooling', 'not cooling',
      'gas refill', 'inverter ac', 'split', 'window ac', 'compressor', 'outdoor unit',
      'service', 'dc inverter', 'refrigerator', 'fridge', 'deep freezer', 'chiller',
      'ac service', 'ac gas',
      'اے سی', 'ٹھنڈا', 'گیس', 'فریج', 'کولنگ',
    ],
  },
  {
    slug: 'carpenter',
    nameEn: 'Carpenter',
    nameUr: 'بڑھئی',
    nameRoman: 'barhai',
    color: '#A4622D',
    glyph: 'saw-plank',
    keywords: [
      'carpenter', 'wood', 'wooden', 'door', 'window', 'frame', 'cupboard',
      'almari', 'wardrobe', 'kitchen cabinet', 'furniture', 'bed', 'table',
      'chair', 'drawer', 'hinge', 'lock', 'polish', 'termite', 'deemak',
      'lakri', 'darwaza',
      'لکڑی', 'دروازہ', 'الماری', 'فرنیچر', 'کھڑکی', 'دیمک',
    ],
  },
  {
    slug: 'mechanic',
    nameEn: 'Mechanic',
    nameUr: 'مستری',
    nameRoman: 'mistri',
    color: '#55606E',
    glyph: 'wrench-bolt',
    keywords: [
      'mechanic', 'car', 'bike', 'motorcycle', 'engine', 'battery', 'tyre',
      'tire', 'puncture', 'brake', 'clutch', 'oil change', 'tuning', 'starting',
      'not starting', 'silencer', 'chain', 'rickshaw', 'generator repair',
      'gaari', 'motorcycle theek',
      'گاڑی', 'انجن', 'بیٹری', 'ٹائر', 'موٹر سائیکل', 'بریک',
    ],
  },
  {
    slug: 'painter',
    nameEn: 'Painter',
    nameUr: 'پینٹر',
    nameRoman: 'painter',
    color: '#7A4FD1',
    glyph: 'roller-drip',
    keywords: [
      'painter', 'paint', 'painting', 'whitewash', 'white wash', 'distemper',
      'emulsion', 'wall', 'ceiling', 'putty', 'primer', 'polish', 'spray',
      'colour', 'color', 'damp patch', 'peeling',
      'رنگ', 'پینٹ', 'دیوار', 'سفیدی', 'چھت',
    ],
  },
  {
    slug: 'mason',
    nameEn: 'Mason',
    nameUr: 'راج مستری',
    nameRoman: 'raj mistri',
    color: '#8A8178',
    glyph: 'trowel-brick',
    keywords: [
      'mason', 'masonry', 'brick', 'cement', 'concrete', 'plaster', 'tiles',
      'tile', 'marble', 'flooring', 'floor', 'roof', 'boundary wall', 'crack',
      'construction', 'repair wall', 'bathroom tiles', 'chhat',
      'اینٹ', 'سیمنٹ', 'پلستر', 'ٹائل', 'چھت', 'فرش', 'دیوار',
    ],
  },
];

export const TRADE_SLUGS = TRADES.map((t) => t.slug);

export function tradeBySlug(slug: string): TradeSeed | undefined {
  return TRADES.find((t) => t.slug === slug);
}

/** Shape the AI layer passes to the classifier as its allowed label set. */
export function allowedTrades() {
  return TRADES.map(({ slug, nameEn, nameUr, keywords }) => ({
    slug,
    nameEn,
    nameUr,
    keywords,
  }));
}
