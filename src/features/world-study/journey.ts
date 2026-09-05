/** A single world-space camera shared by every part of the study's environment. */
export type JourneyState = "home" | "work" | "about";
export type Vec3 = [number, number, number];

export interface JourneyPose {
  eye: Vec3;
  target: Vec3;
}

export interface JourneySample {
  pose: JourneyPose;
  /** Derivatives of the rendered pose, in world units per second. */
  velocity: JourneyPose;
  acceleration: JourneyPose;
  progress: number;
  /** The destination, including while travelling toward it. */
  state: JourneyState;
  settled: boolean;
  /** Use this clock for atmospheric motion too, so hidden tabs freeze the whole world. */
  elapsedSeconds: number;
}

export const JOURNEY_POSES: Readonly<Record<JourneyState, JourneyPose>> = {
  home: { eye: [0, 160, 700], target: [0, 105, -600] },
  work: { eye: [80, 510, -750], target: [80, 460, -1700] },
  about: { eye: [-100, -250, 300], target: [30, -125, -1000] },
};

/** Milliseconds; navigation moves through space without changing the camera's field of view. */
export const JOURNEY_DURATIONS: Readonly<Record<JourneyState, number>> = {
  home: 1000,
  work: 1780,
  about: 1700,
};

interface JourneyOptions {
  initialState?: JourneyState;
  idleIntensity?: number;
  pointerIntensity?: number;
}

type Coefficients = [number, number, number, number, number, number];
type Channels = [number, number, number, number, number, number];
type Six<T> = [T, T, T, T, T, T];
const CHANNEL_AXES = [0, 1, 2, 3, 4, 5] as const;
const SPATIAL_AXIS = [0, 1, 2, 0, 1, 2] as const;
type ChannelAxis = (typeof CHANNEL_AXES)[number];
const mapChannels = <T>(fn: (axis: ChannelAxis) => T): Six<T> => [
  fn(0),
  fn(1),
  fn(2),
  fn(3),
  fn(4),
  fn(5),
];

interface Trajectory {
  began: number;
  duration: number;
  coefficients: Six<Coefficients>;
}

interface PathSample {
  position: Channels;
  velocity: Channels;
  acceleration: Channels;
  progress: number;
}

const zeros = (): Channels => [0, 0, 0, 0, 0, 0];
const channels = (pose: JourneyPose): Channels => [...pose.eye, ...pose.target];
const pose = (value: Channels): JourneyPose => ({
  eye: [value[0], value[1], value[2]],
  target: [value[3], value[4], value[5]],
});

/** Quintic Hermite segment, preserving incoming velocity and acceleration at a redirect. */
function coefficients(
  from: number,
  to: number,
  velocity: number,
  acceleration: number,
  dt: number,
) {
  const c0 = from;
  const c1 = velocity * dt;
  const c2 = 0.5 * acceleration * dt * dt;
  const displacement = to - c0 - c1 - c2;
  const terminalVelocity = -c1 - 2 * c2;
  const terminalAcceleration = -2 * c2;
  return [
    c0,
    c1,
    c2,
    10 * displacement - 4 * terminalVelocity + 0.5 * terminalAcceleration,
    -15 * displacement + 7 * terminalVelocity - terminalAcceleration,
    6 * displacement - 3 * terminalVelocity + 0.5 * terminalAcceleration,
  ] satisfies Coefficients;
}

export class Journey {
  private destination: JourneyState;
  private trajectory: Trajectory | null = null;
  private elapsed = 0;
  private previousWallTime: number | null = null;
  private paused = false;
  private pointer: [number, number] = [0, 0];
  private pointerVelocity: [number, number] = [0, 0];
  private pointerTarget: [number, number] = [0, 0];
  private readonly idleIntensity: number;
  private readonly pointerIntensity: number;

  constructor(options: JourneyOptions = {}) {
    this.destination = options.initialState ?? "home";
    this.idleIntensity = options.idleIntensity ?? 1;
    this.pointerIntensity = options.pointerIntensity ?? 1;
  }

  /** Pointer coordinates are normalized to -1..1; input never replaces the journey. */
  setPointer(x: number, y: number) {
    this.pointerTarget[0] = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    this.pointerTarget[1] = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  }

  go(destination: JourneyState, nowMs: number) {
    this.tick(nowMs);
    // Repeated clicks must not restart an arrival or erase its momentum.
    if (destination === this.destination) return;
    const current = this.path();
    const end = channels(JOURNEY_POSES[destination]);
    const duration = JOURNEY_DURATIONS[destination] / 1000;
    this.trajectory = {
      began: this.elapsed,
      duration,
      coefficients: mapChannels((axis) =>
        coefficients(
          current.position[axis],
          end[axis],
          current.velocity[axis],
          current.acceleration[axis],
          duration,
        ),
      ),
    };
    this.destination = destination;
  }

