'use client';

/**
 * The stage a screen sits on.
 *
 *  - On a phone (≤ 480px wide) the screen fills the whole display, edge to edge,
 *    like an installed app. No frame, no chrome.
 *  - On a laptop/desktop it shows as a phone-sized frame centred on the page,
 *    scaled down (never up) so the whole screen is always visible.
 *
 * The designed screen is never altered: it is a flex column that simply gets the
 * width and height of the frame it is in (390 × 844 on desktop, the device on a
 * phone). The screen-jump bar is a developer tool: it only shows with `?nav=1`.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { BOARDS } from '@/lib/screens';
import { useStageTheme } from './lang';

/* --- viewport size as a tiny external store (no setState-in-effect) --- */
function subscribeSize(cb: () => void) {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
  };
}
const sizeNow = () => `${window.innerWidth}x${window.innerHeight}`;
const sizeServer = () => '0x0';

/* --- ?nav=1 shows the developer screen-jump bar --- */
const noopSubscribe = () => () => {};
const navNow = () => new URLSearchParams(window.location.search).has('nav');
const navServer = () => false;

export default function Stage({
  children,
  w = 390,
  h = 844,
  wide = false,
}: {
  children: React.ReactNode;
  w?: number;
  h?: number;
  wide?: boolean;
}) {
  const path = usePathname();
  const { dark, setDark } = useStageTheme();
  const showNav = useSyncExternalStore(noopSubscribe, navNow, navServer);
  const size = useSyncExternalStore(subscribeSize, sizeNow, sizeServer);

  const [vw, vh] = size.split('x').map(Number);
  // Scale to fit the window, never above 1×. Phones are handled in CSS (full bleed),
  // so this only matters for the desktop frame and the wide design-system board.
  let fit = 1;
  if (vw > 0) {
    const availW = vw - 32;
    const availH = vh - (showNav ? 96 : 32);
    fit = wide ? Math.min(1, availW / w) : Math.min(1, availW / w, availH / h);
  }

  return (
    <div className={`stage${wide ? ' stage-wide' : ''}`}>
      {showNav && (
        <nav className="chrome" aria-label="Screens">
          <span className="brand">Roshan&nbsp;Rozgar</span>
          {BOARDS.map((b) => (
            <Link
              key={b.href}
              href={`${b.href}?nav=1`}
              className={b.href === path ? 'on' : ''}
              title={b.title}
            >
              {b.short}
            </Link>
          ))}
          <button type="button" className="chrome-sp" onClick={() => setDark(!dark)} aria-pressed={dark}>
            {dark ? 'Dark' : 'Light'}
          </button>
        </nav>
      )}

      <div
        className={`frame${wide ? ' frame-wide' : ''}`}
        style={{ ['--fit' as string]: fit, ['--fw' as string]: w, ['--fh' as string]: h }}
      >
        {children}
      </div>
    </div>
  );
}
