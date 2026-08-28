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
