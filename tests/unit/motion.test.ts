import { describe, expect, it } from "vitest";

import { CINEMATIC_PEAK_T, cinematicEase, invCinematicEase, smootherstep } from "@/lib/motion";

describe("smootherstep", () => {
  it("hits its endpoints exactly and clamps outside them", () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(-2)).toBe(0);
    expect(smootherstep(3)).toBe(1);
  });

  it("starts and stops with no velocity (flat at both ends)", () => {
    expect(smootherstep(0.01)).toBeLessThan(0.001);
    expect(1 - smootherstep(0.99)).toBeLessThan(0.001);
  });

  it("is monotonic", () => {
    let previous = 0;
    for (let i = 1; i <= 100; i++) {
      const value = smootherstep(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("cinematicEase", () => {
  it("starts at 0 and lands exactly on 1", () => {
    expect(cinematicEase(0)).toBe(0);
    expect(cinematicEase(1)).toBeCloseTo(1, 10);
  });

  it("carries a subtle optical settle (1–2% past the mark, late)", () => {
    const peak = cinematicEase(CINEMATIC_PEAK_T);
    expect(peak).toBeGreaterThan(1.005);
    expect(peak).toBeLessThan(1.02);
    expect(CINEMATIC_PEAK_T).toBeGreaterThan(0.7);
    expect(CINEMATIC_PEAK_T).toBeLessThan(0.98);
  });

  it("rises monotonically up to its peak", () => {
    let previous = -1;
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * CINEMATIC_PEAK_T;
      const value = cinematicEase(t);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it("inverts on the rising segment: first crossing times round-trip", () => {
    for (const value of [0, 0.1, 0.35, 0.62, 0.9, 0.999, 1]) {
      const t = invCinematicEase(value);
      expect(cinematicEase(t)).toBeCloseTo(Math.min(value, cinematicEase(CINEMATIC_PEAK_T)), 4);
    }
    // Ordering is preserved — later arrivals get later times.
    expect(invCinematicEase(0.2)).toBeLessThan(invCinematicEase(0.6));
    expect(invCinematicEase(0.6)).toBeLessThan(invCinematicEase(0.99));
  });
});
