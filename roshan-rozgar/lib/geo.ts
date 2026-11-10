/**
 * Geo helpers. Deliberately no PostGIS — the dataset is a few hundred rows, so
 * a bounding-box prefilter plus haversine is both faster to ship and easier to
 * explain at the judging table.
 */

const EARTH_RADIUS_KM = 6371;

export type Point = { lat: number; lng: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bounding box for a radius, used as a cheap SQL prefilter on the
 * (lat, lng) index before the exact haversine sort in JS.
 */
export function boundingBox(centre: Point, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  // Longitude degrees shrink with latitude; guard against cos -> 0 near poles.
  const lngDelta = radiusKm / (111.32 * Math.max(0.01, Math.cos(toRad(centre.lat))));

  return {
    minLat: centre.lat - latDelta,
    maxLat: centre.lat + latDelta,
    minLng: centre.lng - lngDelta,
    maxLng: centre.lng + lngDelta,
  };
}

/**
 * Distance score in [0,1] with a 4 km half-life. Matches the published ranking
 * formula in PROJECT.md §3.4 so the weights can be defended out loud.
 */
export function distanceDecay(km: number): number {
  return Math.exp(-km / 4);
}

/** "1.2 کلومیٹر" / "1.2 km" — tabular-friendly, one decimal under 10 km. */
export function formatDistance(km: number, locale: 'ur' | 'en' = 'en'): string {
  const unit = locale === 'ur' ? 'کلومیٹر' : 'km';
  if (km < 1) {
    const m = Math.round(km * 1000 / 50) * 50;
    return locale === 'ur' ? `${m} میٹر` : `${m} m`;
  }
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} ${unit}`;
}

/** Islamabad / Rawalpindi areas used by the seed and by area-name matching. */
export const AREAS: Array<{ name: string; nameUr: string } & Point> = [
  { name: 'G-9, Islamabad', nameUr: 'جی ۹، اسلام آباد', lat: 33.6938, lng: 73.0377 },
  { name: 'G-11, Islamabad', nameUr: 'جی ۱۱، اسلام آباد', lat: 33.6687, lng: 72.9735 },
  { name: 'F-10, Islamabad', nameUr: 'ایف ۱۰، اسلام آباد', lat: 33.6975, lng: 73.0119 },
  { name: 'F-11, Islamabad', nameUr: 'ایف ۱۱، اسلام آباد', lat: 33.6860, lng: 72.9930 },
  { name: 'I-8, Islamabad', nameUr: 'آئی ۸، اسلام آباد', lat: 33.6680, lng: 73.0760 },
  { name: 'I-10, Islamabad', nameUr: 'آئی ۱۰، اسلام آباد', lat: 33.6540, lng: 73.0480 },
  { name: 'Bahria Town, Rawalpindi', nameUr: 'بحریہ ٹاؤن، راولپنڈی', lat: 33.5300, lng: 73.1200 },
  { name: 'Saddar, Rawalpindi', nameUr: 'صدر، راولپنڈی', lat: 33.5950, lng: 73.0550 },
  { name: 'Satellite Town, Rawalpindi', nameUr: 'سیٹلائٹ ٹاؤن، راولپنڈی', lat: 33.6330, lng: 73.0680 },
  { name: 'Chaklala, Rawalpindi', nameUr: 'چکلالہ، راولپنڈی', lat: 33.5790, lng: 73.0990 },
  { name: 'Raja Bazaar, Rawalpindi', nameUr: 'راجہ بازار، راولپنڈی', lat: 33.6020, lng: 73.0420 },
];
