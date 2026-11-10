'use client';

/** Design system board — `System.dc.html` on the canvas (1280 × 1560). */

import Stage from '@/components/stage';
import { useLang } from '@/components/lang';
import { Glyph, Icon, Shape } from '@/components/ui';
import { speak } from '@/lib/speech';

const COLORS = [
  ['ink', '#0B1020'], ['ink-soft', '#3A4256'], ['paper', '#F8F6F1'], ['slate', '#F3F5F8'],
  ['roshan', '#FF9F1C'], ['roshan-deep', '#D97E06'], ['roshan-text', '#8A4A00'], ['teal', '#0E6E6B'],
  ['teal-deep', '#0A5250'], ['free', '#1D9A5F'], ['busy', '#C2410C'], ['off', '#6B7280'],
  ['accept', '#0B6B3D'], ['decline', '#B3162B'], ['star', '#F2B01E'], ['rose', '#E8336D'],
  ['cobalt', '#2A4BD7'], ['leaf', '#3FA34D'],
];

const TRADES = [
  ['elec', 'Electrician', 'بجلی والا', 'bijli waala', '#F2B01E'],
  ['plum', 'Plumber', 'پلمبر', 'plumber', '#2A6FD7'],
  ['ac', 'AC technician', 'اے سی والا', 'AC waala', '#2BB3C0'],
  ['carp', 'Carpenter', 'بڑھئی', 'barhai', '#A4622D'],
  ['mech', 'Mechanic', 'مستری', 'mistri', '#55606E'],
  ['paint', 'Painter', 'پینٹر', 'painter', '#7A4FD1'],
  ['mason', 'Mason', 'راج مستری', 'raj mistri', '#8A8178'],
];

const LAWS: Array<[string, string]> = [
  ['Squint test.', 'No text-only control: every action has a glyph, colour and shape.'],
  ['Thumb law.', 'Primary actions in the bottom 35%. 56px worker / 44px customer targets.'],
  ['Three decisions max', 'per worker screen. No hamburger menu anywhere.'],
  ['Status ×3.', 'Filled / half / hollow circle + word + motion. Never colour alone.'],
  ['RTL first.', 'Logical CSS only; direction icons flip, numerals and the Latin wordmark don’t.'],
  ['Contrast.', 'Amber is a surface; amber text uses #8A4A00. Glyphs on amber are ink, not white.'],
  ['Trust rendered.', 'Ratings always show job count, recency and review source count.'],
  ['Honest AI.', 'Every AI surface carries the cobalt AI chip; mocked data is labelled “demo”.'],
];

