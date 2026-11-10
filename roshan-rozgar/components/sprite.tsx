/**
 * Every icon, trade glyph and status shape from the canvas export, in one sprite.
 *
 * On the canvas each board was its own document, so a few ids were reused for
 * different shapes. Those are split here and nothing else is touched:
 *   s-free / s-busy / s-off   16-unit viewBox (worker cards, pills, system board)
 *   s-free-lg / -busy-lg / -off-lg   48-unit viewBox (W6's big status buttons)
 *   i-search    C1's magnifier          i-nores   C7's "no results" magnifier
 *   i-phone     handset (call)          i-mobile  C7's handset-on-the-phone shape
 */
export default function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* ---- interface icons, 24-unit viewBox ---- */}
        <g id="i-spk">
          <path d="M4 9v6h4l5 4V5L8 9H4z" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
        </g>
        <g id="i-tools">
          <path d="M14.5 6.5a4 4 0 0 1 5.2-3.7l-2.6 2.6.5 2.5 2.5.5 2.6-2.6a4 4 0 0 1-5.4 4.9L8 20a2 2 0 0 1-3-3l9.3-9.3a4 4 0 0 1 .2-1.2z" />
        </g>
        <g id="i-house">
          <path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6" />
        </g>
        <g id="i-power">
          <path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0" />
        </g>
        <g id="i-chev">
          <path d="M9 5l7 7-7 7" />
        </g>
        <g id="i-lamp">
          <path d="M3 13h18a9 6.5 0 0 1-18 0z" />
          <path d="M12 2.5c2.4 2.4 3.4 4 3.4 5.8a3.4 3.4 0 0 1-6.8 0c0-1.8 1-3.4 3.4-5.8z" />
        </g>
        <g id="i-mic">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        </g>
        <g id="i-kb">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
        </g>
        <g id="i-replay">
          <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4" />
        </g>
        <g id="i-chk">
          <path d="M4 12.5l5 5L20 6.5" />
        </g>
        <g id="i-clock">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </g>
        <g id="i-pin">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </g>
        <g id="i-cam">
          <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
          <circle cx="12" cy="13" r="3.5" />
        </g>
        <g id="i-x">
          <path d="M6 6l12 12M18 6L6 18" />
        </g>
        <g id="i-wire">
          <path d="M3 7h5a4 4 0 0 1 4 4v2a4 4 0 0 0 4 4h5" />
          <circle cx="3" cy="7" r="1" />
          <circle cx="21" cy="17" r="1" />
        </g>
        <g id="i-fan">
          <circle cx="12" cy="12" r="2" />
          <path d="M12 10c0-4 1-7 4-7 2 0 2 3-4 7zM14 12c4 0 7 1 7 4 0 2-3 2-7-4zM12 14c0 4-1 7-4 7-2 0-2-3 4-7zM10 12c-4 0-7-1-7-4 0-2 3-2 7 4z" />
        </g>
        <g id="i-panel">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h2v4H8zM14 7h2v4h-2zM8 14h8M8 17h8" />
        </g>
        <g id="i-geyser">
          <rect x="7" y="2" width="10" height="16" rx="5" />
          <path d="M10 18v4M14 18v4M10 8h4" />
        </g>
        <g id="i-bulb">
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
        </g>
        <g id="i-batt">
          <rect x="3" y="7" width="16" height="10" rx="2" />
          <path d="M21 10v4M8 12h6M11 9v6" />
        </g>
        <g id="i-play">
          <path d="M7 4l13 8-13 8z" />
        </g>
        <g id="i-up">
          <path d="M12 19V5M6 11l6-6 6 6" />
        </g>
        <g id="i-coin">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 8h6M9 11h6M13 8c2 0 2 6-4 6l5 4" />
        </g>
        <g id="i-star">
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
        </g>
        <g id="i-back">
          <path d="M15 5l-7 7 7 7" />
        </g>
        <g id="i-list">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </g>
        <g id="i-phone">
          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />
        </g>
        <g id="i-pen">
          <path d="M4 20h4L19 9l-4-4L4 16z" />
        </g>
        <g id="i-search">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </g>
        <g id="i-eye">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </g>
        <g id="i-send">
          <path d="M3 11l18-8-8 18-2-8z" />
        </g>
        <g id="i-hand">
          <path d="M7 11V5a2 2 0 0 1 4 0v5M11 10V4a2 2 0 0 1 4 0v6M15 10V6a2 2 0 0 1 4 0v8a7 7 0 0 1-12 5l-3-4a2 2 0 0 1 3-3l1 1" />
        </g>
        <g id="i-wrench">
          <path d="M14.5 6.5a4 4 0 0 1 5.2-3.7l-2.6 2.6.5 2.5 2.5.5 2.6-2.6a4 4 0 0 1-5.4 4.9L8 20a2 2 0 0 1-3-3l9.3-9.3a4 4 0 0 1 .2-1.2z" />
        </g>
        <g id="i-flag">
          <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
        </g>
        <g id="i-spark">
          <path d="M4 20l4-4M14 4l6 6-9 9-6-6z" />
        </g>
        <g id="i-smile">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14a5 5 0 0 0 8 0M9 9h.01M15 9h.01" />
        </g>
        <g id="i-nores">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4M8 11h6" />
        </g>
        <g id="i-wifi">
          <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01M3 3l18 18" />
        </g>
        <g id="i-inbox">
          <path d="M3 13l3-8h12l3 8v6H3z" />
          <path d="M3 13h5l1 3h6l1-3h5" />
        </g>
        <g id="i-mobile">
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </g>

        {/* ---- trade glyphs, 48-unit viewBox ---- */}
        <g id="g-elec">
          <rect x="6" y="6" width="36" height="36" rx="12" />
          <path d="M27 11L16 26h7.5l-3 11L32 21h-7.5z" />
        </g>
        <g id="g-plum">
          <path d="M13 4s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z" />
          <path d="M20 43l13-13" />
          <path d="M30 33l-6-6 9-9a6 6 0 0 1 8.5 0l-3 3 1 4 4 1a6 6 0 0 1-1 4l-6 6" />
        </g>
        <g id="g-ac">
          <rect x="5" y="6" width="38" height="14" rx="4" />
          <path d="M11 15h26" />
          <path d="M24 25v18M16.5 29.5l15 9M31.5 29.5l-15 9M21 26.5l3 3 3-3M21 41.5l3-3 3 3" />
        </g>
        <g id="g-carp">
          <path d="M5 27L27 7l6 6-21 19z" />
          <path d="M9 25l2 2M13 21l2 2M17 17l2 2M21 13l2 2" />
          <path d="M30 10l8-4 4 6-7 5" />
          <rect x="4" y="35" width="40" height="8" rx="2" />
        </g>
        <g id="g-mech">
          <path d="M34 5l7 4v8l-7 4-7-4V9z" />
          <circle cx="34" cy="13" r="2.5" />
          <path d="M7 41l16-16" />
          <path d="M19 21l8 8-4 4-8-8z" />
        </g>
        <g id="g-paint">
          <rect x="6" y="6" width="28" height="12" rx="4" />
          <path d="M34 12h6v12H23v7" />
          <rect x="20" y="31" width="6" height="13" rx="2" />
          <path d="M13 18v8a2.5 2.5 0 0 0 5 0v-3" />
        </g>
        <g id="g-mason">
          <path d="M5 25L15 8l9 5-8 17z" />
          <path d="M20 21l7-7" />
          <rect x="22" y="28" width="21" height="15" rx="1.5" />
          <path d="M22 35.5h21M32.5 28v7.5M27 35.5V43M38 35.5V43" />
        </g>

        {/* ---- availability shapes: filled / half / hollow, never colour alone ---- */}
        <g id="s-free">
          <circle cx="8" cy="8" r="7" fill="currentColor" />
        </g>
        <g id="s-busy">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
        </g>
        <g id="s-off">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        </g>
        <g id="s-free-lg">
          <circle cx="24" cy="24" r="20" fill="currentColor" stroke="none" />
        </g>
        <g id="s-busy-lg">
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M24 6a18 18 0 0 1 0 36z" fill="currentColor" stroke="none" />
        </g>
        <g id="s-off-lg">
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="4" />
        </g>
      </defs>
    </svg>
  );
}
