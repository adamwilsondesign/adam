/** Shared handoff between the star camera, live clouds and accessible doorway. */
export const worldState = {
  ready: false,
  portalRevision: 0,
  workTravel: 0,
  portal: null as HTMLElement | null,
  portalHover: false,
};

/** Original cubic travel with its acceleration reversal rounded over the middle 16%.
 * Outside that interval the approved trajectory is unchanged.
 */
export function travelEase(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.42) return 4 * x * x * x;
  if (x > 0.58) return 1 - 4 * (1 - x) ** 3;
  const u = (x - 0.42) / 0.16;
  // Quintic Hermite interpolation of position, velocity and acceleration.
  const p = 4 * 0.42 ** 3,
    v = 12 * 0.42 ** 2 * 0.16,
    a = 24 * 0.42 * 0.16 * 0.16;
  const d = 1 - 2 * p;
  return (
    p +
    v * u +
    (a * u * u) / 2 +
    (10 * d - 10 * v - 2 * a) * u ** 3 +
    (-15 * d + 15 * v + 2.5 * a) * u ** 4 +
    (6 * d - 6 * v - a) * u ** 5
  );
}

/** Keep the recorded path at rest; carry incoming velocity through a reversal. */
export function cameraSegment(
  from: number,
  to: number,
  velocity: number,
  durationMs: number,
  elapsedMs: number,
) {
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  return (
    from +
    (to - from) * travelEase(t) +
    velocity * durationMs * (t - 6 * t ** 3 + 8 * t ** 4 - 3 * t ** 5)
  );
}

/** One continuous logo growth curve across crossfade and settle. */
export function logoScale(elapsed: number, crossfade: number, settle: number) {
  const t = Math.max(0, Math.min(1, elapsed / (crossfade + settle)));
  return 0.3 + 0.7 * (1 - (1 - t) ** 3);
}
