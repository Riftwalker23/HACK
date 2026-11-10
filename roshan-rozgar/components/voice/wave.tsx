'use client';

/**
 * The design's `.wave` bars, driven by the live microphone level.
 *
 * Idle: the bars sit low and still. Recording: each bar's height follows the
 * real loudness (0..1 from useRecorder), with a fixed per-bar spread so it
 * reads as a waveform rather than one block. Purely decorative (aria-hidden).
 */

const SPREAD = [0.45, 0.7, 0.9, 0.6, 1, 0.75, 0.5, 0.85, 0.65, 0.95, 0.55, 0.8, 0.7, 1, 0.6, 0.85, 0.5, 0.75];

export function Wave({ level, active, bars = 18 }: { level: number; active: boolean; bars?: number }) {
  return (
    <div className="wave" aria-hidden="true" style={{ opacity: active ? 1 : 0.35 }}>
      {Array.from({ length: bars }, (_, i) => {
        const spread = SPREAD[i % SPREAD.length]!;
        const h = active ? Math.max(12, Math.min(100, 12 + level * 100 * spread * 1.4)) : 18;
        return (
          <i
            key={i}
            style={{
              height: `${h}%`,
              animationPlayState: active ? 'running' : 'paused',
              transition: 'height 80ms linear',
            }}
          />
        );
      })}
    </div>
  );
}
