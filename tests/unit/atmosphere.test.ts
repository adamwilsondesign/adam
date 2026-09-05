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

describe("route transition clocks", () => {
  it("keeps the Work entrance inside its cinematic window (~1.7–1.9s total)", () => {
    // Camera starts ≈ 260–300ms after the click.
    expect(ENTRANCE_MS.camera).toBeGreaterThanOrEqual(1400);
    expect(ENTRANCE_MS.camera).toBeLessThanOrEqual(1650);
    expect(RETURN_MS.camera).toBeGreaterThanOrEqual(1000);
    expect(RETURN_MS.camera).toBeLessThanOrEqual(1200);
  });

  it("keeps the About descent deliberate and its reverse a true inverse", () => {
    expect(ABOUT_TIMINGS.desktop.arrival).toBeGreaterThanOrEqual(2100);
    expect(ABOUT_TIMINGS.desktop.arrival).toBeLessThanOrEqual(2300);
    expect(ABOUT_TIMINGS.mobile.arrival).toBeGreaterThanOrEqual(1500);
    expect(ABOUT_TIMINGS.mobile.arrival).toBeLessThanOrEqual(1700);
    expect(ABOUT_TIMINGS.reverse).toBeGreaterThanOrEqual(1400);
    expect(ABOUT_TIMINGS.reverse).toBeLessThanOrEqual(1600);
    expect(ABOUT_TIMINGS.desktop.reveal).toBeLessThan(ABOUT_TIMINGS.desktop.arrival);
    expect(ABOUT_TIMINGS.desktop.unlock).toBeLessThan(ABOUT_TIMINGS.desktop.arrival);
  });
});
