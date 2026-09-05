/** Cloud clock velocities, matching the recorded environment. */
export const CLOUD_REST_SPEED = 0.7;
export const CLOUD_SURGE_SPEED = 30;

type Segment = { duration: number; coefficients: number[] };
type MotionSample = { speed: number; acceleration: number };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function polynomial(coefficients: number[], u: number): number {
  let value = 0;
  for (let index = coefficients.length - 1; index >= 0; index--) {
    value = value * u + coefficients[index]!;
  }
  return value;
}

function integral(segment: Segment, elapsed: number): number {
  const u = clamp01(elapsed / segment.duration);
  let value = 0;
  for (let index = segment.coefficients.length - 1; index >= 0; index--) {
    value = value * u + segment.coefficients[index]! / (index + 1);
  }
  return value * u * segment.duration;
}

/** Fast rise with zero acceleration at either end and the original 0.75 mean.
 * This preserves traveled cloud distance while rounding the original abrupt launch.
 */
function rise(from: number, to: number, duration: number): Segment {
  const delta = to - from;
  return {
    duration,
    coefficients: [
      from,
      0,
      21 * delta,
      -70 * delta,
      105 * delta,
      -84 * delta,
      35 * delta,
      -6 * delta,
    ],
  };
}

/** Integrates cloud speed independently of rendering frequency.
 * `time` is accumulated speed-seconds, starting at zero; the shader owns its seed.
 */
export class CloudMotion {
  private time = 0;
  private lastTimestamp: number | null = null;
  private elapsed = 0;
  private segments: Segment[] = [];

  private sample(): MotionSample {
    let remaining = this.elapsed;
    for (const segment of this.segments) {
      if (remaining < segment.duration) {
        const u = clamp01(remaining / segment.duration);
        let derivative = 0;
        for (let index = segment.coefficients.length - 1; index > 0; index--) {
          derivative = derivative * u + segment.coefficients[index]! * index;
        }
        return {
          speed: polynomial(segment.coefficients, u),
          acceleration: derivative / segment.duration,
        };
      }
      remaining -= segment.duration;
    }
    return { speed: CLOUD_REST_SPEED, acceleration: 0 };
  }

  private area(elapsed: number): number {
    let remaining = elapsed;
    let value = 0;
    for (const segment of this.segments) {
      if (remaining <= 0) return value;
      value += integral(segment, remaining);
      remaining -= segment.duration;
    }
    return value + Math.max(0, remaining) * CLOUD_REST_SPEED;
  }

  surge(nowMs: number, durationMs: number, intensity: number): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(intensity)) {
      throw new RangeError("Cloud surge requires a positive duration and finite intensity.");
    }
    this.advance(nowMs);
    const current = this.sample();
    const duration = durationMs / 1000;
    const peak = CLOUD_REST_SPEED + (CLOUD_SURGE_SPEED - CLOUD_REST_SPEED) * clamp01(intensity);
    let rampDuration = duration * 0.18;
    let rampFrom = current.speed;
    const segments: Segment[] = [];

    if (Math.abs(current.acceleration) > 1e-8) {
      // Carry the existing acceleration briefly, then brake it to zero before
      // the new ramp. Keeping this segment inside the available speed range
      // prevents a rapid reversal from producing backwards cloud motion.
      const room =
        current.acceleration > 0
          ? CLOUD_SURGE_SPEED - current.speed
          : current.speed - CLOUD_REST_SPEED;
      const blend = Math.min(
        0.025,
        rampDuration * 0.12,
        Math.max(0, room) / Math.abs(current.acceleration),
      );
      if (blend > 1e-9) {
        const momentum = current.acceleration * blend;
        segments.push({
          duration: blend,
          coefficients: [current.speed, momentum, -0.5 * momentum],
        });
        rampFrom += momentum * 0.5;
        rampDuration -= blend;
      }
    }

    segments.push(rise(rampFrom, peak, rampDuration));
    segments.push({ duration: duration * 0.47, coefficients: [peak] });
    const drop = CLOUD_REST_SPEED - peak;
    segments.push({
      duration: duration * 0.35,
      coefficients: [peak, 0, 0, 10 * drop, -15 * drop, 6 * drop],
    });
    this.segments = segments;
    this.elapsed = 0;
  }

  advance(nowMs: number): { time: number; speed: number } {
    if (!Number.isFinite(nowMs)) throw new RangeError("Cloud clock requires a finite timestamp.");
    if (this.lastTimestamp !== null && nowMs > this.lastTimestamp) {
      const next = this.elapsed + (nowMs - this.lastTimestamp) / 1000;
      // Exact polynomial antiderivatives make 30/60/120Hz take the same path.
      this.time += this.area(next) - this.area(this.elapsed);
      this.elapsed = next;
    }
    this.lastTimestamp = Math.max(this.lastTimestamp ?? nowMs, nowMs);
    return { time: this.time, speed: this.sample().speed };
  }

  /** Call on visibility changes. The first resumed frame establishes a new
   * timestamp without advancing the phase or consuming the remaining surge.
   */
  resetTimestamp(): void {
    this.lastTimestamp = null;
  }
}
