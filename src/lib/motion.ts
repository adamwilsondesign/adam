/**
 * The shared motion vocabulary. Every animated surface draws from these
 * curves so the whole shell moves with one voice:
 *
 * - EASE_OUT: fast start, long velvety settle — entrances, reveals, docks.
 * - EASE_INOUT: symmetric glide — shared-element travel, grid recomposition.
 * - EASE_EXIT: quick, decisive — dismissals and fades-away.
 *
 * Nothing bounces and nothing snaps; the register is fluid and deliberate.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_INOUT = [0.65, 0, 0.35, 1] as const;
export const EASE_EXIT = [0.4, 0, 0.6, 1] as const;

export const DUR = {
  /** Micro state changes: hovers handled in CSS, small fades. */
  fast: 0.24,
  /** Standard entrances and reveals. */
  base: 0.48,
  /** Shared-element travel and large surfaces. */
  slow: 0.62,
  /** Grid recomposition glide (filter reflow settles within ~450ms). */
  grid: 0.42,
} as const;

/* ------------------------------------------------------------------ */
/* Cinematic camera curves (canvas-side)                               */
/* ------------------------------------------------------------------ */

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/**
 * Smootherstep (Perlin): zero first and second derivative at both ends, so
 * camera moves start and stop with no mechanical snap.
 */
export function smootherstep(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** A monotonic camera glide with zero velocity and acceleration at both ends.
 * No optical overshoot: depth projection must never briefly reverse at arrival. */
export function cinematicEase(t: number): number {
  return smootherstep(t);
}

/** Frame-rate independent exponential response; rate is in inverse seconds. */
export function dampingFactor(deltaMs: number, rate = 4.5): number {
  return 1 - Math.exp((-rate * Math.max(0, deltaMs)) / 1000);
}

/** The time of the curve's single maximum — it rises monotonically to here. */
export const CINEMATIC_PEAK_T = (() => {
  let best = 1;
  let bestValue = 1;
  for (let i = 0; i <= 200; i++) {
    const t = 0.5 + (i / 200) * 0.5;
    const v = cinematicEase(t);
    if (v > bestValue) {
      bestValue = v;
      best = t;
    }
  }
  return best;
})();

/**
 * First time at which cinematicEase reaches `value` (for value ≤ 1): the
 * curve rises monotonically until its single peak, so bisection on that
 * rising segment finds the first crossing.
 */
export function invCinematicEase(value: number): number {
  if (value <= 0) return 0;
  if (value >= cinematicEase(CINEMATIC_PEAK_T)) return CINEMATIC_PEAK_T;
  let lo = 0;
  let hi = CINEMATIC_PEAK_T;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (cinematicEase(mid) < value) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
