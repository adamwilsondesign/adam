import { describe, expect, it } from "vitest";

import { CLOUD_REST_SPEED, CLOUD_SURGE_SPEED, CloudMotion } from "./cloud-motion";

describe("continuous cloud motion", () => {
  it("advances at the recorded resting speed without a first-frame jump", () => {
    const motion = new CloudMotion();
    expect(motion.advance(40000)).toEqual({ time: 0, speed: CLOUD_REST_SPEED });
    expect(motion.advance(41000).time).toBeCloseTo(0.7, 12);
  });

  it("preserves forward surge windows, peak, and total traveled distance", () => {
    const motion = new CloudMotion();
    motion.surge(0, 1780, 1);
    expect(motion.advance(0)).toEqual({ time: 0, speed: CLOUD_REST_SPEED });
    expect(motion.advance(1780 * 0.18).speed).toBeCloseTo(CLOUD_SURGE_SPEED, 10);
    expect(motion.advance(1780 * 0.65).speed).toBeCloseTo(CLOUD_SURGE_SPEED, 10);
    const end = motion.advance(1780);
    expect(end.speed).toBeCloseTo(CLOUD_REST_SPEED, 10);
    const originalArea = 1.78 * (0.7 + 29.3 * 0.78);
    expect(end.time).toBeCloseTo(originalArea, 10);
    expect(motion.advance(2780).time - end.time).toBeCloseTo(0.7, 10);
  });

  it("preserves the return surge intensity and duration", () => {
    const motion = new CloudMotion();
    motion.surge(0, 800, 0.45);
    expect(motion.advance(400).speed).toBeCloseTo(0.7 + 29.3 * 0.45, 12);
    expect(motion.advance(800).speed).toBeCloseTo(0.7, 10);
  });

  it("keeps phase, speed, and acceleration continuous when interrupted", () => {
    const motion = new CloudMotion();
    motion.surge(0, 1780, 1);
    const before = motion.advance(99.99);
    const at = motion.advance(100);
    motion.surge(100, 800, 0.45);
    const retarget = motion.advance(100);
    const after = motion.advance(100.01);
    expect(retarget.time).toBe(at.time);
    expect(retarget.speed).toBeCloseTo(at.speed, 12);
    const incomingAcceleration = (at.speed - before.speed) / 0.00001;
    const outgoingAcceleration = (after.speed - retarget.speed) / 0.00001;
    expect(Math.abs(incomingAcceleration - outgoingAcceleration)).toBeLessThan(0.1);
    expect(after.time - retarget.time).toBeCloseTo(retarget.speed * 0.00001, 6);
    expect(motion.advance(900).speed).toBeCloseTo(CLOUD_REST_SPEED, 10);
  });

  it("does not jump when a surge starts or finishes", () => {
    const motion = new CloudMotion();
    motion.advance(0);
    const resting = motion.advance(500);
    motion.surge(500, 1780, 1);
    expect(motion.advance(500)).toEqual(resting);
    const beforeEnd = motion.advance(2279.99);
    const end = motion.advance(2280);
    const afterEnd = motion.advance(2280.01);
    expect(Math.abs(beforeEnd.speed - end.speed)).toBeLessThan(1e-8);
    expect(Math.abs(afterEnd.speed - end.speed)).toBeLessThan(1e-8);
    expect(afterEnd.time - end.time).toBeCloseTo(0.7 * 0.00001, 10);
  });

  it("takes the same path at 30, 60, and 120Hz, including a late frame", () => {
    const simulate = (hz: number) => {
      const motion = new CloudMotion();
      motion.surge(0, 1780, 1);
      for (let index = 1; index <= hz * 3; index++) motion.advance((index * 1000) / hz);
      return motion.advance(3000);
    };
    const sixty = simulate(60);
    expect(sixty.time).toBeCloseTo(simulate(120).time, 10);
    expect(sixty.time).toBeCloseTo(simulate(30).time, 10);
    const stalled = new CloudMotion();
    stalled.surge(0, 1780, 1);
    expect(stalled.advance(3000).time).toBeCloseTo(sixty.time, 10);
  });

  it("resumes without consuming hidden time or abandoning the current surge", () => {
    const motion = new CloudMotion();
    motion.surge(0, 1780, 1);
    const beforeHide = motion.advance(200);
    motion.resetTimestamp();
    expect(motion.advance(60200)).toEqual(beforeHide);
    const resumed = motion.advance(60216);
    const reference = new CloudMotion();
    reference.surge(0, 1780, 1);
    expect(resumed.time).toBeCloseTo(reference.advance(216).time, 12);
    expect(resumed.speed).toBeCloseTo(reference.advance(216).speed, 12);
  });

  it("keeps repeated reversals within the recorded speed range", () => {
    const motion = new CloudMotion();
    motion.surge(0, 1780, 1);
    for (let timestamp = 1; timestamp <= 3000; timestamp++) {
      if (timestamp % 117 === 0)
        motion.surge(timestamp, timestamp % 2 ? 800 : 1780, timestamp % 3 ? 0.45 : 1);
      const { speed } = motion.advance(timestamp);
      expect(speed).toBeGreaterThanOrEqual(CLOUD_REST_SPEED - 1e-9);
      expect(speed).toBeLessThanOrEqual(CLOUD_SURGE_SPEED + 1e-9);
    }
  });
});
