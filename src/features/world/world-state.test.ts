import { describe, expect, it } from "vitest";
import {
  cameraSegment,
  springStep,
  QualityBudget,
  addStar,
  beginStars,
  STAR_CAPACITY,
  starFrame,
} from "./world-state";

describe("world camera continuity", () => {
  it("retains the incoming velocity and ends exactly at the route target", () => {
    const from = 0.8,
      velocity = 0.001,
      duration = 1500;
    expect(cameraSegment(from, 0, velocity, duration, 0)).toBe(from);
    expect((cameraSegment(from, 0, velocity, duration, 0.01) - from) / 0.01).toBeCloseTo(
      velocity,
      8,
    );
    expect(cameraSegment(from, 0, velocity, duration, duration)).toBeCloseTo(0, 10);
    expect(cameraSegment(from, 0, velocity, duration, duration + 100)).toBeCloseTo(0, 10);
  });
  it("has the same trajectory at 30, 60 and 120Hz", () => {
    const simulate = (hz: number) => {
      let p = 0,
        v = 0;
      for (let i = 0; i < hz; i++) {
        const next = springStep(p, v, 1, 1 / hz);
        p = next.position;
        v = next.velocity;
      }
      return p;
    };
    expect(simulate(30)).toBeCloseTo(simulate(120), 10);
    expect(simulate(60)).toBeCloseTo(simulate(120), 10);
  });
  it("preserves motion when reversed and settles without a jump", () => {
    const moving = springStep(0, 0, 1, 0.3);
    const reverse = springStep(moving.position, moving.velocity, 0, 0.001);
    expect(Math.abs(reverse.position - moving.position)).toBeLessThan(0.002);
    expect(reverse.velocity).toBeGreaterThan(0);
    const settled = springStep(reverse.position, reverse.velocity, 0, 8);
    expect(settled.position).toBeCloseTo(0, 8);
  });
});
describe("adaptive quality", () => {
  it("ignores isolated spikes but reduces sustained overload with a lower bound", () => {
    const q = new QualityBudget();
    for (let i = 0; i < 1000; i++) q.sample(i % 100 === 0 ? 100 : 16.7);
    expect(q.scale).toBe(1);
    for (let i = 0; i < 3000; i++) q.sample(33.3);
    expect(q.scale).toBe(0.65);
    for (let i = 0; i < 200; i++) q.sample(8.3);
    expect(q.scale).toBe(0.65);
  });
  it("bounds the reusable star buffer and resets between frames", () => {
    beginStars();
    for (let i = 0; i < STAR_CAPACITY + 20; i++) addStar(i, 2, 1, 0.5);
    expect(starFrame.count).toBe(STAR_CAPACITY);
    beginStars();
    expect(starFrame.count).toBe(0);
  });
});
