'use client';

/**
 * C0 · Customer profile: name + location.
 *
 * Runs the first time a customer opens the app (describe sends them here when
 * there is no saved profile) and again whenever they tap their address to change
 * it. The location is what every search is centred on, so it is chosen with live
 * GPS or from the list of Islamabad / Rawalpindi areas when GPS is blocked.
 *
 * Auth is mocked (no OTP, per the brief), so a phone number is generated for the
 * profile. There is no customer update endpoint, so saving creates a fresh
 * profile and makes it the current one.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Stage from '@/components/stage';
import { useLang, type Lang } from '@/components/lang';
import { ExitBtn, Icon, LangSwitch, Screen } from '@/components/ui';
import { ErrorState } from '@/components/customer/states';
import { AREAS, haversineKm } from '@/lib/geo';
import { api, getSession, saveSession, type DemoUser } from '@/lib/client-api';

const D: Record<Lang, Record<string, string>> = {
  ur: { h: 'اپنا پروفائل بنائیں', sub: 'نام اور جگہ بتائیں تاکہ قریبی کاریگر مل سکیں۔', name: 'آپ کا نام', ph: 'مثلاً عائشہ', where: 'آپ کہاں ہیں؟', live: 'میری موجودہ جگہ استعمال کریں', locating: 'جگہ ڈھونڈ رہے ہیں…', got: 'جگہ مل گئی', or: 'یا فہرست سے چنیں', pick: 'علاقہ چنیں', detail: 'مکان / گلی (اختیاری)', detailPh: 'مکان 14، گلی 22', denied: 'جگہ کی اجازت نہیں ملی۔ براہ کرم نیچے فہرست سے علاقہ چنیں۔', unsupported: 'یہ براؤزر جگہ نہیں بتا سکتا۔ فہرست سے چنیں۔', save: 'محفوظ کریں اور آگے بڑھیں', saving: 'محفوظ ہو رہا ہے…', needName: 'براہ کرم اپنا نام لکھیں', needLoc: 'براہ کرم اپنی جگہ چنیں', back: 'واپس', near: 'قریب' },
  rm: { h: 'Apna profile banayein', sub: 'Naam aur jagah batayein taake qareebi kaarigar mil sakein.', name: 'Aap ka naam', ph: 'masalan Ayesha', where: 'Aap kahan hain?', live: 'Meri mojooda jagah istemal karein', locating: 'Jagah dhoondh rahe hain…', got: 'Jagah mil gayi', or: 'Ya fehrist se chunein', pick: 'Ilaaqa chunein', detail: 'Makan / gali (ikhtiyari)', detailPh: 'Makan 14, Gali 22', denied: 'Jagah ki ijazat nahi mili. Neeche fehrist se ilaaqa chunein.', unsupported: 'Yeh browser jagah nahi bata sakta. Fehrist se chunein.', save: 'Mehfooz karein aur aage barhein', saving: 'Mehfooz ho raha hai…', needName: 'Apna naam likhein', needLoc: 'Apni jagah chunein', back: 'Wapas', near: 'qareeb' },
  en: { h: 'Set up your profile', sub: 'Tell us your name and location so we can find workers near you.', name: 'Your name', ph: 'e.g. Ayesha', where: 'Where are you?', live: 'Use my live location', locating: 'Finding your location…', got: 'Location found', or: 'Or choose from the list', pick: 'Choose an area', detail: 'House / street (optional)', detailPh: 'House 14, Street 22', denied: 'Location permission was denied. Please choose your area from the list below.', unsupported: 'This browser cannot share a location. Choose from the list.', save: 'Save and continue', saving: 'Saving…', needName: 'Please enter your name', needLoc: 'Please choose your location', back: 'Back', near: 'Near' },
};

type Spot = { lat: number; lng: number; area: string };

/** The closest known area to a coordinate, if any is within 15 km. */
function nearestArea(lat: number, lng: number): string | null {
  let best: { name: string; km: number } | null = null;
  for (const a of AREAS) {
    const km = haversineKm({ lat, lng }, a);
    if (!best || km < best.km) best = { name: a.name, km };
  }
  return best && best.km <= 15 ? best.name : null;
}

const randomPhone = () => `+923${Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')}`;

