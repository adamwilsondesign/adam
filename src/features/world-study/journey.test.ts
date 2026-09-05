import { describe, expect, it } from "vitest";
import { Journey, JOURNEY_DURATIONS, JOURNEY_POSES, type JourneyPose, type Vec3 } from "./journey";

const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const stillJourney = () => new Journey({ idleIntensity: 0, pointerIntensity: 0 });
const expectPoseNear = (actual: JourneyPose, expected: JourneyPose, precision = 8) => {
  for (const part of ["eye", "target"] as const)
    for (const axis of [0, 1, 2] as const)
      expect(actual[part][axis]).toBeCloseTo(expected[part][axis], precision);
};
const zeroPose: JourneyPose = { eye: [0, 0, 0], target: [0, 0, 0] };

describe("shared world camera", () => {
  it("travels 1450 units forward and 350 upward to Work above the cloud sea", () => {
    const journey = stillJourney();
    journey.go("work", 0);
    const midway = journey.sample(JOURNEY_DURATIONS.work / 2);
    const arrived = journey.sample(JOURNEY_DURATIONS.work);
    expect(midway.pose.eye[2]).toBeCloseTo(-25, 8);
    expect(midway.pose.eye[1]).toBeCloseTo(335, 8);
    expect(arrived.pose).toEqual(JOURNEY_POSES.work);
    expect(distance(JOURNEY_POSES.home.eye, arrived.pose.eye)).toBeGreaterThan(1490);
    expect(arrived.pose.eye[1]).toBeGreaterThan(170);
    expect(arrived.settled).toBe(true);
    expectPoseNear(arrived.velocity, zeroPose);
    expectPoseNear(arrived.acceleration, zeroPose);
  });

  it("passes below the same cloud deck on the journey to About", () => {
    const journey = stillJourney();
    journey.go("about", 0);
    const midway = journey.sample(JOURNEY_DURATIONS.about / 2);
    const arrived = journey.sample(JOURNEY_DURATIONS.about);
    expect(midway.pose.eye[1]).toBeCloseTo(-45, 8);
    expect(arrived.pose.eye[1]).toBe(-250);
    expect(arrived.pose.eye[2]).toBe(300);
    expect(arrived.pose).toEqual(JOURNEY_POSES.about);
    expect(distance(JOURNEY_POSES.home.eye, arrived.pose.eye)).toBeGreaterThan(580);
  });

  it("returns through the same world coordinates, moving backward from Work", () => {
    const journey = stillJourney();
    journey.go("work", 0);
    journey.sample(1780);
    journey.go("home", 1780);
    const returning = journey.sample(2280);
    expect(returning.velocity.eye[2]).toBeGreaterThan(0);
    expect(returning.velocity.eye[1]).toBeLessThan(0);
    expect(returning.pose.eye[2]).toBeCloseTo(-25, 8);
    expect(journey.sample(2780).pose).toEqual(JOURNEY_POSES.home);
  });

  it("carries position, velocity and acceleration through an interrupted journey", () => {
    const journey = stillJourney();
    journey.go("work", 0);
    const before = journey.sample(620);
    journey.go("about", 620);
    const after = journey.sample(620);
    expectPoseNear(after.pose, before.pose);
    expectPoseNear(after.velocity, before.velocity);
    expectPoseNear(after.acceleration, before.acceleration);
    // Inertia carries the camera forward briefly; reversal is not an instantaneous sign flip.
    expect(Math.sign(journey.sample(621).velocity.eye[2])).toBe(Math.sign(before.velocity.eye[2]));
    const arrived = journey.sample(2320);
    expectPoseNear(arrived.pose, JOURNEY_POSES.about);
    expectPoseNear(arrived.velocity, zeroPose);
    expectPoseNear(arrived.acceleration, zeroPose);
  });

  it("does not restart an arrival when its destination is selected repeatedly", () => {
    const journey = stillJourney();
    journey.go("work", 0);
    journey.go("work", 700);
    expect(journey.sample(1780).settled).toBe(true);
    expect(journey.sample(1780).pose).toEqual(JOURNEY_POSES.work);
  });

  it("freezes journey, idle phase and pointer inertia while hidden", () => {
    const journey = new Journey();
    journey.go("work", 0);
    journey.setPointer(1, -0.5);
    const before = journey.sample(600);
    journey.pause(600);
    const hidden = journey.sample(60_600);
    expect(hidden.pose).toEqual(before.pose);
    expect(hidden.progress).toBe(before.progress);
    expect(hidden.elapsedSeconds).toBe(before.elapsedSeconds);
    expect(hidden.velocity).toEqual(zeroPose);
    journey.resume(60_600);
    expect(journey.sample(60_600).pose).toEqual(before.pose);
    expectPoseNear(journey.sample(60_600).velocity, before.velocity);
    expect(journey.sample(61_780).settled).toBe(true);
  });

  it("has the same camera and input response at different render rates", () => {
    const run = (rate: number) => {
      const journey = new Journey();
      journey.go("work", 0);
      journey.setPointer(1, -0.8);
      for (let frame = 1; frame <= rate; frame++) journey.sample((frame * 1000) / rate);
      return journey.sample(1000);
    };
    const low = run(30);
    for (const rate of [60, 120]) {
      const high = run(rate);
      expectPoseNear(high.pose, low.pose);
      expectPoseNear(high.velocity, low.velocity);
      expectPoseNear(high.acceleration, low.acceleration);
    }
  });

  it("keeps input restrained while idle motion continues without a pointer", () => {
    const stationary = new Journey({ pointerIntensity: 0 });
    const start = stationary.sample(0);
    const later = stationary.sample(3000);
    expect(distance(start.pose.eye, later.pose.eye)).toBeGreaterThan(0.5);
    expect(distance(start.pose.eye, later.pose.eye)).toBeLessThan(2);
    const input = new Journey({ idleIntensity: 0 });
    input.sample(0);
    input.setPointer(100, -100);
    const moved = input.sample(10_000);
    expect(moved.pose.eye[0]).toBeCloseTo(2, 8);
    expect(moved.pose.eye[1]).toBeCloseTo(158.9, 8);
    expect(distance(moved.pose.eye, JOURNEY_POSES.home.eye)).toBeLessThan(2.3);
  });

  it("does not change position or velocity when a pointer target changes", () => {
    const journey = new Journey();
    const before = journey.sample(0);
    journey.setPointer(1, -1);
    const after = journey.sample(0);
    expect(after.pose).toEqual(before.pose);
    expect(after.velocity).toEqual(before.velocity);
    expect(journey.sample(16).pose.eye[0]).toBeGreaterThan(before.pose.eye[0]);
  });

  it("remains finite through rapid redirects and still ends at the selected destination", () => {
    const journey = stillJourney();
    for (let click = 0; click < 40; click++) {
      const time = click * 70;
      const destination = click % 3 === 0 ? "work" : click % 3 === 1 ? "about" : "home";
      journey.go(destination, time);
      const sample = journey.sample(time + 20);
      for (const property of ["pose", "velocity", "acceleration"] as const)
        for (const value of [...sample[property].eye, ...sample[property].target])
          expect(Number.isFinite(value)).toBe(true);
    }
    journey.go("home", 3000);
    const end = journey.sample(5000);
    expect(end.pose).toEqual(JOURNEY_POSES.home);
    expect(end.settled).toBe(true);
  });

  it("ignores backward clock readings and rejects nonfinite timestamps", () => {
    const journey = stillJourney();
    journey.go("work", 100);
    const valid = journey.sample(500);
    expect(journey.sample(400)).toEqual(valid);
    expect(() => journey.sample(Number.NaN)).toThrow(RangeError);
    expect(journey.sample(500)).toEqual(valid);
  });
});