  pause(nowMs: number) {
    this.tick(nowMs);
    this.paused = true;
  }

  resume(nowMs: number) {
    this.tick(nowMs);
    this.paused = false;
  }

  sample(nowMs: number): JourneySample {
    this.tick(nowMs);
    const path = this.path();
    const time = this.elapsed;
    // Continuous drift has the same phase in every state. There are no route-specific idle loops.
    const idleAmplitude: Vec3 = [1.1, 1.4, 0.6];
    const idleFrequency: Vec3 = [0.23, 0.31, 0.17];
    const pointerWeights: Channels = [2, 1.1, 0, 4, 2.2, 0];
    for (const axis of CHANNEL_AXES) {
      const spatialAxis = SPATIAL_AXIS[axis];
      const frequency = idleFrequency[spatialAxis];
      const amplitude = idleAmplitude[spatialAxis] * this.idleIntensity;
      // Translate eye and target together for drift: no rolling horizon or automatic orbit.
      path.position[axis] += Math.sin(time * frequency) * amplitude;
      path.velocity[axis] += Math.cos(time * frequency) * amplitude * frequency;
      path.acceleration[axis] -= Math.sin(time * frequency) * amplitude * frequency * frequency;
      if (spatialAxis !== 2) {
        const weight = pointerWeights[axis] * this.pointerIntensity;
        const pointerAcceleration =
          25 * (this.pointerTarget[spatialAxis] - this.pointer[spatialAxis]) -
          10 * this.pointerVelocity[spatialAxis];
        path.position[axis] += this.pointer[spatialAxis] * weight;
        path.velocity[axis] += this.pointerVelocity[spatialAxis] * weight;
        path.acceleration[axis] += pointerAcceleration * weight;
      }
    }
    return {
      pose: pose(path.position),
      velocity: pose(this.paused ? zeros() : path.velocity),
      acceleration: pose(this.paused ? zeros() : path.acceleration),
      progress: path.progress,
      state: this.destination,
      settled: path.progress === 1,
      elapsedSeconds: this.elapsed,
    };
  }

  private tick(nowMs: number) {
    if (!Number.isFinite(nowMs)) throw new RangeError("Journey needs a finite timestamp.");
    if (this.previousWallTime === null) {
      this.previousWallTime = nowMs;
      return;
    }
    const next = Math.max(nowMs, this.previousWallTime);
    const dt = (next - this.previousWallTime) / 1000;
    this.previousWallTime = next;
    if (this.paused || dt === 0) return;
    this.elapsed += dt;
    // Exact critically damped integration is stable at 30, 60, 120 Hz and after a delayed frame.
    const decay = Math.exp(-5 * dt);
    for (const axis of [0, 1] as const) {
      const offset = this.pointer[axis] - this.pointerTarget[axis];
      const coefficient = this.pointerVelocity[axis] + 5 * offset;
      this.pointer[axis] = this.pointerTarget[axis] + (offset + coefficient * dt) * decay;
      this.pointerVelocity[axis] = (this.pointerVelocity[axis] - 5 * coefficient * dt) * decay;
    }
  }

  private path(): PathSample {
    const trajectory = this.trajectory;
    const rawProgress = trajectory
      ? Math.max(0, (this.elapsed - trajectory.began) / trajectory.duration)
      : 1;
    // Summed frame durations can land a few floating-point ulps before an exact endpoint.
    const progress = rawProgress >= 1 - 1e-10 ? 1 : rawProgress;
    if (!trajectory || progress === 1) {
      return {
        position: channels(JOURNEY_POSES[this.destination]),
        velocity: zeros(),
        acceleration: zeros(),
        progress,
      };
    }
    const position = zeros();
    const velocity = zeros();
    const acceleration = zeros();
    const u = progress;
    for (const axis of CHANNEL_AXES) {
      const [a, b, c, d, e, f] = trajectory.coefficients[axis];
      position[axis] = a + u * (b + u * (c + u * (d + u * (e + u * f))));
      velocity[axis] =
        (b + u * (2 * c + u * (3 * d + u * (4 * e + u * 5 * f)))) / trajectory.duration;
      acceleration[axis] =
        (2 * c + u * (6 * d + u * (12 * e + u * 20 * f))) /
        (trajectory.duration * trajectory.duration);
    }
    return { position, velocity, acceleration, progress };
  }
}