export default function CustomerSetupPage() {
  const { lang } = useLang('en');
  const t = D[lang];
  const router = useRouter();
  const [name, setName] = useState('');
  const [spot, setSpot] = useState<Spot | null>(null);
  const [detail, setDetail] = useState('');
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    const me = getSession('customer');
    if (me) { setExisting(true); setName(me.name); if (me.lat != null && me.lng != null) setSpot({ lat: me.lat, lng: me.lng, area: me.addressLabel ?? '' }); }
  }, []);

  function useLive() {
    setNote(''); setError('');
    if (!('geolocation' in navigator)) { setNote(t.unsupported); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const near = nearestArea(lat, lng);
        setSpot({ lat, lng, area: near ? `${t.near} ${near}` : `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        setLocating(false);
      },
      () => { setLocating(false); setNote(t.denied); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function chooseArea(value: string) {
    const a = AREAS.find((x) => x.name === value);
    if (a) { setSpot({ lat: a.lat, lng: a.lng, area: a.name }); setNote(''); }
  }

  async function save() {
    if (name.trim().length < 2) { setError(t.needName); return; }
    if (!spot) { setError(t.needLoc); return; }
    setSaving(true); setError('');
    try {
      const label = [detail.trim(), spot.area].filter(Boolean).join(', ').slice(0, 118);
      const { data } = await api<DemoUser>('/api/customers', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone: randomPhone(), pin: '0000', lat: spot.lat, lng: spot.lng, addressLabel: label || spot.area }),
      });
      saveSession('customer', data);
      router.push('/customer/describe');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your profile.'); }
    finally { setSaving(false); }
  }

  return (
    <Stage>
      <Screen skin="cust" defaultLang="en" id="s-c0" extra="rr-screen">
        <header className="top">
          {existing ? <Link className="iconbtn" href="/customer/describe" aria-label={t.back}><Icon name="i-back" cls="s24 flip" /></Link> : <span className="fx" />}
          <LangSwitch fallback="en" style={{ flex: 'none', width: '188px' }} />
          <ExitBtn />
        </header>

        <main className="col g16 fx px" style={{ overflowY: 'auto', paddingBottom: 18 }}>
          <div className="col g4"><h1 className="t">{t.h}</h1><p className="l soft">{t.sub}</p></div>

          <label className="col g8 l bold">{t.name}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t.ph} autoComplete="name" style={{ minHeight: 52, border: '2px solid var(--line)', borderRadius: 14, padding: '0 14px', font: 'inherit' }} />
          </label>

          <div className="col g12">
            <span className="l bold">{t.where}</span>
            <button type="button" className="btn btn-t" style={{ minHeight: 56 }} disabled={locating} onClick={useLive}>
              <Icon name="i-pin" cls="s24" />{locating ? t.locating : t.live}
            </button>
            {note && <p role="alert" className="l" style={{ color: '#b3162b' }}>{note}</p>}

            <span className="l soft">{t.or}</span>
            <select value={AREAS.some((a) => a.name === spot?.area) ? spot?.area : ''} onChange={(e) => chooseArea(e.target.value)} aria-label={t.pick} style={{ minHeight: 52, border: '2px solid var(--line)', borderRadius: 14, padding: '0 12px', font: 'inherit', background: 'var(--surface, #fff)' }}>
              <option value="">{t.pick}</option>
              {AREAS.map((a) => <option key={a.name} value={a.name}>{lang === 'ur' ? a.nameUr : a.name}</option>)}
            </select>

            {spot && <div className="card row g12" role="status" style={{ padding: 12, borderRadius: 14 }}><Icon name="i-chk" cls="s24" /><div className="col fx"><b>{t.got}</b><span className="l soft">{spot.area}</span></div></div>}

            <label className="col g8 l bold">{t.detail}
              <input value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={80} placeholder={t.detailPh} style={{ minHeight: 52, border: '2px solid var(--line)', borderRadius: 14, padding: '0 14px', font: 'inherit' }} />
            </label>
          </div>

          {error && <ErrorState message={error} />}
        </main>

        <div className="dock">
          <button type="button" className="btn btn-t" style={{ minHeight: 56 }} disabled={saving} onClick={() => void save()}>
            <Icon name="i-chk" cls="s24" />{saving ? t.saving : t.save}
          </button>
        </div>
      </Screen>
    </Stage>
  );
}
