'use client';

/**
 * A plain yellow cursor: one dot that follows the pointer, a little larger over
 * anything clickable and a little smaller while pressed.
 *
 * Only where it makes sense: a real pointing device with motion allowed. On touch,
 * or with prefers-reduced-motion, it renders nothing and the native cursor stays.
 * It never takes pointer events, so it cannot block a click.
 */

import { useEffect, useRef, useState } from 'react';

const INTERACTIVE =
  'a, button, [role="button"], input, select, textarea, label, summary, .tile, .chip, .tg, .fc, .mode, .st, .sb2, .party, .tm';

export default function Cursor() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);

  // Decide whether the cursor belongs here, and keep watching: a plugged-in mouse
  // or a change to the motion setting flips this without a reload.
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const check = () => setLive(fine.matches && !calm.matches);
    check();
    fine.addEventListener('change', check);
    calm.addEventListener('change', check);
    return () => {
      fine.removeEventListener('change', check);
      calm.removeEventListener('change', check);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!live || !el) return;

    const root = document.documentElement;
    root.dataset.cursor = 'on';

    const onMove = (e: PointerEvent) => {
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      el.dataset.show = '1';
      const t = e.target as Element | null;
      el.dataset.hot = t && typeof t.closest === 'function' && t.closest(INTERACTIVE) ? '1' : '0';
    };
    const onDown = () => {
      el.dataset.down = '1';
    };
    const onUp = () => {
      el.dataset.down = '0';
    };
    const onLeave = () => {
      el.dataset.show = '0';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
      delete root.dataset.cursor;
    };
  }, [live]);

  if (!live) return null;
  return (
    <div className="rr-cursor" ref={ref} aria-hidden="true">
      <i />
    </div>
  );
}
