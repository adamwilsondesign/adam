import { describe, expect, it } from "vitest";

import { sphereCoverageAt, type SphereProjection } from "./sphere-occlusion";

const view: SphereProjection = {
  width: 1600,
  height: 900,
  aspect: 1600 / 900,
  centerX: 6.8,
  centerY: 1.8,
  depth: 12,
  radius: 2.6,
  framingY: 0,
  layerScale: 1,
  layerShiftY: 0,
};

describe("shader-matched sphere occlusion", () => {
  it("occludes the off-axis outer edge missed by a projected-center circle", () => {
    const focal = view.height * 0.75;
    const oldX = view.width / 2 + (view.centerX * focal) / view.depth;
    const oldY = view.height / 2 - (view.centerY * focal) / view.depth;
    const oldRadius = (view.radius * focal) / view.depth;
    expect(Math.hypot(1340 - oldX, 340 - oldY)).toBeGreaterThan(oldRadius);
    expect(sphereCoverageAt(1340, 340, view)).toBe(1);
    expect(sphereCoverageAt(1380, 340, view)).toBe(0);
  });

  it("uses the same ray after shader framing and the About deck CSS transform", () => {
    const moved = { ...view, framingY: 0.2, layerScale: 1.7, layerShiftY: -230 };
    const localY = 340 + (moved.framingY * moved.height) / 2;
    const x = (1340 - moved.width / 2) * moved.layerScale + moved.width / 2;
    const y = (localY - moved.height / 2) * moved.layerScale + moved.height / 2 + moved.layerShiftY;
    expect(sphereCoverageAt(x, y, moved)).toBe(sphereCoverageAt(1340, 340, view));
  });

  it("matches the shader's smooth edge and rejects a sphere behind the eye", () => {
    const centered = { ...view, centerX: 0, centerY: 0 };
    const tangent = (1.5 * view.radius) / Math.sqrt(view.depth ** 2 - view.radius ** 2);
    const edgeX = view.width / 2 + (tangent * view.height) / 2;
    expect(sphereCoverageAt(edgeX + 0.01, view.height / 2, centered)).toBe(0);
    const edge = sphereCoverageAt(edgeX - 0.01, view.height / 2, centered);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
    expect(sphereCoverageAt(view.width / 2, view.height / 2, { ...centered, depth: -12 })).toBe(0);
  });
});
