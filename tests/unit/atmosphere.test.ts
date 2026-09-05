import { describe, expect, it } from "vitest";

import { ATMOS, hexToRgb, MOON_DIRECTION, rgba, VANTA_NIGHT } from "@/lib/atmosphere";
import { ABOUT_TIMINGS } from "@/features/about/AboutScene";
import { ENTRANCE_MS, RETURN_MS } from "@/features/sky/star-field";

describe("oxidized nocturne palette", () => {
  it("parses every swatch to valid RGB", () => {
    for (const hex of Object.values(ATMOS)) {
      const [r, g, b] = hexToRgb(hex);
      for (const channel of [r, g, b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(255);
      }
    }
    expect(hexToRgb("#969e9a")).toEqual([150, 158, 154]);
    expect(rgba("#020403", 0.5)).toBe("rgba(2, 4, 3, 0.5)");
  });

  it("keys the Vanta config to the same swatches", () => {
    expect(VANTA_NIGHT.skyColor).toBe(parseInt(ATMOS.sky.slice(1), 16));
    expect(VANTA_NIGHT.cloudColor).toBe(parseInt(ATMOS.cloud.slice(1), 16));
    expect(VANTA_NIGHT.backgroundColor).toBe(parseInt(ATMOS.deepBackground.slice(1), 16));
  });

  it("normalizes the single motivated light direction", () => {
    const { x, y, z } = MOON_DIRECTION;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
    expect(x).toBeGreaterThan(0); // from the right
    expect(y).toBeGreaterThan(0); // from above
  });
});

describe("recorded transition timing", () => {
  it("preserves the approved Work flight and faster return", () => {
    expect(ENTRANCE_MS).toEqual({ camera: 1400, crossfade: 280, settle: 380 });
    expect(RETURN_MS).toEqual({ camera: 800, contract: 200 });
  });
  it("keeps About copy overlapping the original descent", () => {
    expect(ABOUT_TIMINGS.desktop).toEqual({ arrival: 1700, reveal: 1050, unlock: 1300 });
    expect(ABOUT_TIMINGS.mobile).toEqual({ arrival: 1200, reveal: 760, unlock: 950 });
    expect(ABOUT_TIMINGS.reverse).toBe(780);
  });
});
