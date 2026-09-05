/** Transient environmental state. No per-frame React updates or DOM reads. */
export const worldState = {
  ready: false,
  aboutProgress: 0,
  portalRevision: 0,
  workTravel: 0,
  aboutPhase: "settled" as "arriving" | "settled" | "leaving",
  aboutActive: false,
  portal: null as HTMLElement | null,
  portalHover: false,
};

export const STAR_CAPACITY = 512;
export const starFrame = { data: new Float32Array(STAR_CAPACITY * 4), count: 0 };
export function beginStars() {
  starFrame.count = 0;
}
export function addStar(x: number, y: number, radius: number, alpha: number) {
  if (starFrame.count >= STAR_CAPACITY) return;
  const i = starFrame.count++ * 4;
  starFrame.data[i] = x;
  starFrame.data[i + 1] = y;
  starFrame.data[i + 2] = radius;
  starFrame.data[i + 3] = alpha;
}

/** One animation clock; simulation callbacks precede the GPU submission. */
const updates = new Set<(now: number) => void>();
export function subscribeWorldFrame(update: (now: number) => void) {
  updates.add(update);
  return () => {
    updates.delete(update);
  };
}
export function updateWorldFrame(now: number) {
  for (const update of updates) update(now);
}

/** Exact critically damped spring: retargeting preserves position and velocity. */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  omega = 4,
) {
  const offset = position - target;
  const impulse = velocity + omega * offset;
  const decay = Math.exp(-omega * dt);
  return {
    position: target + (offset + impulse * dt) * decay,
    velocity: (velocity - omega * impulse * dt) * decay,
  };
}

/** Sustained pressure only, with a cooldown to avoid resolution pumping. */
export class QualityBudget {
  scale = 1;
  private slow = 0;
  private fast = 0;
  private cooldown = 240;
  sample(ms: number) {
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    this.slow = ms > 21 ? this.slow + 1 : Math.max(0, this.slow - 1);
    this.fast = ms < 18 ? this.fast + 1 : 0;
    if (this.slow > 45 && this.scale > 0.65) {
      this.scale = Math.max(0.65, this.scale - 0.12);
    } else if (this.fast > 900 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.06);
    } else return false;
    this.slow = this.fast = 0;
    this.cooldown = 300;
    return true;
  }
}

/** Quintic camera segment with zero final velocity/acceleration and a live initial velocity. */
export function cameraSegment(
  from: number,
  to: number,
  velocity: number,
  durationMs: number,
  elapsedMs: number,
) {
  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const d = to - from,
    v = velocity * durationMs;
  return (
    from + v * t + (10 * d - 6 * v) * t ** 3 + (-15 * d + 8 * v) * t ** 4 + (6 * d - 3 * v) * t ** 5
  );
}