export default function SystemPage() {
  const { theme } = useLang('en');

  return (
    <Stage w={1280} h={1560} wide>
      <div
        className="app work en s-sys rr-screen"
        dir="ltr"
        lang="en"
        data-theme={theme}
        style={{ width: '1280px', height: '1560px', padding: '48px', gap: '24px', overflow: 'hidden' }}
      >
        <div className="row sb">
          <div className="col g4">
            <h1 style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1.1 }}>Roshan Rozgar — design system</h1>
            <p className="soft" style={{ fontSize: '18px' }}>
              Two skins over one system: worker (Kaarigar, warm paper + amber) and customer (Ghar, cool slate + teal).
            </p>
          </div>
          <div className="lockup col" style={{ width: '300px' }}>
            <div className="truck" />
            <div
              style={{
                padding: '6px 20px',
                fontFamily: "'Noto Nastaliq Urdu', serif",
                fontSize: '34px',
                lineHeight: 1.9,
                textAlign: 'center',
              }}
              lang="ur"
            >
              روشن روزگار
            </div>
            <div className="truck" />
          </div>
        </div>

        <section className="sec">
          <h2 className="h2">Colour tokens</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: '16px' }}>
            {COLORS.map(([n, hex], i) => (
              <div className="sw rr-rise" key={n} style={{ ['--i' as string]: i }}>
                <i style={{ background: hex }} />
                <b>{n}</b>
                <span>{hex}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '24px' }}>
          <section className="sec">
            <h2 className="h2">Trade quadruple · colour + glyph + Urdu word + audio</h2>
            <div>
              {TRADES.map(([id, en, ur, say, hex]) => (
                <div className={`trow tr-${id}`} key={id}>
                  <span className="gl s56">
                    <Glyph name={`g-${id}`} />
                  </span>
                  <b>{en}</b>
                  <span className="ur-w" lang="ur">
                    {ur}
                  </span>
                  <button
                    type="button"
                    className="row g8 soft"
                    aria-label={`Hear: ${say}`}
                    onClick={() => speak(ur, 'ur')}
                    style={{ background: 'none', border: 0, padding: 0, textAlign: 'start' }}
                  >
                    <Icon name="i-spk" cls="s20" />
                    <i>{say}</i>
                  </button>
                  <span className="num soft" style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13px' }}>
                    {hex}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="col g24">
            <section className="sec">
              <h2 className="h2">Type</h2>
              <div className="row g24" style={{ alignItems: 'flex-start' }}>
                <div className="col g8 fx">
                  <span className="xs soft">WORKER · 40 / 30 / 20 / 18</span>
                  <span style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1.1 }}>Display</span>
                  <span style={{ fontSize: '30px', fontWeight: 800 }}>Title</span>
                  <span style={{ fontSize: '20px' }}>Body 20 — floor 18px</span>
                </div>
                <div className="col g8 fx">
                  <span className="xs soft">CUSTOMER · 30 / 22 / 16 / 14</span>
                  <span style={{ fontSize: '30px', fontWeight: 800, lineHeight: 1.15 }}>Display</span>
                  <span style={{ fontSize: '22px', fontWeight: 800 }}>Title</span>
                  <span style={{ fontSize: '16px' }}>Body 16 — floor 14px</span>
                </div>
              </div>
              <div className="row g24" lang="ur" dir="rtl">
                <span style={{ fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: '32px', lineHeight: 2 }}>
                  نستعلیق — سرخی
                </span>
                <span style={{ fontFamily: "'Noto Naskh Arabic', serif", fontSize: '22px', lineHeight: 1.75 }}>
                  نسخ — عام متن کے لیے
                </span>
              </div>
              <p className="soft" style={{ fontSize: '14px' }}>
                Plus Jakarta Sans for Latin UI. Nastaliq for display only (its sloped baseline hurts small-size
                reading); Naskh carries Urdu body. Urdu +2px and +0.25 line-height at every step. Tabular numerals
                everywhere.
              </p>
            </section>

            <section className="sec">
              <h2 className="h2">Components</h2>
              <div className="row g16 wrap">
                <div className="orb">
                  <button className="mic" aria-label="Voice button">
                    <Icon name="i-mic" cls="lg" />
                  </button>
                </div>
                <div className="col g8 fx">
                  <div className="row g8">
                    <button type="button" className="btn btn-ok" style={{ minHeight: '56px', flex: 1 }}>
                      <Icon name="i-chk" />
                      Yes, I’ll do it
                    </button>
                    <button
                      type="button"
                      className="btn btn-no"
                      style={{ minHeight: '56px', flex: 1, borderRadius: '999px' }}
                    >
                      <Icon name="i-x" />
                      Not now
                    </button>
                  </div>
                  <div className="row g8 wrap">
                    <span className="pill">
                      <span className="dot">
                        <Shape name="s-free" />
                      </span>
                      Available
                    </span>
                    <span className="pill busy">
                      <span className="dot">
                        <Shape name="s-busy" />
                      </span>
                      On a job
                    </span>
                    <span className="pill off">
                      <span className="dot">
                        <Shape name="s-off" />
                      </span>
                      Off today
                    </span>
                    <span className="ai">AI · demo</span>
                  </div>
                </div>
              </div>
              <div className="ribbon">
                <i />
              </div>
            </section>
          </div>
        </div>

        <section className="sec" style={{ flex: 1 }}>
          <h2 className="h2">Laws applied on every screen</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '16px',
              fontSize: '15px',
              lineHeight: 1.5,
            }}
          >
            {LAWS.map(([b, rest]) => (
              <p key={b}>
                <b>{b}</b> {rest}
              </p>
            ))}
          </div>
        </section>
      </div>
    </Stage>
  );
}
